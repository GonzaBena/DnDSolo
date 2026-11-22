import { beforeEach, describe, expect, it, vi } from "vitest";

const revoke = vi.fn(async () => undefined);
vi.mock("astro:env/server", () => ({
  getSecret: (name: string) =>
    ({ PUBLIC_GOOGLE_CLIENT_ID: "cid", GOOGLE_CLIENT_SECRET: "secret", SESSION_SECRET: "s".repeat(32) })[name],
}));
vi.mock("../src/server/googleTokens", () => ({ revoke }));

const { POST } = await import("../src/pages/api/drive/disconnect");
const { seal } = await import("../src/server/seal");

function call(body: unknown) {
  const deleted: string[] = [];
  const cookies = {
    get: () => ({ value: seal("refresh-1", "s".repeat(32)) }),
    delete: (name: string) => void deleted.push(name),
  };
  const request = new Request("http://localhost/api/drive/disconnect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const response = (POST as (ctx: unknown) => Promise<Response>)({ request, cookies });
  return { response, deleted };
}

beforeEach(() => revoke.mockClear());

describe("POST /api/drive/disconnect", () => {
  it("revokes the refresh token at Google and clears the cookie", async () => {
    const { response, deleted } = call({});
    expect((await response).status).toBe(204);
    expect(revoke).toHaveBeenCalledWith("refresh-1");
    expect(deleted).toEqual(["dnsolo_drive"]);
  });

  it("with revoke:false only clears the cookie", async () => {
    const { response, deleted } = call({ revoke: false });
    expect((await response).status).toBe(204);
    expect(revoke).not.toHaveBeenCalled();
    expect(deleted).toEqual(["dnsolo_drive"]);
  });
});
