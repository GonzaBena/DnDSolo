import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendAfterRenewal, shouldDropSend, syncBeforeOpen } from "../src/sync/openGame";
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

describe("sendAfterRenewal", () => {
  it("holds the screen synchronously while the Google window is open, and releases it when the turn starts", async () => {
    let finishRenewal!: () => void;
    const sync = {
      auth: {
        needsGesture: () => true,
        renewWithGesture: () => new Promise<boolean>((r) => (finishRenewal = () => r(true))),
      },
    } as unknown as SyncRuntime;
    const holds: boolean[] = [];
    const run = vi.fn(async () => {
      holds.push(holds.at(-1)!); // what the turn sees when it starts
    });

    void sendAfterRenewal(sync, (on) => holds.push(on), run);
    expect(holds).toEqual([true]);
    expect(run).not.toHaveBeenCalled();

    finishRenewal();
    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
    expect(holds).toEqual([true, false, false]);
  });

  it("runs at once and leaves nothing held with sync off", () => {
    const holds: boolean[] = [];
    const run = vi.fn(async () => undefined);
    void sendAfterRenewal(null, (on) => holds.push(on), run);
    expect(run).toHaveBeenCalledOnce();
    expect(holds.at(-1)).toBe(false);
  });

  it("releases the hold when the renewal check throws before the turn starts", async () => {
    const sync = {
      auth: {
        needsGesture: () => {
          throw new Error("boom");
        },
      },
    } as unknown as SyncRuntime;
    const holds: boolean[] = [];
    const run = vi.fn(async () => undefined);
    await sendAfterRenewal(sync, (on) => holds.push(on), run).catch(() => undefined);
    expect(run).not.toHaveBeenCalled();
    expect(holds).toEqual([true, false]);
  });
});

describe("shouldDropSend", () => {
  it("sends when the screen is the one the click saw and nothing is paused", () => {
    expect(shouldDropSend(2, 2, false)).toBe(false);
  });
  it("drops a turn clicked before Drive's copy replaced the screen", () => {
    expect(shouldDropSend(1, 2, false)).toBe(true);
  });
  it("drops while Drive's copy is being written or opened", () => {
    expect(shouldDropSend(2, 2, true)).toBe(true);
  });
});
