import { describe, expect, it } from "vitest";
import { keyboardInset } from "../src/game/keyboardInset";

describe("keyboardInset", () => {
  it("no keyboard: nothing to lift", () => {
    expect(keyboardInset(844, { height: 844, offsetTop: 0 })).toBe(0);
  });

  it("the keyboard covers the bottom of the page", () => {
    expect(keyboardInset(844, { height: 508, offsetTop: 0 })).toBe(336);
  });

  it("iOS also scrolled the view down: only what is still covered", () => {
    expect(keyboardInset(844, { height: 508, offsetTop: 200 })).toBe(136);
  });

  it("never negative (zoomed or rounding)", () => {
    expect(keyboardInset(844, { height: 600, offsetTop: 300 })).toBe(0);
  });
});
