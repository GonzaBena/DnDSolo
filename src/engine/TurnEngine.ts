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
  buildCorrection,
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
  /** Per game, `turns.length` at the last failed summary attempt. */
  private readonly lastFailedSummaryAt = new Map<string, number>();
  /** Newest state this engine committed or summarized, per game. */
  private readonly latestByGame = new Map<string, GameState>();
  /** Every save goes through here so a later call always lands last. */
  private saveChain: Promise<void> = Promise.resolve();
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

    // Decided once so the prompt and the drop in commit can't disagree.
    const enemyRollsAllowed = this.chainedEnemyRolls(state, input) < MAX_CHAINED_ENEMY_ROLLS;
    const prompt = buildTurnPrompt(state, input, this.config.recentTurns, { enemyRollsAllowed });

    // One retry on malformed output, then give up cleanly (Spec, rule 2).
    let lastReason = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let raw = "";
      if (attempt > 0) onNarration?.("");
      try {
        raw = await this.llm.generateStructured({
          system: DM_SYSTEM_PROMPT,
          prompt: attempt > 0 ? `${prompt}\n\n${buildCorrection(lastReason)}` : prompt,
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
      return this.commit(state, input, parsed.response, enemyRollsAllowed);
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
    enemyRollsAllowed: boolean,
  ): Promise<TurnOutcome> {
    const applied = applyStateChanges(state, response.stateChanges);
    const turn: Turn = {
      number: state.turns.length + 1,
      input,
      narration: response.narration,
      events: response.events,
    };
    let next: GameState = {
      ...applied.state,
      turns: [...state.turns, turn],
      pendingPlayerRoll: response.playerRoll,
      pendingEnemyRolls: enemyRollsAllowed ? response.enemyRolls : [],
      // Whose turn it is only matters while enemy rolls are pending.
      ...(enemyRollsAllowed ? {} : { scene: { ...applied.state.scene, turnOf: null } }),
      updatedAt: this.now().toISOString(),
    };

    // A summary applied while this turn was in flight must not be lost.
    const tracked = this.latestByGame.get(state.id);
    if (
      tracked &&
      tracked.summarizedThroughTurn > state.summarizedThroughTurn &&
      tracked.summarizedThroughTurn <= next.turns.length
    ) {
      next = {
        ...next,
        summary: tracked.summary,
        summarizedThroughTurn: tracked.summarizedThroughTurn,
      };
    }
    this.latestByGame.set(next.id, next);

    const saveError = await this.enqueueSave(next);
    return { ok: true, state: next, response, rejectedChanges: applied.rejected, saveError };
  }

  /** Saves after every earlier save has settled; a failure doesn't break
      the chain. Resolves to the error, or null. */
  private enqueueSave(state: GameState): Promise<unknown | null> {
    const run = this.saveChain.then(() => this.repo.save(state));
    this.saveChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run.then(
      () => null,
      (error: unknown) => error,
    );
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
  async summarizeIfDue(given: GameState): Promise<SummaryPatch | null> {
    if (this.summaryInFlight) return null;
    // Same rebase rule as applySummary: the caller may hold a stale state.
    const tracked = this.latestByGame.get(given.id);
    const state = tracked && tracked.turns.length >= given.turns.length ? tracked : given;
    const pending = state.turns.slice(state.summarizedThroughTurn);
    if (pending.length < this.config.summaryEveryTurns) return null;
    const failedAt = this.lastFailedSummaryAt.get(state.id);
    if (failedAt !== undefined && state.turns.length - failedAt < SUMMARY_RETRY_AFTER_TURNS) {
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
        this.lastFailedSummaryAt.set(state.id, state.turns.length);
        return null;
      }
      this.lastFailedSummaryAt.delete(state.id);
      return { summary, summarizedThroughTurn: state.turns.length };
    } catch {
      this.lastFailedSummaryAt.set(state.id, state.turns.length);
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
    // Rebase onto the newest state this engine knows: a turn may have been
    // committed after the one the caller still holds.
    const tracked = this.latestByGame.get(latest.id);
    const base = tracked && tracked.turns.length >= latest.turns.length ? tracked : latest;
    if (base.summarizedThroughTurn >= patch.summarizedThroughTurn) {
      return { state: base, saveError: null };
    }
    const next: GameState = {
      ...base,
      summary: patch.summary,
      summarizedThroughTurn: patch.summarizedThroughTurn,
    };
    this.latestByGame.set(next.id, next);
    return { state: next, saveError: await this.enqueueSave(next) };
  }
}
