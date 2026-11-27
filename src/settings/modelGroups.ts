import type { ModelOption } from "../llm/GeminiClient";

export type ModelTier = "fast" | "quality" | "other";

export interface ModelGroup {
  tier: ModelTier;
  label: string;
  models: ModelOption[];
}

const TIER_LABELS: Record<ModelTier, string> = {
  fast: "Rápidos y económicos (Flash / Lite) — recomendados",
  quality: "Mayor profundidad narrativa (Pro) — consumen más cuota",
  other: "Otros modelos",
};

export function classifyModelTier(model: ModelOption): ModelTier {
  const haystack = `${model.id} ${model.label}`.toLowerCase();
  if (/\b(flash|lite)\b/.test(haystack) || haystack.includes("flash-")) return "fast";
  if (/\bpro\b/.test(haystack)) return "quality";
  return "other";
}

/** Groups Gemini models by speed/quota tier so the player can tell Flash/Lite
    models apart from Pro models without reading raw ids. */
export function groupModelOptions(models: ModelOption[]): ModelGroup[] {
  const buckets: Record<ModelTier, ModelOption[]> = {
    fast: [],
    quality: [],
    other: [],
  };
  for (const model of models) {
    buckets[classifyModelTier(model)].push(model);
  }
  const order: ModelTier[] = ["fast", "quality", "other"];
  return order
    .filter((tier) => buckets[tier].length > 0)
    .map((tier) => ({ tier, label: TIER_LABELS[tier], models: buckets[tier] }));
}
