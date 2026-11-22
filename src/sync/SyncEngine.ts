import type { GameState } from "../domain/types";
import type { GameRepo } from "../persistence/GameRepo";
import { migrateSave } from "../persistence/migrations";
import type { SyncBases } from "./bases";
import { reconcile } from "./reconcile";
import { AuthExpiredError, OfflineError, type RemoteGameStore } from "./RemoteGameStore";
import { syncStatus, type SyncStatus, type SyncState } from "./status";
import type { LocalEntry, SyncAction } from "./types";

export interface SyncConflict {
  id: string;
  kind: "both_changed" | "deleted_remotely";
  local: GameState | null;
  remote: GameState | null;
}

export type ConflictChoice = "local" | "remote";

interface Deps {
  local: GameRepo;
  remote: RemoteGameStore;
  bases: (accountId: string) => SyncBases;
  resolveConflict: (c: SyncConflict) => Promise<ConflictChoice>;
}

type Outcome = "downloaded" | "unchanged";

const toLocalEntry = (state: GameState): LocalEntry => ({
  id: state.id,
  updatedAt: state.updatedAt,
  turnCount: state.turns.length,
});

/**
 * Moves games between the local repo and Drive. All work runs on one promise
 * chain, so two syncs never interleave; none of the public methods reject:
 * failures only show up in `syncStatus`, and the ids involved stay pending.
 */
export class SyncEngine {
  private chain: Promise<unknown> = Promise.resolve();
  /** Ids whose last per-game sync failed or has not run yet. */
  private readonly pending = new Set<string>();
  /** Ids with a per-game sync queued but not started (collapses pushes). */
  private readonly queued = new Set<string>();
  /** State of the last failed task, shown while its ids are still pending. */
  private lastFailure: SyncState | null = null;

  constructor(private readonly deps: Deps) {}

  syncAll(): Promise<void> {
    return this.enqueue(async () => {
      const retried = [...this.pending];
      this.pending.clear();
      try {
        const bases = await this.basesForAccount();
        const [localGames, remoteEntries] = await Promise.all([this.deps.local.list(), this.deps.remote.list()]);
        const actions = reconcile(localGames.map(toLocalEntry), remoteEntries, bases.all());
        const localById = new Map(localGames.map((g) => [g.id, g]));
        for (const action of actions) await this.apply(action, bases, localById.get(action.id) ?? null);
      } catch (error) {
        for (const id of retried) this.pending.add(id);
        throw error;
      }
    }).then(() => undefined);
  }

  /** Reconciles one game; tells the caller whether local changed. */
  syncGame(id: string): Promise<Outcome> {
    this.pending.add(id);
    return this.enqueue(() => this.syncOne(id)).then((outcome) => outcome ?? "unchanged");
  }

  /** Uploads the game in the background. One run queued per id at most; it
      reads the local state when it starts, so it always pushes the newest. */
  schedulePush(id: string): void {
    this.pending.add(id);
    this.queueOne(id);
  }

  /** Called after the local delete: the per-game sync sees "local missing,
      base present" and tombstones. The base stays until the tombstone lands. */
  deleteEverywhere(id: string): void {
    this.pending.add(id);
    this.queueOne(id);
  }

  /** Runs everything pending, then resolves (never rejects). */
  async flush(): Promise<void> {
    for (const id of this.pending) this.queueOne(id);
    await this.chain;
  }

  private queueOne(id: string): void {
    if (this.queued.has(id)) return;
    this.queued.add(id);
    void this.enqueue(() => {
      this.queued.delete(id);
      return this.syncOne(id);
    });
  }

  /** Chains `task` after the previous one. The returned promise resolves with
      the task's result, or undefined when it failed (status already set). */
  private enqueue<T>(task: () => Promise<T>): Promise<T | undefined> {
    const run = this.chain.then(async () => {
      setStatus({ state: "syncing" });
      try {
        const result = await task();
        this.settleStatus();
        return result;
      } catch (error) {
        this.lastFailure = failureState(error);
        setStatus({ state: this.lastFailure });
        return undefined;
      }
    });
    // Belt and braces: nothing may reject the chain, or every later task is skipped.
    this.chain = run.catch(() => undefined);
    return this.chain as Promise<T | undefined>;
  }

  /** After a success: "idle" only when nothing is left to send. */
  private settleStatus(): void {
    if (this.pending.size === 0) {
      this.lastFailure = null;
      setStatus({ state: "idle", lastSyncedAt: new Date().toISOString() });
    } else if (this.queued.size > 0) {
      setStatus({ state: "syncing" });
    } else {
      setStatus({ state: this.lastFailure ?? "error" });
    }
  }

