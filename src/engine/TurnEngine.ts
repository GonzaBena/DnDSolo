import { applyStateChanges, type RejectedChange } from "../domain/applyChanges";
import { diceRolled, rollForEnemy } from "../domain/dice";
import { dmResponseJsonSchema, parseDMResponse } from "../domain/schemas";
import type {
  DMResponse,
  EnemyRollResult,
  GameState,
  Turn,
  TurnInput,
} from "../domain/types";
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

/** After a failed summary, how many more turns to wait before trying again. */
export const SUMMARY_RETRY_AFTER_TURNS = 3;

export interface SummaryPatch {
  summary: string;
  summarizedThroughTurn: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = { recentTurns: 6, summaryEveryTurns: 10 };

/** Enemy-roll turns are sent without the player doing anything, so a DM
    that kept asking for more would loop forever. After this many in a row
    further requests are dropped and the turn goes back to the player. */
export const MAX_CHAINED_ENEMY_ROLLS = 3;

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
  /** `turns.length` at the last failed summary attempt, if any. */
  private lastFailedSummaryAt: number | null = null;
  private summaryInFlight = false;

  constructor(deps: EngineDeps) {
    this.llm = deps.llm;
    this.repo = deps.repo;
    this.random = deps.random ?? Math.random;
    this.now = deps.now ?? (() => new Date());
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...deps.config };
  }

  /** Rolls the dice the DM asked for on behalf of enemies. Doesn't touch
      the state: the results become the input of the next turn via
      playTurn. Player rolls never go through here; the player reports
      those in the chat. */
  rollEnemyDice(state: GameState): EnemyRollResult[] {
    return state.pendingEnemyRolls.map((request) => rollForEnemy(request, this.random));
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
        if (state.pendingEnemyRolls.length > 0) return "Enemy rolls must be resolved first.";
        return input.text.trim() === "" && !input.roll ? "The action is empty." : null;
      case "enemy_rolls": {
        const pending = state.pendingEnemyRolls;
        if (pending.length === 0) return "There are no pending enemy rolls.";
        const matches =
          input.results.length === pending.length &&
          pending.every((request, i) => {
            const result = input.results[i]!;
            return (
              result.die === request.die &&
              result.count === request.count &&
              result.modifier === request.modifier &&
              result.reason === request.reason &&
              result.mode === request.mode &&
              result.values.length === diceRolled(request)
            );
          });
        return matches ? null : "The rolls don't match the ones that were requested.";
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
    const next: GameState = {
      ...applied.state,
      turns: [...state.turns, turn],
      pendingPlayerRoll: response.playerRoll,
      pendingEnemyRolls: this.chainedEnemyRolls(state, input) >= MAX_CHAINED_ENEMY_ROLLS
        ? []
        : response.enemyRolls,
      updatedAt: this.now().toISOString(),
    };

    let saveError: unknown | null = null;
    try {
      await this.repo.save(next);
    } catch (error) {
      saveError = error;
    }
    return { ok: true, state: next, response, rejectedChanges: applied.rejected, saveError };
  }

  /** How many enemy-roll turns in a row end with `input`. */
  private chainedEnemyRolls(state: GameState, input: TurnInput): number {
    if (input.type !== "enemy_rolls") return 0;
    let chained = 1;
    for (let i = state.turns.length - 1; i >= 0; i -= 1) {
      if (state.turns[i]!.input.type !== "enemy_rolls") break;
      chained += 1;
    }
    return chained;
  }

  /** Memory layer 2, run after the turn so the player never waits for it.
      Every `summaryEveryTurns` turns it folds the turns the summary doesn't
      cover yet into it. Returns null when nothing is due, when a call is
      already pending, when the model fails or answers with nothing, or when
      a failure happened fewer than SUMMARY_RETRY_AFTER_TURNS turns ago. */
  async summarizeIfDue(state: GameState): Promise<SummaryPatch | null> {
    if (this.summaryInFlight) return null;
    const pending = state.turns.slice(state.summarizedThroughTurn);
    if (pending.length < this.config.summaryEveryTurns) return null;
    if (
      this.lastFailedSummaryAt !== null &&
      state.turns.length - this.lastFailedSummaryAt < SUMMARY_RETRY_AFTER_TURNS
    ) {
      return null;
    }
    this.summaryInFlight = true;
    try {
      const summary = (
        await this.llm.generateText({
          system: SUMMARY_SYSTEM_PROMPT,
          prompt: buildSummaryPrompt(state.summary, pending),
        })
      ).trim();
      if (summary === "") {
        this.lastFailedSummaryAt = state.turns.length;
        return null;
      }
      this.lastFailedSummaryAt = null;
      return { summary, summarizedThroughTurn: state.turns.length };
    } catch {
      this.lastFailedSummaryAt = state.turns.length;
      return null;
    } finally {
      this.summaryInFlight = false;
    }
  }

  /** Applies a patch to the newest state (the player may have played more
      turns while the summary was being written) and saves. A patch that is
      not ahead of the state's own summary is ignored. */
  async applySummary(
    latest: GameState,
    patch: SummaryPatch,
  ): Promise<{ state: GameState; saveError: unknown | null }> {
    if (patch.summarizedThroughTurn <= latest.summarizedThroughTurn) {
      return { state: latest, saveError: null };
    }
    const next: GameState = {
      ...latest,
      summary: patch.summary,
      summarizedThroughTurn: patch.summarizedThroughTurn,
    };
    try {
      await this.repo.save(next);
      return { state: next, saveError: null };
    } catch (error) {
      return { state: next, saveError: error };
    }
  }
}
