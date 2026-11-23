import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadSyncConfig, saveSyncConfig } from "../src/sync/config";
import { SyncBases } from "../src/sync/bases";
import { syncStatus } from "../src/sync/status";

let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("sync config", () => {
  it("defaults to disabled when missing", () => {
    expect(loadSyncConfig()).toEqual({ enabled: false, autoRenew: false });
  });
  it("defaults to disabled when corrupt", () => {
    store.set("dnsolo.sync", "{bad");
    expect(loadSyncConfig()).toEqual({ enabled: false, autoRenew: false });
  });
  it("defaults to disabled when storage is blocked", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(loadSyncConfig()).toEqual({ enabled: false, autoRenew: false });
    expect(() => saveSyncConfig({ enabled: true, autoRenew: true })).not.toThrow();
  });
  it("round-trips", () => {
    saveSyncConfig({ enabled: true, autoRenew: true });
    expect(loadSyncConfig()).toEqual({ enabled: true, autoRenew: true });
  });
});

describe("SyncBases", () => {
  it("keeps accounts isolated", () => {
    new SyncBases("a").set("g1", "t1");
    expect(new SyncBases("a").all()).toEqual({ g1: "t1" });
    expect(new SyncBases("b").all()).toEqual({});
  });
  it("forgets one game", () => {
    const a = new SyncBases("a");
    a.set("g1", "t1");
    a.set("g2", "t2");
    a.forget("g1");
    expect(a.all()).toEqual({ g2: "t2" });
  });
  it("clearAccount leaves other accounts intact", () => {
    new SyncBases("a").set("g1", "t1");
    new SyncBases("b").set("g2", "t2");
    new SyncBases("a").clearAccount();
    expect(new SyncBases("a").all()).toEqual({});
    expect(new SyncBases("b").all()).toEqual({ g2: "t2" });
  });
  it("tolerates corrupt storage", () => {
    store.set("dnsolo.sync.bases", "{bad");
    const a = new SyncBases("a");
    expect(a.all()).toEqual({});
    a.set("g1", "t1");
    expect(a.all()).toEqual({ g1: "t1" });
  });
});

describe("syncStatus", () => {
  it("notifies with the merged status until unsubscribed", () => {
    const seen: unknown[] = [];
    const unsubscribe = syncStatus.subscribe((s) => seen.push(s));
    syncStatus.set({ state: "syncing" });
    syncStatus.set({ lastSyncedAt: "t" });
    expect(seen).toEqual([
      { state: "syncing", lastSyncedAt: null },
      { state: "syncing", lastSyncedAt: "t" },
    ]);
    unsubscribe();
    syncStatus.set({ state: "idle" });
    expect(seen).toHaveLength(2);
  });
});
