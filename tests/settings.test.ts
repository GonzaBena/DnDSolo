import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSettings } from "../src/persistence/settings";

function stubStorage(value: unknown) {
  vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(value) });
}

afterEach(() => vi.unstubAllGlobals());

describe("loadSettings", () => {
  it("defaults fastNarration, auxiliaryModel and suggestionsMode for old saves", () => {
    stubStorage({ apiKey: "k", model: "m" });
    expect(loadSettings()).toEqual({
      apiKey: "k",
      model: "m",
      auxiliaryModel: "",
      fastNarration: false,
      showSuggestions: true,
      suggestionsMode: "auto",
    });
  });
  it("keeps a saved fastNarration", () => {
    stubStorage({ apiKey: "k", model: "m", fastNarration: true });
    expect(loadSettings()?.fastNarration).toBe(true);
  });
  it("ignores a non-boolean fastNarration", () => {
    stubStorage({ apiKey: "k", model: "m", fastNarration: "yes" });
    expect(loadSettings()?.fastNarration).toBe(false);
  });
  it("migrates showSuggestions false to off and keeps explicit suggestionsMode", () => {
    stubStorage({ apiKey: "k", model: "m" });
    expect(loadSettings()?.showSuggestions).toBe(true);
    expect(loadSettings()?.suggestionsMode).toBe("auto");
    stubStorage({ apiKey: "k", model: "m", showSuggestions: false });
    expect(loadSettings()?.showSuggestions).toBe(false);
    expect(loadSettings()?.suggestionsMode).toBe("off");
    stubStorage({ apiKey: "k", model: "m", suggestionsMode: "on_demand", auxiliaryModel: "models/gemini-2.5-flash-lite" });
    expect(loadSettings()?.suggestionsMode).toBe("on_demand");
    expect(loadSettings()?.showSuggestions).toBe(true);
    expect(loadSettings()?.auxiliaryModel).toBe("models/gemini-2.5-flash-lite");
  });
});
