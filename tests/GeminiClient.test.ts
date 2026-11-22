import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContentStream = vi.fn();
const generateContent = vi.fn();

vi.mock("@google/genai", async (orig) => ({
  ...(await orig<typeof import("@google/genai")>()),
  GoogleGenAI: class {
    models = { generateContentStream, generateContent };
  },
}));

import { GeminiClient } from "../src/llm/GeminiClient";

beforeEach(() => {
  generateContentStream.mockReset();
  generateContent.mockReset();
  generateContentStream.mockResolvedValue(
    (async function* () {
      yield { text: "{}" };
    })(),
  );
  generateContent.mockResolvedValue({ text: "hola" });
});

const structured = { system: "s", prompt: "p", jsonSchema: {} };

describe("GeminiClient thinking", () => {
  it("passes thinkingConfig to the turn call when fast", async () => {
    await new GeminiClient("k", "gemini-2.5-flash", { fastNarration: true }).generateStructured(structured);
    expect(generateContentStream.mock.calls[0][0].config.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });
  it("omits thinkingConfig when not fast", async () => {
    await new GeminiClient("k", "gemini-2.5-flash").generateStructured(structured);
    expect(generateContentStream.mock.calls[0][0].config.thinkingConfig).toBeUndefined();
  });
  it("never passes thinkingConfig to the summary call", async () => {
    await new GeminiClient("k", "gemini-2.5-flash", { fastNarration: true }).generateText({ prompt: "p" });
    expect(generateContent.mock.calls[0][0].config).not.toHaveProperty("thinkingConfig");
  });
});
