import { afterEach, describe, expect, it, vi } from "vitest";
import { DRIVE_SCOPE } from "../src/sync/DriveAuth";
import type { GisCodeApi, GisCodeClientConfig } from "../src/sync/gis";
import { ServerNotConfiguredError } from "../src/sync/errors";
import { AuthExpiredError, OfflineError } from "../src/sync/RemoteGameStore";
import { ServerDriveAuth } from "../src/sync/ServerDriveAuth";

const MIN = 60_000;

function fakeGis() {
  let config: GisCodeClientConfig | null = null;
  const requestCode = vi.fn();
  const api: GisCodeApi = {
    initCodeClient: (c) => {
      config = c;
      return { requestCode };
    },
  };
  return {
    api,
    requestCode,
    config: () => config,
    answer: (code: string) => config!.callback({ code }),
    deny: () => config!.callback({ code: "", error: "access_denied" }),
  };
}

function jsonResponse(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function setup(responses: Array<() => Response | Promise<Response>>) {
  const gis = fakeGis();
  const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    const next = responses.shift();
    if (!next) throw new Error("unexpected request");
    return next();
  });
  const auth = new ServerDriveAuth({ clientId: "cid", gis: () => gis.api, fetchFn });
  return { gis, fetchFn, auth };
}

/** Connects with a token that expires `minutes` from now. */
async function connected(minutes: number, more: Array<() => Response | Promise<Response>> = []) {
  const ctx = setup([() => jsonResponse(200, { accessToken: "at1", expiresAt: Date.now() + minutes * MIN }), ...more]);
  const done = ctx.auth.connect();
  ctx.gis.answer("code-1");
  expect(await done).toBe(true);
  return ctx;
}

afterEach(() => vi.useRealTimers());

describe("ServerDriveAuth", () => {
  it("never needs a gesture", () => {
    expect(setup([]).auth.needsGesture()).toBe(false);
  });

  it("connect opens an offline consent code client and posts the code to /api/drive/connect", async () => {
    const { gis, fetchFn, auth } = await connected(60);
    expect(gis.config()).toMatchObject({
      client_id: "cid",
      scope: DRIVE_SCOPE,
      ux_mode: "popup",
      access_type: "offline",
      prompt: "consent",
    });
    expect(gis.requestCode).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("/api/drive/connect");
    expect(init).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json" } });
    expect(JSON.parse(String(init?.body))).toEqual({ code: "code-1" });
    expect(await auth.getAccessToken()).toBe("at1");
  });

  it("connect resolves false when the user denies, without calling the server", async () => {
    const { gis, fetchFn, auth } = setup([]);
    const done = auth.connect();
    gis.deny();
    expect(await done).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("connect resolves false when the server rejects the code", async () => {
    const { gis, auth } = setup([() => jsonResponse(400)]);
    const done = auth.connect();
    gis.answer("bad");
    expect(await done).toBe(false);
  });

  it("connect rejects ServerNotConfiguredError when the server has no Google secrets", async () => {
    const { gis, auth } = setup([() => jsonResponse(500, { error: "not_configured" })]);
    const done = auth.connect();
    gis.answer("code");
    await expect(done).rejects.toBeInstanceOf(ServerNotConfiguredError);
  });

  it("connect resolves false on other server failures", async () => {
    const { gis, auth } = setup([() => jsonResponse(502, { error: "google_unavailable" })]);
    const done = auth.connect();
    gis.answer("code");
    expect(await done).toBe(false);
  });

  it("makes no request while the token has more than 10 min left", async () => {
    const { fetchFn, auth } = await connected(11);
    expect(await auth.getAccessToken()).toBe("at1");
    expect(fetchFn).toHaveBeenCalledTimes(1); // only the connect
  });

  it("renews once through /api/drive/token when less than 10 min are left", async () => {
    const { fetchFn, auth } = await connected(9, [
      () => jsonResponse(200, { accessToken: "at2", expiresAt: Date.now() + 60 * MIN }),
    ]);
    const [a, b] = await Promise.all([auth.getAccessToken(), auth.getAccessToken()]);
    expect([a, b]).toEqual(["at2", "at2"]);
    expect(await auth.getAccessToken()).toBe("at2");
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const [url, init] = fetchFn.mock.calls[1]!;
    expect(url).toBe("/api/drive/token");
    expect(init).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json" } });
  });

  it("asks the server on a fresh page with no token in memory", async () => {
    const { fetchFn, auth } = setup([() => jsonResponse(200, { accessToken: "at", expiresAt: Date.now() + 60 * MIN })]);
    expect(await auth.getAccessToken()).toBe("at");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("maps 401 to AuthExpiredError", async () => {
    const { auth } = setup([() => jsonResponse(401)]);
    await expect(auth.getAccessToken()).rejects.toBeInstanceOf(AuthExpiredError);
  });

  it("maps a network failure to OfflineError", async () => {
    const { auth } = setup([() => Promise.reject(new TypeError("Failed to fetch"))]);
    await expect(auth.getAccessToken()).rejects.toBeInstanceOf(OfflineError);
  });

  it("keeps using a still-valid token when an early renewal fails", async () => {
    const { auth } = await connected(5, [() => Promise.reject(new TypeError("Failed to fetch"))]);
    expect(await auth.getAccessToken()).toBe("at1");
  });

  it("disconnect posts to /api/drive/disconnect and forgets the token", async () => {
    const { fetchFn, auth } = await connected(60, [() => new Response(null, { status: 204 }), () => jsonResponse(401)]);
    await auth.disconnect();
    expect(fetchFn.mock.calls[1]![0]).toBe("/api/drive/disconnect");
    await expect(auth.getAccessToken()).rejects.toBeInstanceOf(AuthExpiredError);
  });

  it("disconnect does not throw when the server is unreachable", async () => {
    const { auth } = await connected(60, [() => Promise.reject(new TypeError("Failed to fetch"))]);
    await expect(auth.disconnect()).resolves.toBeUndefined();
  });
});
