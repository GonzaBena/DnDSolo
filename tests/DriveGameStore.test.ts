import { describe, expect, it } from "vitest";
import { DriveGameStore } from "../src/sync/DriveGameStore";
import { InMemoryRemoteGameStore } from "../src/sync/InMemoryRemoteGameStore";
import { AuthExpiredError, OfflineError } from "../src/sync/RemoteGameStore";
import type { GameState } from "../src/domain/types";

interface FakeFile {
  id: string;
  name: string;
  appProperties: Record<string, string>;
  content: string;
}

function makeDrive(opts: { pageSize?: number } = {}) {
  const files: FakeFile[] = [];
  const requests: { method: string; url: string; auth: string | null }[] = [];
  let next = 1;
  let status = 0;

  const json = (body: unknown, s = 200) =>
    new Response(JSON.stringify(body), { status: s });

  const parseMultipart = (contentType: string, body: string) => {
    const boundary = /boundary=(.+)$/.exec(contentType)![1].replace(/"/g, "");
    const parts = body
      .split(`--${boundary}`)
      .map((p) => p.trim())
      .filter((p) => p && p !== "--");
    const payload = (p: string) => p.slice(p.indexOf("\r\n\r\n") + 4).replace(/\r\n$/, "");
    return {
      meta: JSON.parse(payload(parts[0])),
      content: payload(parts[1]),
    };
  };

  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    requests.push({ method, url, auth: headers.get("Authorization") });
    if (status) return new Response("", { status });
    const u = new URL(url);

    if (method === "GET" && u.pathname === "/drive/v3/files") {
      const size = opts.pageSize ?? 1000;
      const start = Number(u.searchParams.get("pageToken") ?? 0);
      const slice = files.slice(start, start + size);
      const more = start + size < files.length;
      return json({
        files: slice.map(({ id, name, appProperties }) => ({ id, name, appProperties })),
        ...(more ? { nextPageToken: String(start + size) } : {}),
      });
    }
    const media = /^\/drive\/v3\/files\/([^/]+)$/.exec(u.pathname);
    if (method === "GET" && media) {
      const f = files.find((x) => x.id === media[1]);
      return f ? new Response(f.content) : new Response("", { status: 404 });
    }
    if (method === "POST" && u.pathname === "/upload/drive/v3/files") {
      const { meta, content } = parseMultipart(headers.get("Content-Type")!, String(init!.body));
      const f = { id: `f${next++}`, name: meta.name, appProperties: meta.appProperties ?? {}, content };
      files.push(f);
      return json({ id: f.id });
    }
    const upd = /^\/upload\/drive\/v3\/files\/([^/]+)$/.exec(u.pathname);
    if (method === "PATCH" && upd) {
      const f = files.find((x) => x.id === upd[1]);
      if (!f) return new Response("", { status: 404 });
      const { meta, content } = parseMultipart(headers.get("Content-Type")!, String(init!.body));
      expect(meta.parents).toBeUndefined();
      f.appProperties = meta.appProperties ?? {};
      f.content = content;
      return json({ id: f.id });
    }
    return new Response("", { status: 400 });
  }) as typeof fetch;

  return { files, requests, fetchFn, setStatus: (s: number) => (status = s) };
}

const game = (id: string, updatedAt = "2026-01-01T00:00:00.000Z", turns = 2) =>
  ({ id, updatedAt, turns: Array.from({ length: turns }, () => ({})) }) as unknown as GameState;

const token = async () => "tok";

