import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryGameRepo } from "../src/persistence/InMemoryGameRepo";
import { SyncBases } from "../src/sync/bases";
import { BrowserDriveAuth } from "../src/sync/BrowserDriveAuth";
import { DRIVE_SCOPE } from "../src/sync/DriveAuth";
import { DriveGameStore } from "../src/sync/DriveGameStore";
import type { GisTokenApi, GisTokenClientConfig, GisTokenResponse } from "../src/sync/gis";
import { InMemoryRemoteGameStore } from "../src/sync/InMemoryRemoteGameStore";
import { AuthExpiredError } from "../src/sync/RemoteGameStore";
import { ConflictPendingError, resolveConflict, setConflictResolver, withRenewal, type SyncRuntime } from "../src/sync/runtime";
import { SyncEngine } from "../src/sync/SyncEngine";
import { SyncedGameRepo } from "../src/sync/SyncedGameRepo";
import { newGame } from "./helpers";

/** Fake GIS: records the client config so the test can answer each request. */
function fakeGis() {
  let config: GisTokenClientConfig | null = null;
  const requestAccessToken = vi.fn();
  const revoke = vi.fn((_token: string, done?: () => void) => done?.());
  const api: GisTokenApi = {
    initTokenClient: (c) => {
      config = c;
      return { requestAccessToken };
    },
    revoke,
  };
  return {
    api,
    requestAccessToken,
    revoke,
    grant: (response: Partial<GisTokenResponse> = {}) =>
      config!.callback({ access_token: "tok", expires_in: 3600, ...response } as GisTokenResponse),
    fail: (type: string) => config!.error_callback?.({ type }),
    config: () => config,
  };
}

const MIN = 60_000;

/** In-memory stand-in for sessionStorage. */
function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

function setup(storage = memoryStorage()) {
  let now = 1_000_000;
  const gis = fakeGis();
  const make = () => new BrowserDriveAuth({ clientId: "cid", gis: () => gis.api, now: () => now, storage });
  const auth = make();
  return { gis, auth, storage, make, advance: (ms: number) => (now += ms) };
}

const TOKEN_KEY = "dnsolo.sync.token.cid";

afterEach(() => vi.useRealTimers());

