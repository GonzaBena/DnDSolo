import { describe, expect, it } from "vitest";
import { fieldHeight, nextExpanded } from "../src/game/composerLayout";

describe("nextExpanded", () => {
  it("stays on one line while the text fits beside the buttons", () => {
    expect(nextExpanded(false, "Abro la puerta", false)).toBe(false);
  });

  it("takes the whole row once the text reaches the end of the line", () => {
    expect(nextExpanded(false, "Abro la puerta con cuidado y miro", true)).toBe(true);
  });

  it("a new line also takes the whole row", () => {
    expect(nextExpanded(false, "Abro\n", false)).toBe(true);
  });

  it("stays expanded while there is text, so it doesn't jump back and forth", () => {
    expect(nextExpanded(true, "Abro", false)).toBe(true);
  });

  it("goes back to one line when emptied (sent or erased)", () => {
    expect(nextExpanded(true, "", false)).toBe(false);
    expect(nextExpanded(true, "   ", false)).toBe(false);
  });
});

describe("fieldHeight", () => {
  it("an empty field stays one line, even if the hint would wrap", () => {
    expect(fieldHeight("", 80, 4)).toBeNull();
  });

  it("text sets the height, border included", () => {
    expect(fieldHeight("Abro la puerta", 40, 4)).toBe(44);
  });
});
