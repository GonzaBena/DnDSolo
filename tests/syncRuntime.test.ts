import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadSyncConfig, saveSyncConfig } from "../src/sync/config";
import { SyncBases } from "../src/sync/bases";
import type { DriveAuth } from "../src/sync/DriveAuth";
import {
  disconnectSync,
  getSyncRuntime,
  resetSyncRuntime,
  startSyncRuntime,
  syncAvailable,
} from "../src/sync/runtime";
import { syncStatus } from "../src/sync/status";

let store: Map<string, string>;
/** Module state: the runtime registers its page listeners once per page, so this outlives each test. */
const windowListeners = new Map<string, Array<() => void>>();

function fakeAuth(): DriveAuth & { disconnect: ReturnType<typeof vi.fn> } {
  return {
    getAccessToken: vi.fn(async () => "token"),
    needsGesture: () => false,
    renewWithGesture: async () => true,
    connect: async () => true,
    disconnect: vi.fn(async () => undefined),
  };
}

beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  vi.stubGlobal("window", {
    addEventListener: (type: string, fn: () => void) => {
      windowListeners.set(type, [...(windowListeners.get(type) ?? []), fn]);
    },
  });
  vi.stubGlobal("document", { addEventListener: () => undefined, visibilityState: "visible" });
  vi.stubEnv("PUBLIC_GOOGLE_CLIENT_ID", "cid");
  resetSyncRuntime();
});
afterEach(() => {
  resetSyncRuntime();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("sync runtime lifecycle", () => {
  it("is off without a client id even when the config says enabled", () => {
    vi.stubEnv("PUBLIC_GOOGLE_CLIENT_ID", "");
    saveSyncConfig({ enabled: true, autoRenew: false });
    expect(syncAvailable()).toBe(false);
    expect(getSyncRuntime()).toBeNull();
  });

  it("startSyncRuntime keeps the auth that just connected, and getSyncRuntime returns it", () => {
    saveSyncConfig({ enabled: true, autoRenew: false });
    const auth = fakeAuth();
    const sync = startSyncRuntime(auth);
    expect(sync.auth).toBe(auth);
    expect(getSyncRuntime()).toBe(sync);
  });

  it("resetSyncRuntime drops the cached runtime and turns the status off", () => {
    startSyncRuntime(fakeAuth());
    syncStatus.set({ state: "idle", lastSyncedAt: "2026-01-01T00:00:00Z" });
    resetSyncRuntime();
    expect(getSyncRuntime()).toBeNull(); // config is still disabled
    expect(syncStatus.get()).toEqual({ state: "off", lastSyncedAt: null });
  });

  it("registers the page listeners once and flushes only the current runtime", () => {
    const first = startSyncRuntime(fakeAuth());
    const second = startSyncRuntime(fakeAuth());
    const firstFlush = vi.spyOn(first.engine, "flush").mockResolvedValue();
    const secondFlush = vi.spyOn(second.engine, "flush").mockResolvedValue();
    expect(windowListeners.get("online")).toHaveLength(1);
    windowListeners.get("online")![0]!();
    expect(firstFlush).not.toHaveBeenCalled();
    expect(secondFlush).toHaveBeenCalledTimes(1);
  });
});

describe("disconnectSync", () => {
  it("disconnects, forgets this account's bases only, and turns sync off", async () => {
    saveSyncConfig({ enabled: true, autoRenew: true });
    new SyncBases("acc1").set("g1", "t1");
    new SyncBases("acc2").set("g2", "t2");
    const auth = fakeAuth();
    const sync = startSyncRuntime(auth);
    sync.accountId = async () => "acc1";

    await disconnectSync(sync);

    expect(auth.disconnect).toHaveBeenCalledTimes(1);
    expect(new SyncBases("acc1").all()).toEqual({});
    expect(new SyncBases("acc2").all()).toEqual({ g2: "t2" });
    expect(loadSyncConfig()).toEqual({ enabled: false, autoRenew: false });
    expect(getSyncRuntime()).toBeNull();
  });

  it("forgets every account's bases when the account cannot be told", async () => {
    saveSyncConfig({ enabled: true, autoRenew: false });
    new SyncBases("acc1").set("g1", "t1");
    new SyncBases("acc2").set("g2", "t2");
    const sync = startSyncRuntime(fakeAuth());
    sync.accountId = async () => {
      throw new Error("offline");
    };

    await disconnectSync(sync);

    expect(new SyncBases("acc1").all()).toEqual({});
    expect(new SyncBases("acc2").all()).toEqual({});
    expect(loadSyncConfig().enabled).toBe(false);
  });

  it("does not wait forever for the account id", async () => {
    vi.useFakeTimers();
    try {
      new SyncBases("acc1").set("g1", "t1");
      const sync = startSyncRuntime(fakeAuth());
      sync.accountId = () => new Promise<string>(() => undefined);
      let done = false;
      void disconnectSync(sync).then(() => (done = true));
      await vi.advanceTimersByTimeAsync(3000);
      expect(done).toBe(true);
      expect(new SyncBases("acc1").all()).toEqual({});
    } finally {
      vi.useRealTimers();
    }
  });
});
