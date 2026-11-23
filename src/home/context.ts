import type { GameRepo } from "../persistence/GameRepo";
import type { SyncRuntime } from "../sync/runtime";

/** What the home's pieces share. */
export interface HomeContext {
  repo: GameRepo;
  /** Null when sync is off: then the page works exactly as without sync. */
  sync: SyncRuntime | null;
  /** Re-reads the saves and redraws the page; rejects when they can't be read. */
  refresh(): Promise<void>;
  /** refresh(), showing an error instead of rejecting. */
  refreshSafely(): Promise<void>;
  /** The status line under the page. */
  report(message: string, tone: "ok" | "error"): void;
}
