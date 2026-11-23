import { afterEach, describe, expect, it, vi } from "vitest";
import { exchangeCode, InvalidGrantError, refreshAccess, revoke } from "../src/server/googleTokens";

const ENV = { clientId: "cid", clientSecret: "csecret" };

function respond(status: number, body: unknown) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
}

function sentForm(fetchFn: ReturnType<typeof respond>) {
  const [url, init] = fetchFn.mock.calls[0]!;
  return { url: String(url), method: init?.method, form: new URLSearchParams(String(init?.body)) };
}

afterEach(() => vi.restoreAllMocks());

describe("exchangeCode", () => {
  it("posts an authorization_code grant with redirect_uri=postmessage and maps expires_in", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const fetchFn = respond(200, { access_token: "at", expires_in: 3599, refresh_token: "rt" });

    const grant = await exchangeCode("the-code", ENV, fetchFn);

    expect(grant).toEqual({ accessToken: "at", expiresAt: 1_000_000 + 3_599_000, refreshToken: "rt" });
    const sent = sentForm(fetchFn);
    expect(sent.url).toBe("https://oauth2.googleapis.com/token");
    expect(sent.method).toBe("POST");
    expect(Object.fromEntries(sent.form)).toEqual({
      code: "the-code",
      client_id: "cid",
      client_secret: "csecret",
      redirect_uri: "postmessage",
      grant_type: "authorization_code",
    });
  });

  it("rejects when Google sends no refresh token", async () => {
    await expect(exchangeCode("c", ENV, respond(200, { access_token: "at", expires_in: 3600 }))).rejects.toThrow();
  });

  it("rejects invalid_grant with InvalidGrantError", async () => {
    await expect(exchangeCode("c", ENV, respond(400, { error: "invalid_grant" }))).rejects.toBeInstanceOf(
      InvalidGrantError,
    );
  });
});

describe("refreshAccess", () => {
  it("posts a refresh_token grant", async () => {
    vi.spyOn(Date, "now").mockReturnValue(5_000);
    const fetchFn = respond(200, { access_token: "at2", expires_in: 3600 });

    expect(await refreshAccess("rt", ENV, fetchFn)).toEqual({ accessToken: "at2", expiresAt: 5_000 + 3_600_000 });
    expect(Object.fromEntries(sentForm(fetchFn).form)).toEqual({
      refresh_token: "rt",
      client_id: "cid",
      client_secret: "csecret",
      grant_type: "refresh_token",
    });
  });

  it("rejects invalid_grant with InvalidGrantError", async () => {
    await expect(refreshAccess("rt", ENV, respond(400, { error: "invalid_grant" }))).rejects.toBeInstanceOf(
      InvalidGrantError,
    );
  });

  it("rejects other failures with a plain error that does not echo the token", async () => {
    const error = await refreshAccess("secret-rt", ENV, respond(500, { error: "backend_error" })).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(InvalidGrantError);
    expect(String(error)).not.toContain("secret-rt");
  });
});

describe("revoke", () => {
  it("posts the token to the revoke endpoint", async () => {
    const fetchFn = respond(200, {});
    await revoke("rt", fetchFn);
    const sent = sentForm(fetchFn);
    expect(sent.url).toBe("https://oauth2.googleapis.com/revoke");
    expect(sent.form.get("token")).toBe("rt");
  });

  it("rejects when Google refuses", async () => {
    await expect(revoke("rt", respond(400, { error: "invalid_token" }))).rejects.toThrow();
  });
});
