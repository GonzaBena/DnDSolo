import { ThinkingLevel } from "@google/genai";
import { describe, expect, it } from "vitest";
import { thinkingConfigFor } from "../src/llm/thinking";

describe("thinkingConfigFor", () => {
  it("turns thinking off on 2.5 flash", () => {
    expect(thinkingConfigFor("models/gemini-2.5-flash", true)).toEqual({ thinkingBudget: 0 });
  });
  it("uses a minimal budget on 2.5 pro (it cannot be disabled)", () => {
    expect(thinkingConfigFor("models/gemini-2.5-pro", true)).toEqual({ thinkingBudget: 128 });
  });
  it("uses the low level on gemini 3", () => {
    expect(thinkingConfigFor("models/gemini-3-pro-preview", true)).toEqual({
      thinkingLevel: ThinkingLevel.LOW,
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
