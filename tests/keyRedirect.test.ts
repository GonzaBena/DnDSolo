import { describe, expect, it } from "vitest";
import { isEditable, shouldRedirectKey, type KeyLike, type TargetLike } from "../src/game/keyRedirect";

const key = (k: string, extra: Partial<KeyLike> = {}): KeyLike => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  defaultPrevented: false,
  ...extra,
});

const target = (
  tagName: string,
  opts: { role?: string; isContentEditable?: boolean } = {},
): TargetLike => ({
  tagName,
  isContentEditable: opts.isContentEditable,
  getAttribute: (name) => (name === "role" ? (opts.role ?? null) : null),
});

describe("shouldRedirectKey", () => {
  it("redirects printable keys typed on the body", () => {
    expect(shouldRedirectKey(key("a"), target("BODY"))).toBe(true);
    expect(shouldRedirectKey(key("a"), null)).toBe(true);
  });

  it("keeps Space and letters on a focused button", () => {
    expect(shouldRedirectKey(key(" "), target("BUTTON"))).toBe(false);
    expect(shouldRedirectKey(key("a"), target("BUTTON"))).toBe(false);
  });

  it("ignores multi-character keys", () => {
    expect(shouldRedirectKey(key("Enter"), target("BUTTON"))).toBe(false);
    expect(shouldRedirectKey(key("Enter"), target("BODY"))).toBe(false);
  });

  it("keeps keys on interactive elements", () => {
    for (const tag of ["A", "SUMMARY", "INPUT", "TEXTAREA", "SELECT"]) {
      expect(shouldRedirectKey(key("a"), target(tag))).toBe(false);
    }
    expect(shouldRedirectKey(key("a"), target("DIV", { role: "button" }))).toBe(false);
    expect(shouldRedirectKey(key("a"), target("DIV", { isContentEditable: true }))).toBe(false);
  });

  it("keeps keys on interactive ARIA roles", () => {
    for (const role of ["link", "menuitem", "tab", "checkbox"]) {
      expect(shouldRedirectKey(key(" "), target("DIV", { role }))).toBe(false);
    }
  });

  it("ignores modified or already handled keys", () => {
    expect(shouldRedirectKey(key("a", { ctrlKey: true }), target("BODY"))).toBe(false);
    expect(shouldRedirectKey(key("a", { metaKey: true }), target("BODY"))).toBe(false);
    expect(shouldRedirectKey(key("a", { altKey: true }), target("BODY"))).toBe(false);
    expect(shouldRedirectKey(key("a", { defaultPrevented: true }), target("BODY"))).toBe(false);
  });
});

describe("isEditable", () => {
  it("is true only for text fields and contenteditable", () => {
    expect(isEditable(target("TEXTAREA"))).toBe(true);
    expect(isEditable(target("INPUT"))).toBe(true);
    expect(isEditable(target("SELECT"))).toBe(true);
    expect(isEditable(target("DIV", { isContentEditable: true }))).toBe(true);
    expect(isEditable(target("BUTTON"))).toBe(false);
    expect(isEditable(null)).toBe(false);
  });
});
