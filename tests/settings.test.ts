import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSettings } from "../src/persistence/settings";

function stubStorage(value: unknown) {
  vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(value) });
}

afterEach(() => vi.unstubAllGlobals());

describe("loadSettings", () => {
  it("defaults fastNarration to false for old saves", () => {
    stubStorage({ apiKey: "k", model: "m" });
    expect(loadSettings()).toEqual({ apiKey: "k", model: "m", fastNarration: false, showSuggestions: true });
  });
  it("keeps a saved fastNarration", () => {
    stubStorage({ apiKey: "k", model: "m", fastNarration: true });
    expect(loadSettings()?.fastNarration).toBe(true);
  });
  it("ignores a non-boolean fastNarration", () => {
    stubStorage({ apiKey: "k", model: "m", fastNarration: "yes" });
    expect(loadSettings()?.fastNarration).toBe(false);
  });
  it("shows suggestions unless they were turned off", () => {
    stubStorage({ apiKey: "k", model: "m" });
    expect(loadSettings()?.showSuggestions).toBe(true);
    stubStorage({ apiKey: "k", model: "m", showSuggestions: false });
    expect(loadSettings()?.showSuggestions).toBe(false);
  });
});
