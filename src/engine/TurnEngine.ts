import { renameNpc } from "../domain/npcRename";
import { arrivalsOf } from "../domain/arrivals";
import { chapterOf } from "../domain/chapters";
import { momentsOf } from "../domain/moments";
import { deriveEvents } from "../domain/turnEvents";
import { applyStateChanges, type RejectedChange } from "../domain/applyChanges";
import { applyDeathSave } from "../domain/deathSaves";
import { diceRolled, rollForEnemy } from "../domain/dice";
import {
  dmResponseJsonSchema,
  dmResponseJsonSchemaNoSuggestions,
  parseDMResponse, parseSuggestions, suggestionsJsonSchema } from "../domain/schemas";
import type {
  DMResponse,
  EnemyRollResult,
  Character,
  GameState,
  Turn,
  TurnEvent,
  TurnInput,
} from "../domain/types";
import { LLMError, type LLMClient } from "../llm/LLMClient";
import type { GameRepo } from "../persistence/GameRepo";
import {
  buildSummaryPrompt,
  buildCorrection,
  buildTurnPrompt,
  buildDmSystemPrompt,
  SUMMARY_SYSTEM_PROMPT,
  SUGGESTIONS_SYSTEM_PROMPT,
  buildSuggestionsPrompt,
} from "./dmPrompt";
import { extractPartialNarration } from "./narrationStream";

export interface EngineConfig {
  /** How many of the latest turns are sent verbatim. */
  recentTurns: number;
  /** The running summary is regenerated every this many turns. */
  summaryEveryTurns: number;
  /** Whether the DM writes suggestions: false when the player hides them. */
  suggestions: boolean;
}

/** After a failed summary, how many more turns to wait before trying again. */
export const SUMMARY_RETRY_AFTER_TURNS = 3;