describe("BrowserDriveAuth", () => {
  it("asks for the drive.appdata scope with the given client id", async () => {
    const { gis, auth } = setup();
    const done = auth.connect();
    expect(gis.config()).toMatchObject({ client_id: "cid", scope: DRIVE_SCOPE });
    gis.grant();
    expect(await done).toBe(true);
  });

  it("needs a gesture with no token, not right after a 1 h token, and again 51 min later", async () => {
    const { gis, auth, advance } = setup();
    expect(auth.needsGesture()).toBe(true);

    const done = auth.renewWithGesture();
    gis.grant({ expires_in: 3600 });
    expect(await done).toBe(true);
    expect(auth.needsGesture()).toBe(false);

    advance(51 * MIN);
    expect(auth.needsGesture()).toBe(true);
  });

  it("renews silently with prompt ''", () => {
    const { gis, auth } = setup();
    void auth.renewWithGesture();
    expect(gis.requestAccessToken).toHaveBeenCalledWith({ prompt: "" });
  });

  it("hands out the token while valid and rejects AuthExpiredError once expired", async () => {
    const { gis, auth, advance } = setup();
    await expect(auth.getAccessToken()).rejects.toBeInstanceOf(AuthExpiredError);

    const done = auth.renewWithGesture();
    gis.grant({ access_token: "abc", expires_in: 3600 });
    await done;
    await expect(auth.getAccessToken()).resolves.toBe("abc");

    advance(61 * MIN);
    await expect(auth.getAccessToken()).rejects.toBeInstanceOf(AuthExpiredError);
    expect(gis.requestAccessToken).toHaveBeenCalledTimes(1); // never opens UI by itself
  });

  it("resolves false when the popup is closed, for both renew and connect", async () => {
    const { gis, auth } = setup();
    const renew = auth.renewWithGesture();
    gis.fail("popup_closed");
    expect(await renew).toBe(false);

    const connect = auth.connect();
    gis.fail("popup_closed");
    expect(await connect).toBe(false);
    expect(auth.needsGesture()).toBe(true);
  });

  it("resolves false when Google answers with an error (consent denied)", async () => {
    const { gis, auth } = setup();
    const connect = auth.connect();
    gis.grant({ access_token: "", error: "access_denied" });
    expect(await connect).toBe(false);
    await expect(auth.getAccessToken()).rejects.toBeInstanceOf(AuthExpiredError);
  });

  it("resolves false when no callback arrives within 20 s", async () => {
    vi.useFakeTimers();
    const { auth } = setup();
    let result: boolean | undefined;
    void auth.renewWithGesture().then((r) => (result = r));

    await vi.advanceTimersByTimeAsync(19_999);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toBe(false);
  });

  it("resolves false instead of throwing when GIS is not loaded", async () => {
    const auth = new BrowserDriveAuth({
      clientId: "cid",
      gis: () => {
        throw new Error("GIS not loaded");
      },
    });
    expect(await auth.renewWithGesture()).toBe(false);
    expect(await auth.connect()).toBe(false);
  });

  it("disconnect revokes the token and forgets it", async () => {
    const { gis, auth } = setup();
    const done = auth.connect();
    gis.grant({ access_token: "abc" });
    await done;

    await auth.disconnect();
    expect(gis.revoke).toHaveBeenCalledWith("abc", expect.any(Function));
    expect(auth.needsGesture()).toBe(true);
    await expect(auth.getAccessToken()).rejects.toBeInstanceOf(AuthExpiredError);
  });

  it("disconnect gives up waiting on a revoke that never calls back after 5 s", async () => {
    vi.useFakeTimers();
    const { gis, auth } = setup();
    const done = auth.connect();
    gis.grant({ access_token: "abc" });
    await done;
    gis.revoke.mockImplementation(() => undefined); // GIS never answers

    let finished = false;
    void auth.disconnect().then(() => (finished = true));
    await vi.advanceTimersByTimeAsync(4_999);
    expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(finished).toBe(true);
    expect(auth.needsGesture()).toBe(true);
  });

  it("forget drops the token locally without revoking at Google", async () => {
    const { gis, auth } = setup();
    const done = auth.connect();
    gis.grant({ access_token: "abc" });
    await done;

    await auth.forget();
    expect(gis.revoke).not.toHaveBeenCalled();
    expect(auth.needsGesture()).toBe(true);
    await expect(auth.getAccessToken()).rejects.toBeInstanceOf(AuthExpiredError);
  });
});

describe("BrowserDriveAuth token in sessionStorage", () => {
  it("a new page in the same tab gets the token back without a gesture", async () => {
    const { gis, make } = setup();
    const first = make();
    const done = first.connect();
    gis.grant({ access_token: "abc", expires_in: 3600 });
    await done;

    const next = make(); // the next page load
    expect(next.needsGesture()).toBe(false);
    await expect(next.getAccessToken()).resolves.toBe("abc");
  });

  it("stores the token under a key that names the client id", async () => {
    const { gis, auth, storage } = setup();
    const done = auth.renewWithGesture();
    gis.grant({ access_token: "abc", expires_in: 3600 });
    await done;
    expect(JSON.parse(storage.data.get(TOKEN_KEY)!)).toEqual({ value: "abc", expiresAt: 1_000_000 + 3600_000 });
  });

  it("ignores a stored token that already expired", async () => {
    const storage = memoryStorage();
    storage.setItem(TOKEN_KEY, JSON.stringify({ value: "old", expiresAt: 999_999 }));
    const { auth } = setup(storage);
    expect(auth.needsGesture()).toBe(true);
    await expect(auth.getAccessToken()).rejects.toBeInstanceOf(AuthExpiredError);
  });

  it("ignores corrupt or malformed stored values", async () => {
    for (const raw of ["{not json", "null", JSON.stringify({ value: 3, expiresAt: "x" })]) {
      const storage = memoryStorage();
      storage.setItem(TOKEN_KEY, raw);
      const { auth } = setup(storage);
      expect(auth.needsGesture()).toBe(true);
      await expect(auth.getAccessToken()).rejects.toBeInstanceOf(AuthExpiredError);
    }
  });

  it("disconnect and forget remove the stored token", async () => {
    for (const method of ["disconnect", "forget"] as const) {
      const { gis, auth, storage, make } = setup();
      const done = auth.connect();
      gis.grant({ access_token: "abc" });
      await done;
      await auth[method]();
      expect(storage.data.has(TOKEN_KEY)).toBe(false);
      expect(make().needsGesture()).toBe(true);
    }
  });

  it("disconnect revokes a token that only the storage remembers", async () => {
    const { gis, make } = setup();
    const done = make().connect();
    gis.grant({ access_token: "abc" });
    await done;
    await make().disconnect();
    expect(gis.revoke).toHaveBeenCalledWith("abc", expect.any(Function));
  });

  it("keeps working in memory when the storage throws", async () => {
    const boom = () => {
      throw new Error("SecurityError");
    };
    const { gis, auth } = setup({ data: new Map(), getItem: boom, setItem: boom, removeItem: boom });
    expect(auth.needsGesture()).toBe(true);
    const done = auth.connect();
    gis.grant({ access_token: "abc" });
    expect(await done).toBe(true);
    await expect(auth.getAccessToken()).resolves.toBe("abc");
    await expect(auth.forget()).resolves.toBeUndefined();
    await expect(auth.getAccessToken()).rejects.toBeInstanceOf(AuthExpiredError);
  });

  it("works without any sessionStorage (SSR, tests)", () => {
    const auth = new BrowserDriveAuth({ clientId: "cid", gis: () => fakeGis().api });
    expect(auth.needsGesture()).toBe(true);
  });
});

