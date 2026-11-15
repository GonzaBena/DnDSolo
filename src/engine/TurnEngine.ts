import { applyStateChanges, type RejectedChange } from "../domain/applyChanges";
import { resolveRoll, rollDie } from "../domain/dice";
import { dmResponseJsonSchema, parseDMResponse } from "../domain/schemas";
import type { DMResponse, GameState, RollResult, Turn, TurnInput } from "../domain/types";
import type { LLMClient } from "../llm/LLMClient";
import type { GameRepo } from "../persistence/GameRepo";
import {
  buildSummaryPrompt,
  buildTurnPrompt,
  DM_SYSTEM_PROMPT,
  SUMMARY_SYSTEM_PROMPT,
} from "./dmPrompt";
import { extractPartialNarration } from "./narrationStream";

export interface EngineConfig {
  /** How many of the latest turns are sent verbatim. */
  recentTurns: number;
  /** The running summary is regenerated every this many turns. */
  summaryEveryTurns: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = { recentTurns: 6, summaryEveryTurns: 10 };

export interface EngineDeps {
  llm: LLMClient;
  repo: GameRepo;
  random?: () => number;
  now?: () => Date;
  config?: Partial<EngineConfig>;
}

export type TurnFailure =
  /** The input doesn't fit the game's situation (e.g. acting while a roll is pending). */
  | { kind: "invalid_input"; message: string }
  /** The model answered twice with something that doesn't match the schema. */
  | { kind: "invalid_response"; message: string }
  /** The call itself failed (key, network, quota...). */
  | { kind: "llm"; message: string; cause: unknown };

export type TurnOutcome =
  | {
      ok: true;
      state: GameState;
      response: DMResponse;
      rejectedChanges: RejectedChange[];
      /** The turn happened but couldn't be written; the UI should warn. */
      saveError: unknown | null;
    }
  /** `state` is the untouched input state: a failed turn changes nothing,
      so the player can simply try again. */
  | { ok: false; state: GameState; failure: TurnFailure };

/** Orchestrates one turn: build prompt -> call model -> validate -> apply
    changes -> save. It knows nothing about the UI, which is what makes it
    testable with a fake client and an in-memory repo. */
export class TurnEngine {
  private readonly llm: LLMClient;
  private readonly repo: GameRepo;
  private readonly random: () => number;
  private readonly now: () => Date;
  readonly config: EngineConfig;

  constructor(deps: EngineDeps) {
    this.llm = deps.llm;
    this.repo = deps.repo;
    this.random = deps.random ?? Math.random;
    this.now = deps.now ?? (() => new Date());
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...deps.config };
  }

  /** Rolls the die the DM asked for. Doesn't touch the state: the result
      becomes the input of the next turn via playTurn. */
  rollPending(state: GameState): RollResult {
    if (!state.pendingRoll) throw new Error("There is no pending roll.");
    return resolveRoll(state.pendingRoll, rollDie(state.pendingRoll.die, this.random));
  }

  /**
   * @param onNarration receives the narration read so far, in full, each
   *   time more text arrives (and "" if a retry starts over).
   */
  async playTurn(
    state: GameState,
    input: TurnInput,
    onNarration?: (narrationSoFar: string) => void,
  ): Promise<TurnOutcome> {
    const inputProblem = this.checkInput(state, input);
    if (inputProblem) {
      return { ok: false, state, failure: { kind: "invalid_input", message: inputProblem } };
    }

    const prompt = buildTurnPrompt(state, input, this.config.recentTurns);

    // One retry on malformed output, then give up cleanly (Spec, rule 2).
    let lastReason = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let raw = "";
      if (attempt > 0) onNarration?.("");
      try {
        raw = await this.llm.generateStructured({
          system: DM_SYSTEM_PROMPT,
          prompt,
          jsonSchema: dmResponseJsonSchema,
          onChunk: (fragment) => {
            raw += fragment;
            onNarration?.(extractPartialNarration(raw));
          },
        });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        return { ok: false, state, failure: { kind: "llm", message, cause } };
      }

      const parsed = parseDMResponse(raw);
      if (!parsed.ok) {
        lastReason = parsed.reason;
        continue;
      }
      return this.commit(state, input, parsed.response);
    }

    return { ok: false, state, failure: { kind: "invalid_response", message: lastReason } };
  }

  private checkInput(state: GameState, input: TurnInput): string | null {
    switch (input.type) {
      case "start":
        return state.turns.length === 0 ? null : "The game has already started.";
      case "action":
        if (state.turns.length === 0) return "The game hasn't started yet.";
        if (state.pendingRoll) return "There is a pending roll to resolve first.";
        return input.text.trim() === "" ? "The action is empty." : null;
      case "roll": {
        const pending = state.pendingRoll;
        if (!pending) return "There is no pending roll.";
        const { die, reason, difficulty } = input.result;
        const matches =
          die === pending.die && reason === pending.reason && difficulty === pending.difficulty;
        return matches ? null : "The roll doesn't match the one that was requested.";
      }
    }
  }

  private async commit(
    state: GameState,
    input: TurnInput,
    response: DMResponse,
  ): Promise<TurnOutcome> {
    const applied = applyStateChanges(state, response.stateChanges);
    const turn: Turn = {
      number: state.turns.length + 1,
      input,
      narration: response.narration,
      events: response.events,
    };
    const next = await this.refreshSummary({
      ...applied.state,
      turns: [...state.turns, turn],
      pendingRoll: response.rollRequest,
      updatedAt: this.now().toISOString(),
    });

    let saveError: unknown | null = null;
    try {
      await this.repo.save(next);
    } catch (error) {
      saveError = error;
    }
    return { ok: true, state: next, response, rejectedChanges: applied.rejected, saveError };
  }

  /** Memory layer 2: every `summaryEveryTurns` turns, folds the turns the
      summary doesn't cover yet into it. A failure here must not cost the
      player their turn: the old summary is kept and, because the turns
      stay unsummarized, the next turn tries again. */
  private async refreshSummary(state: GameState): Promise<GameState> {
    const pending = state.turns.slice(state.summarizedThroughTurn);
    if (pending.length < this.config.summaryEveryTurns) return state;
    try {
      const summary = await this.llm.generateText({
        system: SUMMARY_SYSTEM_PROMPT,
        prompt: buildSummaryPrompt(state.summary, pending),
      });
      if (summary.trim() === "") return state;
      return { ...state, summary: summary.trim(), summarizedThroughTurn: state.turns.length };
    } catch {
      return state;
    }
  }
}
