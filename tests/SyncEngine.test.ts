import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState, Turn } from "../src/domain/types";
import { InMemoryGameRepo } from "../src/persistence/InMemoryGameRepo";
import { SyncBases } from "../src/sync/bases";
import { InMemoryRemoteGameStore } from "../src/sync/InMemoryRemoteGameStore";
import { AuthExpiredError, OfflineError } from "../src/sync/RemoteGameStore";
import { syncStatus } from "../src/sync/status";
import { SyncEngine, type ConflictChoice, type SyncConflict } from "../src/sync/SyncEngine";
import { SyncedGameRepo } from "../src/sync/SyncedGameRepo";
import { newGame } from "./helpers";

let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  syncStatus.set({ state: "off", lastSyncedAt: null });
});
afterEach(() => vi.unstubAllGlobals());

const turn = (n: number): Turn => ({ number: n, input: { type: "start" }, narration: `t${n}`, events: [] });

/** A game with `turns` turns, saved at minute `minute`. */
function game(minute: number, turns = 0): GameState {
  return {
    ...newGame(),
    updatedAt: new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString(),
    turns: Array.from({ length: turns }, (_, i) => turn(i + 1)),
  };
}

function device(
  name: string,
  remote: InMemoryRemoteGameStore,
  resolveConflict: (c: SyncConflict) => Promise<ConflictChoice> = async () => "local",
) {
  const local = new InMemoryGameRepo();
  const engine = new SyncEngine({
    local,
    remote,
    // Each device keeps its own bases, even though they share an account.
    bases: (accountId) => new SyncBases(`${name}:${accountId}`),
    resolveConflict,
  });
  return { local, engine, repo: new SyncedGameRepo(local, engine) };
}

