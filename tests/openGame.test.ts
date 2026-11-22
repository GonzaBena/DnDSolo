import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syncBeforeOpen } from "../src/sync/openGame";
import { OfflineError } from "../src/sync/RemoteGameStore";
import type { SyncRuntime } from "../src/sync/runtime";

const after = <T>(ms: number, value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

function fakeSync(engine: { syncGame?: () => Promise<unknown>; syncAll?: () => Promise<void> }): SyncRuntime {
  return { auth: {}, repo: {}, engine } as unknown as SyncRuntime;
}

describe("syncBeforeOpen", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("resolves at once with no late result when sync is off", async () => {
    await expect(syncBeforeOpen(null, "g1")).resolves.toEqual({ late: null });
  });

  it("waits for a reconcile that finishes in time", async () => {
    const syncGame = vi.fn(() => after(1000, "downloaded"));
    let result: { late: unknown } | undefined;
    void syncBeforeOpen(fakeSync({ syncGame }), "g1").then((r) => (result = r));
    await vi.advanceTimersByTimeAsync(999);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toEqual({ late: null });
    expect(syncGame).toHaveBeenCalledWith("g1");
  });

  it("gives up at 3 s and hands back the late result", async () => {
    const sync = fakeSync({ syncGame: () => after(5000, "downloaded") });
    let result: { late: Promise<string> | null } | undefined;
    void syncBeforeOpen(sync, "g1").then((r) => (result = r));
    await vi.advanceTimersByTimeAsync(2999);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(result?.late).not.toBeNull();
    await vi.advanceTimersByTimeAsync(2000);
    await expect(result?.late).resolves.toBe("downloaded");
  });

  it("does not throw when offline", async () => {
    const sync = fakeSync({ syncGame: () => Promise.reject(new OfflineError("offline")) });
    await expect(syncBeforeOpen(sync, "g1")).resolves.toEqual({ late: null });
  });

  it("reconciles everything when there is no id", async () => {
    const syncAll = vi.fn(() => after(500, undefined));
    const done = syncBeforeOpen(fakeSync({ syncAll }), null);
    await vi.advanceTimersByTimeAsync(500);
    await expect(done).resolves.toEqual({ late: null });
    expect(syncAll).toHaveBeenCalledOnce();
  });
});