export interface SummaryPatch {
  summary: string;
  summarizedThroughTurn: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = { recentTurns: 6, summaryEveryTurns: 10, suggestions: true };

/** Enemy-roll turns are sent without the player doing anything, so a DM
    that kept asking for more would loop forever. After this many in a row
    further requests are dropped and the turn goes back to the player. */
export const MAX_CHAINED_ENEMY_ROLLS = 3;

export interface EngineDeps {
  llm: LLMClient;
  /** Optional lighter client used for summaries and on-demand suggestions. */
  auxiliaryLlm?: LLMClient;
  repo: GameRepo;
  random?: () => number;
  now?: () => Date;
  config?: Partial<EngineConfig>;
  /** Backoff before retrying a transient rate-limit/network/timeout failure. */
  transientRetryDelayMs?: number;
}

const DEFAULT_TRANSIENT_RETRY_DELAY_MS = 1200;

function isTransientLLMError(cause: unknown): boolean {
  return cause instanceof LLMError && (cause.kind === "rate_limit" || cause.kind === "network" || cause.kind === "timeout");
}

function waitWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0 || signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export type TurnFailure =
  /** The input doesn't fit the game's situation (e.g. acting while a roll is pending). */
  | { kind: "invalid_input"; message: string }
  /** The model answered twice with something that doesn't match the schema. */
  | { kind: "invalid_response"; message: string }
  /** The call itself failed (key, network, quota...). */
  | { kind: "llm"; message: string; cause: unknown }
  /** The player cut the response short; never retried, nothing saved. */
  | { kind: "aborted" };

export type TurnOutcome =
  | {
      ok: true;
      state: GameState;
      response: DMResponse;
      /** What happened this turn, derived from the state (see deriveEvents). */
      events: TurnEvent[];
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
  private readonly auxiliaryLlm: LLMClient;
  private readonly repo: GameRepo;
  private readonly random: () => number;
  private readonly now: () => Date;
  private readonly transientRetryDelayMs: number;
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
    this.auxiliaryLlm = deps.auxiliaryLlm ?? deps.llm;
    this.repo = deps.repo;
    this.random = deps.random ?? Math.random;
    this.now = deps.now ?? (() => new Date());
    this.transientRetryDelayMs = deps.transientRetryDelayMs ?? DEFAULT_TRANSIENT_RETRY_DELAY_MS;
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
   * @param signal aborts the model call, or the wait in `beforeCommit`;
   *   an aborted turn is never retried and leaves nothing saved.
   * @param beforeCommit awaited once a reply parses, before the turn is
   *   committed and saved.
   */
  async playTurn(
    state: GameState,
    input: TurnInput,
    onNarration?: (narrationSoFar: string) => void,
    signal?: AbortSignal,
    beforeCommit?: () => Promise<void>,
  ): Promise<TurnOutcome> {
    const inputProblem = this.checkInput(state, input);
    if (inputProblem) {
      return { ok: false, state, failure: { kind: "invalid_input", message: inputProblem } };
    }

    // Decided once so the prompt and the drop in commit can't disagree.
    const enemyRollsAllowed = this.chainedEnemyRolls(state, input) < MAX_CHAINED_ENEMY_ROLLS;
    // A death save is resolved by code first: the DM narrates the outcome it is sent.
    const prompt = buildTurnPrompt(resolveInput(state, input), input, this.config.recentTurns, {
      enemyRollsAllowed,
    });

    // One retry on malformed output (Spec, rule 2), plus at most one backoff
    // retry on transient rate-limit, network or timeout failures.
    let lastReason = "";
    let attempt = 0;
    let transientRetried = false;
    while (attempt < 2) {
      let raw = "";
      if (signal?.aborted) return { ok: false, state, failure: { kind: "aborted" } };
      if (attempt > 0 || transientRetried) onNarration?.("");
      try {
        raw = await this.llm.generateStructured({
          system: buildDmSystemPrompt({ suggestions: this.config.suggestions }),
          prompt: attempt > 0 ? `${prompt}\n\n${buildCorrection(lastReason)}` : prompt,
          jsonSchema: this.config.suggestions ? dmResponseJsonSchema : dmResponseJsonSchemaNoSuggestions,
          creative: true,
          signal,
          onChunk: (fragment) => {
            raw += fragment;
            onNarration?.(extractPartialNarration(raw));
          },
        });
      } catch (cause) {
        // The SDK may wrap the abort in any error, so the signal decides too.
        if (signal?.aborted || (cause instanceof LLMError && cause.kind === "aborted")) {
          return { ok: false, state, failure: { kind: "aborted" } };
        }
        if (!transientRetried && isTransientLLMError(cause)) {
          transientRetried = true;
          await waitWithAbort(this.transientRetryDelayMs, signal);
          if (signal?.aborted) return { ok: false, state, failure: { kind: "aborted" } };
          continue;
        }
        const message = cause instanceof Error ? cause.message : String(cause);
        return { ok: false, state, failure: { kind: "llm", message, cause } };
      }

      // A stream cut by the abort may end without throwing and hand back
      // partial text: that is not a malformed reply, so don't retry it.
      if (signal?.aborted) return { ok: false, state, failure: { kind: "aborted" } };

      const parsed = parseDMResponse(raw);
      if (!parsed.ok) {
        lastReason = parsed.reason;
        attempt += 1;
        continue;
      }
      // Lets the UI finish revealing the text; a Stop in that window
      // discards the turn, so nothing is committed or saved before it.
      try {
        await beforeCommit?.();
      } catch (cause) {
        if (signal?.aborted) return { ok: false, state, failure: { kind: "aborted" } };
        throw cause;
      }
      if (signal?.aborted) return { ok: false, state, failure: { kind: "aborted" } };
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
        if (findSaver(state, input.playerId)?.condition === "dead") return "That character is dead.";
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
      case "death_save": {
        if (state.turns.length === 0) return "The game hasn't started yet.";
        if (state.pendingEnemyRolls.length > 0) return "Enemy rolls must be resolved first.";
        if (!Number.isInteger(input.natural) || input.natural < 1 || input.natural > 20) {
          return "A death save is a natural d20 between 1 and 20.";
        }
        const player = findSaver(state, input.playerId);
        return player?.condition === "dying" ? null : "That character is not dying.";
      }
    }
  }

  private async commit(
    state: GameState,
    input: TurnInput,
    response: DMResponse,
    enemyRollsAllowed: boolean,
  ): Promise<TurnOutcome> {
    // An in-place correction (adjustHp) may be newer than the state the
    // caller holds, with the same turns: apply on top of it, not over it.
    const known = this.latestByGame.get(state.id);
    const base = known && known.turns.length === state.turns.length ? known : state;
    const applied = applyStateChanges(resolveInput(base, input), response.stateChanges);
    const arrivals = arrivalsOf(base, applied.state);
    const chapter = chapterOf(base, applied.state);
    const moments = momentsOf(base, applied.state);
    const events = deriveEvents(base, applied.state, response.stateChanges);
    const turn: Turn = {
      number: state.turns.length + 1,
      input,
      narration: response.narration,
      events,
      ...(arrivals.length > 0 ? { arrivals } : {}),
      ...(chapter ? { chapter } : {}),
      ...(moments.length > 0 ? { moments } : {}),
    };
    // Nobody can answer a roll while unconscious or dead: death saves are asked by the system.
    const canRoll = applied.state.players.some((p) => p.condition === "ok");
    let next: GameState = {
      ...applied.state,
      turns: [...state.turns, turn],
      pendingPlayerRoll: canRoll ? response.playerRoll : null,
      pendingEnemyRolls: enemyRollsAllowed ? response.enemyRolls : [],
      // Nothing to suggest while a roll is pending: the player only answers it.
      suggestedActions:
        response.playerRoll || (enemyRollsAllowed && response.enemyRolls.length > 0) ? [] : response.suggestions,
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
    return { ok: true, state: next, response, events, rejectedChanges: applied.rejected, saveError };
  }

  /** Manual hit point fix from the sheet panel. It is not a turn, so nothing
      goes to the model and `turns` doesn't change. Applied on the newest
      state this engine knows, so it neither loses nor overwrites a turn or
      a summary that landed meanwhile. A rejected change (no stats) leaves
      the state as is. `before` is the state the fix was applied on. */
  async adjustHp(
    given: GameState,
    playerId: string,
    delta: number,
  ): Promise<{ state: GameState; saveError: unknown | null; before: GameState }> {
    const tracked = this.latestByGame.get(given.id);
    const base = tracked && tracked.turns.length >= given.turns.length ? tracked : given;
    // A correction is not damage taken: at 0 HP it never counts as a failed death save.
    const player = findSaver(base, playerId);
    if (delta < 0 && player?.currentHp === 0) return { state: base, saveError: null, before: base };
    const applied = applyStateChanges(base, [{ type: "hp", target: playerId, delta }]);
    if (applied.rejected.length > 0) return { state: base, saveError: null, before: base };
    const next: GameState = { ...applied.state, updatedAt: this.now().toISOString() };
    this.latestByGame.set(next.id, next);
    return { state: next, saveError: await this.enqueueSave(next), before: base };
  }

  /** Replaces one player (a level up's choices, an upgraded sheet) and saves,
      without a turn. On top of the newest known state, like adjustHp. */
  async updatePlayer(
    given: GameState,
    playerId: string,
    update: (player: Character) => Character,
  ): Promise<{ state: GameState; saveError: unknown | null }> {
    const tracked = this.latestByGame.get(given.id);
    const base = tracked && tracked.turns.length >= given.turns.length ? tracked : given;
    if (!base.players.some((p) => p.id === playerId)) return { state: given, saveError: null };
    const next: GameState = {
      ...base,
      players: base.players.map((p) => (p.id === playerId ? update(p) : p)),
      updatedAt: this.now().toISOString(),
    };
    this.latestByGame.set(next.id, next);
    return { state: next, saveError: await this.enqueueSave(next) };
  }

  /** Applies a manual state correction outside a turn and saves it. */
  async updateState(
    given: GameState,
    update: (state: GameState) => GameState,
  ): Promise<{ state: GameState; saveError: unknown | null }> {
    const tracked = this.latestByGame.get(given.id);
    const base = tracked && tracked.turns.length >= given.turns.length ? tracked : given;
    const next: GameState = { ...update(base), updatedAt: this.now().toISOString() };
    this.latestByGame.set(next.id, next);
    return { state: next, saveError: await this.enqueueSave(next) };
  }

  /** Renames an NPC and sets their label (see renameNpc), saving without a
      turn, on top of the newest known state like updatePlayer. */
  async renameNpc(
    given: GameState,
    currentName: string,
    newName: string,
    label: string,
  ): Promise<{ state: GameState; saveError: unknown | null } | { error: string }> {
    const tracked = this.latestByGame.get(given.id);
    const base = tracked && tracked.turns.length >= given.turns.length ? tracked : given;
    const result = renameNpc(base, currentName, newName, label);
    if (!result.ok) return { error: result.message };
    const next: GameState = { ...result.state, updatedAt: this.now().toISOString() };
    this.latestByGame.set(next.id, next);
    return { state: next, saveError: await this.enqueueSave(next) };
  }

  /** Restores a previous state snapshot (e.g. undoing or regenerating the last turn)
      and persists it through the serialized save chain. */
  async restoreState(snapshot: GameState): Promise<{ state: GameState; saveError: unknown | null }> {
    const next: GameState = { ...snapshot, updatedAt: this.now().toISOString() };
    this.latestByGame.set(next.id, next);
    return { state: next, saveError: await this.enqueueSave(next) };
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

  /** Suggestions for an old save, opened without any because it is from
      before they existed. One small call that saves nothing; [] when the
      model fails, so the game just shows none. */
  async suggestFor(state: GameState, signal?: AbortSignal): Promise<string[]> {
    if (state.turns.length === 0) return [];
    try {
      const raw = await this.auxiliaryLlm.generateStructured({
        system: SUGGESTIONS_SYSTEM_PROMPT,
        prompt: buildSuggestionsPrompt(state, this.config.recentTurns),
        jsonSchema: suggestionsJsonSchema,
        creative: true,
        signal,
      });
      return parseSuggestions(raw);
    } catch {
      return [];
    }
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
        await this.auxiliaryLlm.generateText({
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
    // Already summarized further, or a patch about turns this game doesn't
    // have (only a direct caller could build one): nothing to apply.
    if (
      base.summarizedThroughTurn >= patch.summarizedThroughTurn ||
      patch.summarizedThroughTurn > base.turns.length
    ) {
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

/** The player a death save or an action belongs to; a lone player is always meant. */
function findSaver(state: GameState, playerId: string | undefined) {
  return state.players.find((p) => p.id === playerId) ?? (state.players.length === 1 ? state.players[0] : undefined);
}

/** The state once code has resolved what the input itself decides (a death save). */
function resolveInput(state: GameState, input: TurnInput): GameState {
  if (input.type !== "death_save") return state;
  const saver = findSaver(state, input.playerId);
  if (!saver) return state;
  return {
    ...state,
    players: state.players.map((p) => (p === saver ? applyDeathSave(p, input.natural) : p)),
  };
}
