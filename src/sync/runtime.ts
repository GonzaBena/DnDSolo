import { IndexedDBGameRepo } from "../persistence/IndexedDBGameRepo";
import type { GameRepo } from "../persistence/GameRepo";
import { SyncBases } from "./bases";
import { BrowserDriveAuth } from "./BrowserDriveAuth";
import { showConflictDialog } from "./conflictDialog";
import { ConflictPendingError } from "./errors";
import { loadSyncConfig, type SyncConfig } from "./config";
import type { DriveAuth } from "./DriveAuth";
import { DriveGameStore } from "./DriveGameStore";
import { gisCodeApi, gisTokenApi, loadGis } from "./gis";
import { ServerDriveAuth } from "./ServerDriveAuth";
import { SyncedGameRepo } from "./SyncedGameRepo";
import { SyncEngine, type ConflictChoice, type SyncConflict } from "./SyncEngine";

export interface SyncRuntime {
  auth: DriveAuth;
  engine: SyncEngine;
  repo: GameRepo;
}

export { ConflictPendingError };

type ConflictResolver = (c: SyncConflict) => Promise<ConflictChoice>;

let conflictResolver: ConflictResolver | null = null;

/** The page's conflict dialog registers here; null unregisters it. */
export function setConflictResolver(fn: ConflictResolver | null): void {
  conflictResolver = fn;
}

/** What the engine calls: never picks a side by itself. */
export function resolveConflict(c: SyncConflict): Promise<ConflictChoice> {
  if (!conflictResolver) return Promise.reject(new ConflictPendingError(`Conflict on ${c.id} left for later`));
  return conflictResolver(c);
}

function createAuth(config: SyncConfig): DriveAuth {
  const startLoad = () => void loadGis().catch(() => undefined);
  startLoad();
  /** Not loaded yet (or the load failed): this gesture fails fast, the next one finds it. */
  const loaded = <T>(api: () => T) => () => {
    startLoad();
    return api();
  };
  const clientId = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID ?? "";
  if (config.autoRenew) return new ServerDriveAuth({ clientId, gis: loaded(gisCodeApi) });
  return new BrowserDriveAuth({ clientId, gis: loaded(gisTokenApi) });
}

let runtime: SyncRuntime | null = null;

/** One per page; null when sync is off (not cached, so turning it on takes effect). */
export function getSyncRuntime(): SyncRuntime | null {
  if (runtime) return runtime;
  const config = loadSyncConfig();
  if (!config.enabled) return null;

  conflictResolver ??= showConflictDialog;
  const auth = createAuth(config);
  const local = new IndexedDBGameRepo();
  const engine = new SyncEngine({
    local,
    remote: new DriveGameStore(() => auth.getAccessToken()),
    bases: (accountId) => new SyncBases(accountId),
    resolveConflict,
  });
  // "I close the laptop and leave": push what is pending when the page hides or the network returns.
  window.addEventListener("online", () => void engine.flush());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void engine.flush();
  });
  runtime = { auth, engine, repo: new SyncedGameRepo(local, engine) };
  return runtime;
}

export function createGameRepo(): GameRepo {
  return getSyncRuntime()?.repo ?? new IndexedDBGameRepo();
}

/**
 * Every gesture site goes through here. The Google window must open before
 * the first await (browsers block popups outside the gesture), and `run`
 * waits for it to come back: on mobile it is a tab switch that would cut a
 * stream started meanwhile. The outcome is ignored; a failed renewal only
 * leaves the upload pending.
 */
export async function withRenewal<T>(sync: SyncRuntime | null, run: () => Promise<T>): Promise<T> {
  if (sync?.auth.needsGesture()) {
    try {
      await sync.auth.renewWithGesture();
    } catch {
      // renewWithGesture resolves false on failure; this is only a guard.
    }
  }
  return run();
}