  private async syncOne(id: string): Promise<Outcome> {
    this.pending.delete(id);
    try {
      const bases = await this.basesForAccount();
      // Re-read Drive right before writing: if it moved since the base, this
      // turns into a download or a conflict instead of a blind upload.
      const [state, remoteEntries] = await Promise.all([this.deps.local.load(id), this.deps.remote.list()]);
      const remote = remoteEntries.filter((r) => r.id === id);
      const actions = reconcile(state ? [toLocalEntry(state)] : [], remote, pick(bases.all(), id));
      let outcome: Outcome = "unchanged";
      for (const action of actions) {
        if ((await this.apply(action, bases, state)) === "downloaded") outcome = "downloaded";
      }
      return outcome;
    } catch (error) {
      this.pending.add(id);
      throw error;
    }
  }

  private async basesForAccount(): Promise<SyncBases> {
    return this.deps.bases(await this.deps.remote.accountId());
  }

  /** `seen` is the local state the action was decided on. */
  private async apply(action: SyncAction, bases: SyncBases, seen: GameState | null): Promise<Outcome> {
    const { id } = action;
    switch (action.type) {
      case "upload":
        return this.upload(id, bases);
      case "download":
        return this.download(id, bases, seen);
      case "delete_local":
        await this.deleteLocal(id, seen);
        return "unchanged";
      case "tombstone":
        await this.deps.remote.tombstone(id);
        bases.forget(id);
        return "unchanged";
      case "forget_base":
        // After a delete_local the guard may have kept the game: keep its base too.
        if (!(await this.deps.local.load(id))) bases.forget(id);
        return "unchanged";
      case "mark_synced":
        bases.set(id, action.updatedAt);
        return "unchanged";
      case "conflict":
        return this.conflict(id, action.kind, bases, seen);
    }
  }

  private async upload(id: string, bases: SyncBases): Promise<Outcome> {
    // Push what is on disk now: a save made after the decision is newer still,
    // and a game deleted meanwhile must not come back (its own sync tombstones it).
    const state = await this.deps.local.load(id);
    if (!state) return "unchanged";
    await this.deps.remote.put(state);
    bases.set(id, state.updatedAt);
    return "unchanged";
  }

  private async download(id: string, bases: SyncBases, seen: GameState | null): Promise<Outcome> {
    const state = await this.readRemote(id);
    if (!state) return "unchanged"; // missing, or from an unknown version: leave local alone
    if (!(await this.localUnchangedSince(id, seen))) return "unchanged"; // a newer save will push
    await this.deps.local.save(state);
    bases.set(id, state.updatedAt);
    return "downloaded";
  }

  private async deleteLocal(id: string, seen: GameState | null): Promise<boolean> {
    if (!(await this.localUnchangedSince(id, seen))) return false;
    await this.deps.local.delete(id);
    return true;
  }

  private async conflict(
    id: string,
    kind: SyncConflict["kind"],
    bases: SyncBases,
    seen: GameState | null,
  ): Promise<Outcome> {
    const remote = kind === "both_changed" ? await this.readRemote(id) : null;
    // Never offer (or upload over) a remote save this version can't read.
    if (kind === "both_changed" && !remote) return "unchanged";
    const choice = await this.deps.resolveConflict({ id, kind, local: seen, remote });
    if (choice === "local") return this.upload(id, bases);
    if (kind === "both_changed") return this.download(id, bases, seen);
    if (await this.deleteLocal(id, seen)) bases.forget(id);
    return "unchanged";
  }

  private async readRemote(id: string): Promise<GameState | null> {
    return migrateSave(await this.deps.remote.get(id));
  }

  /** Guards local writes against a save that landed while Drive was answering.
      Best-effort: a save inside this single IndexedDB round trip can still race. */
  private async localUnchangedSince(id: string, seen: GameState | null): Promise<boolean> {
    const now = await this.deps.local.load(id);
    return (now?.updatedAt ?? null) === (seen?.updatedAt ?? null);
  }
}

/** A throwing status listener must not break syncing. */
function setStatus(patch: Partial<SyncStatus>): void {
  try {
    syncStatus.set(patch);
  } catch {
    // The listener's bug is its own; the status value is already updated.
  }
}

function pick(bases: Record<string, string>, id: string): Record<string, string> {
  return id in bases ? { [id]: bases[id]! } : {};
}

function failureState(error: unknown) {
  if (error instanceof OfflineError) return "offline" as const;
  if (error instanceof AuthExpiredError) return "reconnect" as const;
  return "error" as const;
}
