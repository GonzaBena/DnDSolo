import { describe, expect, it } from "vitest";
import { currentSection } from "../src/docs/currentSection";

// Section tops relative to the viewport, in px; the viewport is 900px tall.
describe("currentSection", () => {
  it("is the first section before any reaches the upper third", () => {
    expect(currentSection([400, 800, 1200], 900, false)).toBe(0);
  });

  it("is the last section whose top passed the upper third", () => {
    expect(currentSection([-500, 100, 700], 900, false)).toBe(1);
  });

  it("is the last section at the bottom of the page, however short", () => {
    expect(currentSection([-800, -200, 500], 900, true)).toBe(2);
  });

  it("is -1 without sections", () => {
    expect(currentSection([], 900, false)).toBe(-1);
  });
});
