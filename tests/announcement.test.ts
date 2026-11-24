import { describe, expect, it } from "vitest";
import { announcementOf, turnAnnouncement } from "../src/game/announcement";
import type { Arrival } from "../src/domain/types";
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

  it("adds who arrived after the narration", () => {
    const goblin = (name: string): Arrival => ({
      name,
      attitude: "hostile",
      portrait: null,
      blurb: "",
      returning: false,
      health: null,
    });
    expect(
      turnAnnouncement(
        {
          number: 2,
          input: { type: "start" },
          narration: "Se abre la puerta.",
          events: [],
          arrivals: [goblin("Goblin 1"), goblin("Goblin 2")],
        },
        cast,
      ),
    ).toBe("Se abre la puerta. Aparece: Goblin ×2, hostil.");
  });

  it("starts with the chapter when the turn reached a new place", () => {
    expect(
      turnAnnouncement(
        {
          number: 2,
          input: { type: "start" },
          narration: "Se abre la puerta.",
          events: [],
          chapter: { name: "La Cripta de Vel", description: "Piedra húmeda.", firstVisit: true },
          arrivals: [{ name: "Goblin 1", attitude: "hostile", portrait: null, blurb: "", returning: false, health: null }],
        },
        cast,
      ),
    ).toBe("Capítulo: La Cripta de Vel. Se abre la puerta. Aparece: Goblin 1, hostil.");
  });
});