describe("BrowserDriveAuth.invalidate (Drive refused a token that has not expired)", () => {
  it("a stored unexpired token that Drive answers 401 needs a gesture, and the next tap renews", async () => {
    const storage = memoryStorage();
    storage.setItem(TOKEN_KEY, JSON.stringify({ value: "dead", expiresAt: 1_000_000 + 50 * MIN }));
    const { gis, auth } = setup(storage); // a new page: the revoked token came back from sessionStorage
    expect(auth.needsGesture()).toBe(false);

    const fetchFn = vi.fn(async () => new Response("", { status: 401 }));
    const remote = new DriveGameStore(() => auth.getAccessToken(), fetchFn, (t) => auth.invalidate(t));
    await expect(remote.list()).rejects.toBeInstanceOf(AuthExpiredError);

    expect(auth.needsGesture()).toBe(true);
    await expect(auth.getAccessToken()).rejects.toBeInstanceOf(AuthExpiredError);
    expect(storage.data.has(TOKEN_KEY)).toBe(false);
    void withRenewal({ auth } as unknown as SyncRuntime, async () => undefined);
    expect(gis.requestAccessToken).toHaveBeenCalledTimes(1);
  });

  it("a stale token does not drop a newer one", async () => {
    const { gis, auth } = setup();
    let done = auth.connect();
    gis.grant({ access_token: "old" });
    await done;
    done = auth.renewWithGesture();
    gis.grant({ access_token: "new" });
    await done;

    auth.invalidate("old");
    expect(auth.needsGesture()).toBe(false);
    await expect(auth.getAccessToken()).resolves.toBe("new");
  });
});

