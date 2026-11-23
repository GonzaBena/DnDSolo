import { describe, expect, it } from "vitest";
import { announcementOf } from "../src/game/announcement";
import type { Cast } from "../src/domain/dialogue";

const cast: Cast = { npcs: [], playerNames: ["Aria"] };

describe("announcementOf", () => {
  it("reads the DM's narration as plain paragraphs", () => {
    expect(announcementOf("La puerta cruje.\n\nAlgo se mueve.", cast)).toBe("La puerta cruje. Algo se mueve.");
  });

  it("names who speaks and drops the dialogue markers", () => {
    expect(announcementOf("Entrás a la taberna.\n[[Brena]] —¿Qué vas a tomar?", cast)).toBe(
      "Entrás a la taberna. Brena dice: —¿Qué vas a tomar?",
    );
  });

  it("is empty when there is nothing to read", () => {
    expect(announcementOf("  \n ", cast)).toBe("");
  });
});