describe("DriveGameStore", () => {
  it("put then list returns the entry with a numeric turnCount", async () => {
    const drive = makeDrive();
    const store = new DriveGameStore(token, drive.fetchFn);
    await store.put(game("a", "2026-02-02T00:00:00.000Z", 3));
    expect(await store.list()).toEqual([
      { id: "a", updatedAt: "2026-02-02T00:00:00.000Z", turnCount: 3, deleted: false },
    ]);
    expect(drive.files[0].name).toBe("game-a.json");
    expect(drive.requests.every((r) => r.auth === "Bearer tok")).toBe(true);
  });

  it("a second put of the same id PATCHes the same file", async () => {
    const drive = makeDrive();
    const store = new DriveGameStore(token, drive.fetchFn);
    await store.put(game("a"));
    await store.put(game("a", "2026-03-03T00:00:00.000Z"));
    expect(drive.files).toHaveLength(1);
    expect(drive.requests.filter((r) => r.method === "PATCH")).toHaveLength(1);
    expect(drive.requests.find((r) => r.method === "PATCH")!.url).toContain("/files/f1?");
    expect((await store.get("a") as GameState).updatedAt).toBe("2026-03-03T00:00:00.000Z");
  });

  it("get returns null for a missing game", async () => {
    const store = new DriveGameStore(token, makeDrive().fetchFn);
    expect(await store.get("nope")).toBeNull();
  });

  it("tombstone is listed as deleted and get returns null", async () => {
    const store = new DriveGameStore(token, makeDrive().fetchFn);
    await store.put(game("a"));
    await store.tombstone("a");
    const [entry] = await store.list();
    expect(entry.deleted).toBe(true);
    expect(await store.get("a")).toBeNull();
  });

  it("tombstone of an unknown id creates a tombstone file", async () => {
    const store = new DriveGameStore(token, makeDrive().fetchFn);
    await store.tombstone("z");
    expect((await store.list())[0]).toMatchObject({ id: "z", deleted: true });
  });

  it("401 rejects with AuthExpiredError", async () => {
    const drive = makeDrive();
    drive.setStatus(401);
    await expect(new DriveGameStore(token, drive.fetchFn).list()).rejects.toBeInstanceOf(AuthExpiredError);
  });

  it("other non-2xx rejects with an Error mentioning the status", async () => {
    const drive = makeDrive();
    drive.setStatus(500);
    await expect(new DriveGameStore(token, drive.fetchFn).list()).rejects.toThrow(/500/);
  });

  it("a throwing fetch rejects with OfflineError", async () => {
    const fetchFn = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    await expect(new DriveGameStore(token, fetchFn).list()).rejects.toBeInstanceOf(OfflineError);
  });

  it("list follows nextPageToken", async () => {
    const drive = makeDrive({ pageSize: 2 });
    const store = new DriveGameStore(token, drive.fetchFn);
    for (const id of ["a", "b", "c", "d", "e"]) await store.put(game(id));
    expect((await store.list()).map((e) => e.id).sort()).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("accountId creates account.json once and caches it", async () => {
    const drive = makeDrive();
    const store = new DriveGameStore(token, drive.fetchFn);
    const a = await store.accountId();
    const b = await store.accountId();
    expect(a).toBe(b);
    expect(drive.files.filter((f) => f.name === "account.json")).toHaveLength(1);
    // a fresh store finds the existing marker instead of creating another
    expect(await new DriveGameStore(token, drive.fetchFn).accountId()).toBe(a);
    expect(drive.files.filter((f) => f.name === "account.json")).toHaveLength(1);
  });

  it("concurrent accountId calls create a single account.json", async () => {
    const drive = makeDrive();
    const store = new DriveGameStore(token, drive.fetchFn);
    const [a, b] = await Promise.all([store.accountId(), store.accountId()]);
    expect(a).toBe(b);
    expect(drive.files.filter((f) => f.name === "account.json")).toHaveLength(1);
  });

  it("accountId picks the smallest id among several markers", async () => {
    const drive = makeDrive();
    for (const id of ["f9", "f2", "f5"]) {
      drive.files.push({ id, name: "account.json", appProperties: {}, content: "{}" });
    }
    expect(await new DriveGameStore(token, drive.fetchFn).accountId()).toBe("f2");
  });

  it("accountId retries after a failure", async () => {
    const drive = makeDrive();
    const store = new DriveGameStore(token, drive.fetchFn);
    drive.setStatus(500);
    await expect(store.accountId()).rejects.toThrow();
    drive.setStatus(0);
    await expect(store.accountId()).resolves.toBeTruthy();
  });

  it("put recreates a game whose cached file was deleted elsewhere", async () => {
    const drive = makeDrive();
    const store = new DriveGameStore(token, drive.fetchFn);
    await store.put(game("a"));
    drive.files.splice(0, 1);
    await store.put(game("a", "2026-04-04T00:00:00.000Z"));
    expect(drive.files).toHaveLength(1);
    expect((await store.list())[0].updatedAt).toBe("2026-04-04T00:00:00.000Z");
  });

  it("tombstone recreates a missing cached file; get returns null for it", async () => {
    const drive = makeDrive();
    const store = new DriveGameStore(token, drive.fetchFn);
    await store.put(game("a"));
    drive.files.splice(0, 1);
    expect(await store.get("a")).toBeNull();
    await store.put(game("b"));
    drive.files.splice(0, 1);
    await store.tombstone("b");
    expect((await store.list())[0]).toMatchObject({ id: "b", deleted: true });
  });

  it("list returns one entry per gameId, the newest", async () => {
    const drive = makeDrive();
    const props = (updatedAt: string) => ({ gameId: "a", updatedAt, turnCount: "1" });
    drive.files.push(
      { id: "f1", name: "game-a.json", appProperties: props("2026-01-01T00:00:00.000Z"), content: "{}" },
      { id: "f2", name: "game-a.json", appProperties: props("2026-05-01T00:00:00.000Z"), content: "{}" },
    );
    const store = new DriveGameStore(token, drive.fetchFn);
    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0].updatedAt).toBe("2026-05-01T00:00:00.000Z");
    await store.get("a");
    expect(drive.requests.at(-1)!.url).toContain("/files/f2?");
  });

  it("list ignores the account marker", async () => {
    const store = new DriveGameStore(token, makeDrive().fetchFn);
    await store.accountId();
    expect(await store.list()).toEqual([]);
  });
});

describe("InMemoryRemoteGameStore", () => {
  it("mirrors Drive semantics", async () => {
    const store = new InMemoryRemoteGameStore();
    const g = game("a", "2026-02-02T00:00:00.000Z", 2);
    await store.put(g);
    expect(await store.list()).toEqual([
      { id: "a", updatedAt: "2026-02-02T00:00:00.000Z", turnCount: 2, deleted: false },
    ]);
    const copy = (await store.get("a")) as GameState;
    expect(copy).toEqual(g);
    expect(copy).not.toBe(g);
    await store.tombstone("a");
    expect((await store.list())[0].deleted).toBe(true);
    expect(await store.get("a")).toBeNull();
    expect(await store.get("missing")).toBeNull();
  });

  it("accountId is stable", async () => {
    const store = new InMemoryRemoteGameStore();
    expect(await store.accountId()).toBe(await store.accountId());
  });

  it("failNext rejects the next call once", async () => {
    const store = new InMemoryRemoteGameStore();
    store.failNext(new OfflineError("x"));
    await expect(store.list()).rejects.toBeInstanceOf(OfflineError);
    await expect(store.list()).resolves.toEqual([]);
  });
});
