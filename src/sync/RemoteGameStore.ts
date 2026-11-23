import type { GameState } from "../domain/types";
import type { RemoteEntry } from "./types";

/** Drive answered 401: the token is no longer valid. */
export class AuthExpiredError extends Error {}
/** The request never reached Drive (network failure). */
export class OfflineError extends Error {}

export interface RemoteGameStore {
  /** Stable identifier of the remote account, used to scope sync bases. */
  accountId(): Promise<string>;
  list(): Promise<RemoteEntry[]>;
  /** Raw JSON of the game; null if missing or tombstoned. */
  get(id: string): Promise<unknown | null>;
  put(state: GameState): Promise<void>;
  tombstone(id: string): Promise<void>;
}