describe("withRenewal", () => {
  function runtimeWith(auth: BrowserDriveAuth): SyncRuntime {
    const local = new InMemoryGameRepo();
    const remote = new InMemoryRemoteGameStore();
    const engine = new SyncEngine({
      local,
      remote,
      bases: (a) => new SyncBases(a),
      resolveConflict,
    });
    return { auth, engine, repo: new SyncedGameRepo(local, engine), accountId: () => remote.accountId() };
  }

  it("opens the Google window synchronously, before its first await, then runs after it returns", async () => {
    const { gis, auth } = setup();
    const run = vi.fn(async () => "done");

    const result = withRenewal(runtimeWith(auth), run);
    // Nothing has been awaited yet: the popup must already be requested.
    expect(gis.requestAccessToken).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();

    gis.grant();
    expect(await result).toBe("done");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("still runs when the renewal fails", async () => {
    const { gis, auth } = setup();
    const result = withRenewal(runtimeWith(auth), async () => 7);
    gis.fail("popup_closed");
    expect(await result).toBe(7);
  });

  it("skips the renewal when the token is fresh, and when sync is off", async () => {
    const { gis, auth } = setup();
    const done = auth.connect();
    gis.grant();
    await done;
    gis.requestAccessToken.mockClear();

    expect(await withRenewal(runtimeWith(auth), async () => 1)).toBe(1);
    expect(await withRenewal(null, async () => 2)).toBe(2);
    expect(gis.requestAccessToken).not.toHaveBeenCalled();
  });
});

describe("runtime conflict resolver", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    setConflictResolver(null);
  });

  function device(name: string, remote: InMemoryRemoteGameStore) {
    const local = new InMemoryGameRepo();
    const engine = new SyncEngine({
      local,
      remote,
      bases: (accountId) => new SyncBases(`${name}:${accountId}`),
      resolveConflict,
    });
    return { local, engine, repo: new SyncedGameRepo(local, engine) };
  }

  const at = (minute: number, turns = 0) => ({
    ...newGame(),
    updatedAt: new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString(),
    turns: Array.from({ length: turns }, (_, i) => ({
      number: i + 1,
      input: { type: "start" as const },
      narration: `t${i + 1}`,
      events: [],
    })),
  });

  it("rejects by default, so the engine picks no side and keeps working", async () => {
    await expect(resolveConflict({ id: "x", kind: "both_changed", local: null, remote: null })).rejects.toBeInstanceOf(
      ConflictPendingError,
    );

    const remote = new InMemoryRemoteGameStore();
    const a = device("A", remote);
    const b = device("B", remote);
    await a.repo.save(at(1));
    await a.engine.flush();
    await b.engine.syncAll();

    const aState = at(2, 1);
    const bState = at(3, 2);
    await a.repo.save(aState);
    await a.engine.flush();
    await b.local.save(bState);

    await b.engine.syncAll();
    await b.engine.syncGame(aState.id);
    // Both copies untouched.
    expect(await b.local.load(aState.id)).toEqual(bState);
    expect(await remote.get(aState.id)).toEqual(aState);

    // The chain still runs later work, and a resolver set later settles the id.
    const other = { ...at(4), id: "other" };
    await b.repo.save(other);
    await b.engine.flush();
    expect((await remote.list()).some((r) => r.id === other.id)).toBe(true);

    setConflictResolver(async () => "local");
    await b.engine.syncGame(aState.id);
    expect(await remote.get(aState.id)).toEqual(bState);
  });
});

describe("getSyncRuntime", () => {
  let store: Map<string, string>;
  let listeners: Map<string, () => void>;
  let visibility: string;

  beforeEach(() => {
    vi.resetModules();
    store = new Map();
    listeners = new Map();
    visibility = "visible";
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    vi.stubEnv("PUBLIC_GOOGLE_CLIENT_ID", "cid");
    const on = (type: string, fn: () => void) => void listeners.set(type, fn);
    vi.stubGlobal("window", { addEventListener: on });
    vi.stubGlobal("document", {
      addEventListener: on,
      get visibilityState() {
        return visibility;
      },
      createElement: () => ({}),
      head: { appendChild: () => undefined },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("is null and createGameRepo is plain IndexedDB when sync is off", async () => {
    const { getSyncRuntime, createGameRepo } = await import("../src/sync/runtime");
    const { IndexedDBGameRepo } = await import("../src/persistence/IndexedDBGameRepo");
    expect(getSyncRuntime()).toBeNull();
    expect(createGameRepo()).toBeInstanceOf(IndexedDBGameRepo);
  });

  it("is one per page and flushes when the network returns or the page hides", async () => {
    store.set("dnsolo.sync", JSON.stringify({ enabled: true, autoRenew: false }));
    const { getSyncRuntime, createGameRepo } = await import("../src/sync/runtime");
    const runtime = getSyncRuntime()!;
    expect(getSyncRuntime()).toBe(runtime);
    expect(createGameRepo()).toBe(runtime.repo);
    expect(runtime.auth).toBeInstanceOf((await import("../src/sync/BrowserDriveAuth")).BrowserDriveAuth);

    const flush = vi.spyOn(runtime.engine, "flush").mockResolvedValue();
    listeners.get("online")!();
    expect(flush).toHaveBeenCalledTimes(1);
    listeners.get("visibilitychange")!();
    expect(flush).toHaveBeenCalledTimes(1); // still visible
    visibility = "hidden";
    listeners.get("visibilitychange")!();
    expect(flush).toHaveBeenCalledTimes(2);
  });
});
