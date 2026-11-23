import type { GameState } from "../domain/types";
import type { RemoteGameStore } from "./RemoteGameStore";
import type { RemoteEntry } from "./types";

interface Stored {
  entry: RemoteEntry;
  raw: unknown;
}

/** Test double that follows the Drive store semantics. */
export class InMemoryRemoteGameStore implements RemoteGameStore {
  private games = new Map<string, Stored>();
  private nextError: Error | null = null;

  /** The next call of any method rejects with this error, once. */
  failNext(error: Error): void {
    this.nextError = error;
  }

  private async guard(): Promise<void> {
    const error = this.nextError;
    this.nextError = null;
    if (error) throw error;
  }

  async accountId(): Promise<string> {
    await this.guard();
    return "in-memory-account";
  }

  async list(): Promise<RemoteEntry[]> {
    await this.guard();
    return [...this.games.values()].map((s) => ({ ...s.entry }));
  }

  async get(id: string): Promise<unknown | null> {
    await this.guard();
    const stored = this.games.get(id);
    if (!stored || stored.entry.deleted) return null;
    return JSON.parse(JSON.stringify(stored.raw));
  }

  async put(state: GameState): Promise<void> {
    await this.guard();
    this.games.set(state.id, {
      entry: {
        id: state.id,
        updatedAt: state.updatedAt,
        turnCount: state.turns.length,
        deleted: false,
      },
      raw: JSON.parse(JSON.stringify(state)),
    });
  }

  async tombstone(id: string): Promise<void> {
    await this.guard();
    const now = new Date().toISOString();
    this.games.set(id, {
      entry: { id, updatedAt: now, turnCount: 0, deleted: true },
      raw: { deleted: true, deletedAt: now },
    });
  }
}
