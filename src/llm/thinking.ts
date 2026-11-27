export type ThinkingConfig = { thinkingBudget: number } | { thinkingLevel: "LOW" };

/** Lowers the model's reasoning for faster narration. Gemini 2.5 takes a token
    budget (Flash can be fully off, Pro cannot go below 128); Gemini 3 takes a
    level. Unknown models get nothing, so we never send a field they may reject. */
export function thinkingConfigFor(model: string, fast: boolean): ThinkingConfig | undefined {
  if (!fast) return undefined;
  if (model.includes("gemini-2.5-flash")) return { thinkingBudget: 0 };
  if (model.includes("gemini-2.5-pro")) return { thinkingBudget: 128 };
  if (model.includes("gemini-3")) return { thinkingLevel: "LOW" };
  return undefined;
}

/** A creative call's temperature, slightly above 1.0 for lexical variety
    without pushing smaller Flash models into erratic phrasing. Gemini 3 is
    left at its default: Google strongly advises against changing it there. */
export const CREATIVE_TEMPERATURE = 1.05;

export function temperatureFor(model: string, creative: boolean): number | undefined {
  if (!creative || model.includes("gemini-3")) return undefined;
  return CREATIVE_TEMPERATURE;
}
