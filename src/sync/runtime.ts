import { IndexedDBGameRepo } from "../persistence/IndexedDBGameRepo";
import type { GameRepo } from "../persistence/GameRepo";
import { clearAllBases, SyncBases } from "./bases";
import { BrowserDriveAuth } from "./BrowserDriveAuth";
import { showConflictDialog } from "./conflictDialog";
import { ConflictPendingError } from "./errors";
import { loadSyncConfig, saveSyncConfig } from "./config";
import type { DriveAuth } from "./DriveAuth";
import { DriveGameStore } from "./DriveGameStore";
import { gisCodeApi, gisTokenApi, loadGis } from "./gis";
import { ServerDriveAuth } from "./ServerDriveAuth";
import { SyncedGameRepo } from "./SyncedGameRepo";
import { SyncEngine, type ConflictChoice, type SyncConflict } from "./SyncEngine";
import { syncStatus } from "./status";

export interface SyncRuntime {
  auth: DriveAuth;
  engine: SyncEngine;
  repo: GameRepo;
  /** The Drive account the bases are keyed by. */
  accountId: () => Promise<string>;
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

const clientId = (): string => import.meta.env.PUBLIC_GOOGLE_CLIENT_ID ?? "";

/** Sync exists only in builds with a Google client id; without one everything behaves as before. */
export function syncAvailable(): boolean {
  return clientId() !== "";
}

/** The auth for a mode (auto-renewal through the server, or browser-only). Starts loading GIS. */
export function createDriveAuth(autoRenew: boolean): DriveAuth {
  const startLoad = () => void loadGis().catch(() => undefined);
  startLoad();
  /** Not loaded yet (or the load failed): this gesture fails fast, the next one finds it. */
  const loaded = <T>(api: () => T) => () => {
    startLoad();
    return api();
  };
  if (autoRenew) return new ServerDriveAuth({ clientId: clientId(), gis: loaded(gisCodeApi) });
  return new BrowserDriveAuth({ clientId: clientId(), gis: loaded(gisTokenApi) });
}

let runtime: SyncRuntime | null = null;
let pageListeners = false;

/** One per page; null when sync is off (not cached, so turning it on takes effect). */
export function getSyncRuntime(): SyncRuntime | null {
  if (runtime) return runtime;
  if (!syncAvailable()) return null;
  const config = loadSyncConfig();
  if (!config.enabled) return null;
  return startSyncRuntime(createDriveAuth(config.autoRenew));
}

/**
 * Builds the page's runtime around `auth`, replacing any previous one. After
 * a connect, pass the auth that just connected: its token is the only one
 * there is, and a fresh auth would need another gesture right away. The
 * caller saves the config.
 */
export function startSyncRuntime(auth: DriveAuth): SyncRuntime {
  conflictResolver ??= showConflictDialog;
  const local = new IndexedDBGameRepo();
  const remote = new DriveGameStore(() => auth.getAccessToken());
  const engine = new SyncEngine({
    local,
    remote,
    bases: (accountId) => new SyncBases(accountId),
    resolveConflict,
  });
  if (!pageListeners) {
    pageListeners = true;
    // "I close the laptop and leave": push what is pending when the page hides or the network returns.
    window.addEventListener("online", () => void runtime?.engine.flush());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void runtime?.engine.flush();
    });
  }
  runtime?.engine.retire();
  runtime = { auth, engine, repo: new SyncedGameRepo(local, engine), accountId: () => remote.accountId() };
  return runtime;
}

/** Forgets the page's runtime (after a disconnect); the next getSyncRuntime reads the config again. */
export function resetSyncRuntime(): void {
  runtime?.engine.retire();
  runtime = null;
  syncStatus.set({ state: "off", lastSyncedAt: null });
}

const ACCOUNT_TIMEOUT_MS = 3000;

/**
 * "Desconectar": revokes, forgets this account's bases (so a reconnect acts
 * like a first connection and nothing deleted meanwhile propagates) and turns
 * sync off. Leaves every local and Drive copy in place. When the account
 * cannot be told in time, every account's bases go: that is only ever safer.
 */
export async function disconnectSync(sync: SyncRuntime): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const accountId = await Promise.race([
    sync.accountId().catch(() => null),
    new Promise<null>((resolve) => (timer = setTimeout(() => resolve(null), ACCOUNT_TIMEOUT_MS))),
  ]);
  clearTimeout(timer);
  await sync.auth.disconnect();
  if (accountId) new SyncBases(accountId).clearAccount();
  else clearAllBases();
  saveSyncConfig({ enabled: false, autoRenew: false });
  if (runtime === sync) resetSyncRuntime();
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
