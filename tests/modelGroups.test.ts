import { describe, expect, it } from "vitest";
import { classifyModelTier, groupModelOptions } from "../src/settings/modelGroups";

describe("modelGroups", () => {
  it("classifies flash/lite, pro, and other models by tier", () => {
    expect(classifyModelTier({ id: "models/gemini-2.5-flash", label: "Gemini 2.5 Flash" })).toBe("fast");
    expect(classifyModelTier({ id: "models/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" })).toBe("fast");
    expect(classifyModelTier({ id: "models/gemini-2.5-pro", label: "Gemini 2.5 Pro" })).toBe("quality");
    expect(classifyModelTier({ id: "models/gemma-3-27b-it", label: "Gemma 3 27B" })).toBe("other");
  });

  it("groups non-empty tiers in fast -> quality -> other order", () => {
    const grouped = groupModelOptions([
      { id: "models/gemma-3", label: "Gemma 3" },
      { id: "models/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "models/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    ]);
    expect(grouped.map((g) => g.tier)).toEqual(["fast", "quality", "other"]);
    expect(grouped[0]!.models.map((m) => m.id)).toEqual(["models/gemini-2.5-flash"]);
    expect(grouped[1]!.models.map((m) => m.id)).toEqual(["models/gemini-2.5-pro"]);
    expect(grouped[2]!.models.map((m) => m.id)).toEqual(["models/gemma-3"]);
  });

  it("omits empty tiers", () => {
    const grouped = groupModelOptions([{ id: "models/gemini-2.5-flash", label: "Gemini 2.5 Flash" }]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]!.tier).toBe("fast");
  });
});
