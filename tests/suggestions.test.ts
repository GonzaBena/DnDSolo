import { describe, expect, it } from "vitest";
import { withSuggestion } from "../src/game/suggestions";

describe("withSuggestion", () => {
  it("fills an empty draft", () => {
    expect(withSuggestion("  ", "Interrogo al guardia")).toBe("Interrogo al guardia");
  });

  it("adds to what was already typed instead of replacing it", () => {
    expect(withSuggestion("Con cuidado, ", "interrogo al guardia")).toBe("Con cuidado, interrogo al guardia");
    expect(withSuggestion("Primero me escondo.", "Interrogo al guardia")).toBe("Primero me escondo. Interrogo al guardia");
  });
});
