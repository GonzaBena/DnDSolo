import { describe, expect, it } from "vitest";
import { seal, unseal } from "../src/server/seal";

const SECRET = "a-long-session-secret";

describe("seal", () => {
  it("round-trips with the same secret", () => {
    const sealed = seal("1//refresh-token", SECRET);
    expect(sealed).not.toContain("refresh");
    expect(sealed).toMatch(/^[A-Za-z0-9_-]+$/); // base64url: safe as a cookie value
    expect(unseal(sealed, SECRET)).toBe("1//refresh-token");
  });

  it("uses a fresh IV each time", () => {
    expect(seal("x", SECRET)).not.toBe(seal("x", SECRET));
  });

  it("returns null with the wrong secret", () => {
    expect(unseal(seal("x", SECRET), "another-secret")).toBeNull();
  });

  it("returns null when any byte is tampered with", () => {
    const bytes = Buffer.from(seal("payload", SECRET), "base64url");
    for (const index of [0, 12, 28, bytes.length - 1]) {
      const copy = Buffer.from(bytes);
      copy[index] ^= 0x01;
      expect(unseal(copy.toString("base64url"), SECRET)).toBeNull();
    }
  });

  it("returns null for garbage and truncated input", () => {
    expect(unseal("", SECRET)).toBeNull();
    expect(unseal("not-a-sealed-value", SECRET)).toBeNull();
    expect(unseal(seal("x", SECRET).slice(0, 20), SECRET)).toBeNull();
  });
});