describe("SyncEngine", () => {
  it("carries a game saved on one device to another", async () => {
    const remote = new InMemoryRemoteGameStore();
    const a = device("A", remote);
    const b = device("B", remote);
    const state = game(1, 2);

    await a.repo.save(state);
    await a.engine.flush();
    await b.engine.syncAll();

    expect(await b.local.load(state.id)).toEqual(state);
    expect(syncStatus.get().state).toBe("idle");
    expect(syncStatus.get().lastSyncedAt).not.toBeNull();
  });

  it("tombstones a delete made offline once flushed, and the other device drops its copy", async () => {
    const remote = new InMemoryRemoteGameStore();
    const a = device("A", remote);
    const b = device("B", remote);
    const state = game(1);
    await a.repo.save(state);
    await a.engine.flush();
    await b.engine.syncAll();

    remote.failNext(new OfflineError());
    await a.repo.delete(state.id);
    await a.engine.flush(); // the failed attempt ran in the background; this one retries
    await a.engine.flush();

    expect((await remote.list()).find((r) => r.id === state.id)?.deleted).toBe(true);
    await b.engine.syncAll();
    expect(await b.local.load(state.id)).toBeNull();
  });

  it("asks once when both sides changed, and choosing remote takes the remote state", async () => {
    const remote = new InMemoryRemoteGameStore();
    const resolve = vi.fn(async (_c: SyncConflict): Promise<ConflictChoice> => "remote");
    const a = device("A", remote);
    const b = device("B", remote, resolve);
    await a.repo.save(game(1));
    await a.engine.flush();
    await b.engine.syncAll();

    const aState = game(2, 1);
    const bState = game(3, 2);
    await a.repo.save(aState);
    await a.engine.flush();
    await b.local.save(bState);
    await b.engine.syncAll();

    expect(resolve).toHaveBeenCalledTimes(1);
    const conflict = resolve.mock.calls[0]![0];
    expect(conflict).toMatchObject({ id: aState.id, kind: "both_changed" });
    expect(conflict.local).toEqual(bState);
    expect(conflict.remote).toEqual(aState);
    expect(await b.local.load(aState.id)).toEqual(aState);
  });

  it("collapses quick pushes and never uploads an older state after a newer one", async () => {
    const remote = new InMemoryRemoteGameStore();
    const uploaded: number[] = [];
    const put = remote.put.bind(remote);
    remote.put = async (state) => {
      uploaded.push(state.turns.length);
      await put(state);
    };
    const a = device("A", remote);

    await a.repo.save(game(1, 1));
    await a.repo.save(game(2, 2));
    await a.repo.save(game(3, 3));
    await a.engine.flush();

    expect((await remote.list())[0]!.turnCount).toBe(3);
    expect(uploaded.at(-1)).toBe(3);
    expect(uploaded.length).toBeLessThanOrEqual(2); // one in flight + one collapsed
    expect(uploaded).toEqual([...uploaded].sort((x, y) => x - y));
  });

  it("goes to reconnect on an expired token without failing the save, and uploads on flush", async () => {
    const remote = new InMemoryRemoteGameStore();
    const a = device("A", remote);
    const state = game(1);

    // Fails until the player reconnects, however many times the engine retries.
    const expired = vi.spyOn(remote, "accountId").mockRejectedValue(new AuthExpiredError());
    await expect(a.repo.save(state)).resolves.toBeUndefined();
    await a.engine.flush();
    expect(syncStatus.get().state).toBe("reconnect");
    expect(await remote.list()).toEqual([]);

    expired.mockRestore();
    await a.engine.flush();
    expect((await remote.list()).map((r) => r.id)).toEqual([state.id]);
    expect(syncStatus.get().state).toBe("idle");
  });

  it("goes offline on a network failure and uploads on flush", async () => {
    const remote = new InMemoryRemoteGameStore();
    const a = device("A", remote);
    const state = game(1);

    const offline = vi.spyOn(remote, "accountId").mockRejectedValue(new OfflineError());
    await a.repo.save(state);
    await a.engine.flush();
    expect(syncStatus.get().state).toBe("offline");
    expect(await remote.list()).toEqual([]);

    offline.mockRestore();
    await a.engine.flush();
    expect((await remote.list()).map((r) => r.id)).toEqual([state.id]);
  });

  it("goes to error on any other failure, without rejecting", async () => {
    const remote = new InMemoryRemoteGameStore();
    const a = device("A", remote);
    remote.failNext(new Error("boom"));
    await expect(a.engine.syncAll()).resolves.toBeUndefined();
    expect(syncStatus.get().state).toBe("error");
  });

  it("leaves local untouched when the remote save is from an unknown version", async () => {
    const remote = new InMemoryRemoteGameStore();
    const b = device("B", remote);
    const old = game(1);
    await b.repo.save(old);
    await b.engine.flush();

    await remote.put({ ...game(2), version: 999 });
    await expect(b.engine.syncAll()).resolves.toBeUndefined();
    expect(await b.local.load(old.id)).toEqual(old);
  });

  it("syncGame says downloaded only when local was replaced", async () => {
    const remote = new InMemoryRemoteGameStore();
    const a = device("A", remote);
    const b = device("B", remote);
    const state = game(1);
    await a.repo.save(state);
    await a.engine.flush();

    expect(await b.engine.syncGame(state.id)).toBe("downloaded");
    expect(await b.engine.syncGame(state.id)).toBe("unchanged");

    await b.repo.save(game(2, 1));
    expect(await b.engine.syncGame(state.id)).toBe("unchanged"); // it uploaded instead
    expect((await remote.list())[0]!.turnCount).toBe(1);

    remote.failNext(new OfflineError());
    expect(await a.engine.syncGame(state.id)).toBe("unchanged");
    expect(await a.engine.syncGame(state.id)).toBe("downloaded");
  });

  it("restores a game deleted elsewhere when the player keeps the local one", async () => {
    const remote = new InMemoryRemoteGameStore();
    const resolve = vi.fn(async (_c: SyncConflict): Promise<ConflictChoice> => "local");
    const a = device("A", remote);
    const b = device("B", remote, resolve);
    const state = game(1);
    await a.repo.save(state);
    await a.engine.flush();
    await b.engine.syncAll();

    await a.repo.delete(state.id);
    await a.engine.flush();
    const played = game(2, 1);
    await b.local.save(played);
    await b.engine.syncAll();

    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({ kind: "deleted_remotely", remote: null }));
    const entry = (await remote.list())[0]!;
    expect(entry).toMatchObject({ deleted: false, updatedAt: played.updatedAt });
  });

  it("does not report synced while another game is still waiting to upload", async () => {
    const remote = new InMemoryRemoteGameStore();
    const put = remote.put.bind(remote);
    remote.put = async (state) => {
      if (state.id === "x") throw new OfflineError();
      await put(state);
    };
    const a = device("A", remote);

    await a.repo.save({ ...game(1), id: "x" });
    await a.engine.flush();
    await a.repo.save({ ...game(2), id: "y" });
    await a.engine.syncGame("y");
    expect(syncStatus.get().state).toBe("offline");

    remote.put = put;
    await a.engine.flush();
    expect(syncStatus.get().state).toBe("idle");
    expect((await remote.list()).map((r) => r.id).sort()).toEqual(["x", "y"]);
  });

  it("keeps the base when a save during the dialog stops the local delete", async () => {
    const remote = new InMemoryRemoteGameStore();
    const a = device("A", remote);
    let b: ReturnType<typeof device>;
    const resolve = vi.fn(async (_c: SyncConflict): Promise<ConflictChoice> => {
      await b.local.save(game(3, 2)); // the player kept playing while the dialog was open
      return "remote";
    });
    b = device("B", remote, resolve);
    const state = game(1);
    await a.repo.save(state);
    await a.engine.flush();
    await b.engine.syncAll();
    await a.repo.delete(state.id);
    await a.engine.flush();
    await b.local.save(game(2, 1));

    await b.engine.syncAll();

    expect(resolve).toHaveBeenCalledTimes(1);
    expect((await b.local.load(state.id))?.turns).toHaveLength(2);
    expect(new SyncBases("B:in-memory-account").all()[state.id]).toBe(state.updatedAt);
  });

  it("keeps syncing after a status listener throws", async () => {
    const remote = new InMemoryRemoteGameStore();
    const a = device("A", remote);
    let thrown = false;
    const unsubscribe = syncStatus.subscribe(() => {
      if (thrown) return;
      thrown = true;
      throw new Error("listener bug");
    });
    try {
      await a.repo.save(game(1));
      await expect(a.engine.flush()).resolves.toBeUndefined();
      await a.repo.save(game(2, 1));
      await a.engine.flush();
      expect(thrown).toBe(true);
      expect((await remote.list())[0]!.turnCount).toBe(1);
    } finally {
      unsubscribe();
    }
  });

  it("does not overwrite a save that lands while a download is in flight", async () => {
    const remote = new InMemoryRemoteGameStore();
    const resolve = vi.fn(async (_c: SyncConflict): Promise<ConflictChoice> => "local");
    const a = device("A", remote);
    const b = device("B", remote, resolve);
    await a.repo.save(game(1));
    await a.engine.flush();
    await b.engine.syncAll();
    await a.repo.save(game(2, 1));
    await a.engine.flush();

    const played = game(3, 2);
    const get = remote.get.bind(remote);
    remote.get = async (id) => {
      remote.get = get;
      await b.local.save(played); // saved locally, push not scheduled yet
      return get(id);
    };
    await b.engine.syncAll();
    expect(await b.local.load(played.id)).toEqual(played);

    await b.engine.syncAll();
    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({ kind: "both_changed" }));
  });
});
