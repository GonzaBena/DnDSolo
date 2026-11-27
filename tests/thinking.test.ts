import { describe, expect, it } from "vitest";
import { temperatureFor, thinkingConfigFor } from "../src/llm/thinking";

describe("thinkingConfigFor", () => {
  it("turns thinking off on 2.5 flash", () => {
    expect(thinkingConfigFor("models/gemini-2.5-flash", true)).toEqual({ thinkingBudget: 0 });
  });
  it("uses a minimal budget on 2.5 pro (it cannot be disabled)", () => {
    expect(thinkingConfigFor("models/gemini-2.5-pro", true)).toEqual({ thinkingBudget: 128 });
  });
  it("uses the low level on gemini 3", () => {
    expect(thinkingConfigFor("models/gemini-3-pro-preview", true)).toEqual({
      thinkingLevel: "LOW",
    });
  });
  it("sends nothing for unknown models", () => {
    expect(thinkingConfigFor("models/gemma-3-27b", true)).toBeUndefined();
  });
  it("sends nothing when fast narration is off", () => {
    for (const m of ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-3-pro", "other"]) {
      expect(thinkingConfigFor(m, false)).toBeUndefined();
    }
  });
});

describe("temperatureFor", () => {
  it("raises it for creative calls on Gemini 2.x", () => {
    expect(temperatureFor("models/gemini-2.5-flash", true)).toBe(1.05);
    expect(temperatureFor("models/gemini-2.5-flash", false)).toBeUndefined();
  });
  it("leaves Gemini 3 at its default, as Google advises", () => {
    expect(temperatureFor("models/gemini-3-flash", true)).toBeUndefined();
  });
});
