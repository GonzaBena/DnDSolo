import { describe, expect, it } from "vitest";
import { castOf, findNpc, speakingNow, splitDialogue, type Cast } from "../src/domain/dialogue";
import type { Npc } from "../src/domain/types";
import { newGame } from "./helpers";

function npc(name: string): Npc {
  return { name, description: "", attitude: "neutral", present: true, voice: "", portrait: null };
}

const cast: Cast = { npcs: [npc("Brena"), npc("Goblin 1")], playerNames: ["Lira"] };

describe("splitDialogue", () => {
  it("keeps a narration without markers as a single DM segment", () => {
    expect(splitDialogue("La puerta cruje.\nHuele a humo.", cast)).toEqual([
      { speaker: null, paragraphs: ["La puerta cruje.", "Huele a humo."] },
    ]);
  });

  it("splits the NPC's line out of the DM's narration", () => {
    expect(splitDialogue("Entra alguien.\n[[Brena]] —¿Quién te manda?\nSilencio.", cast)).toEqual([
      { speaker: null, paragraphs: ["Entra alguien."] },
      { speaker: "Brena", paragraphs: ["—¿Quién te manda?"] },
      { speaker: null, paragraphs: ["Silencio."] },
    ]);
  });

  it("gives a marker with a portrait archetype to the NPC's Spanish name", () => {
    const withInnkeeper: Cast = { npcs: [npc("Tabernero")], playerNames: [] };
    expect(splitDialogue("[[innkeeper-male]] —Pasá.", withInnkeeper)).toEqual([
      { speaker: "Tabernero", paragraphs: ["—Pasá."] },
    ]);
  });

  it("joins consecutive paragraphs of the same NPC", () => {
    expect(splitDialogue("[[Brena]] Uno.\n\n[[Brena]] Dos.", cast)).toEqual([
      { speaker: "Brena", paragraphs: ["Uno.", "Dos."] },
    ]);
  });

  it("resolves the name to the NPC in the state, ignoring case and spaces", () => {
    expect(splitDialogue("[[ brena ]] Hola.", cast)).toEqual([
      { speaker: "Brena", paragraphs: ["Hola."] },
    ]);
  });

  it("keeps an unknown speaker's name, trimmed", () => {
    expect(splitDialogue("[[ Tabernero ]] Hola.", cast)).toEqual([
      { speaker: "Tabernero", paragraphs: ["Hola."] },
    ]);
  });

  it("never gives the player's character an NPC bubble", () => {
    expect(splitDialogue("[[Lira]] Digo que sí.", cast)).toEqual([
      { speaker: null, paragraphs: ["Digo que sí."] },
    ]);
  });

  it("hides a marker that is still arriving", () => {
    expect(splitDialogue("Entra alguien.\n[[Bre", cast)).toEqual([
      { speaker: null, paragraphs: ["Entra alguien."] },
    ]);
    expect(splitDialogue("[[Brena", cast)).toEqual([]);
  });

  it("keeps a finished paragraph whose marker is malformed", () => {
    expect(splitDialogue("[[Brena] Hola.\nSigue.", cast)).toEqual([
      { speaker: null, paragraphs: ["[[Brena] Hola.", "Sigue."] },
    ]);
  });

  it("gives a marker on its own line the next paragraph", () => {
    expect(splitDialogue("[[Brena]]\n—¿Y vos quién sos?\nSe va.", cast)).toEqual([
      { speaker: "Brena", paragraphs: ["—¿Y vos quién sos?"] },
      { speaker: null, paragraphs: ["Se va."] },
    ]);
  });

  it("opens the speaker's segment as soon as the marker closes", () => {
    expect(splitDialogue("[[Brena]]", cast)).toEqual([{ speaker: "Brena", paragraphs: [] }]);
  });

  it("only reads markers at the start of a paragraph", () => {
    expect(splitDialogue("Dice [[Brena]] algo.", cast)).toEqual([
      { speaker: null, paragraphs: ["Dice [[Brena]] algo."] },
    ]);
  });

  it("splits a marker glued after the end of a sentence", () => {
    expect(splitDialogue("La taberna huele a cerveza agria. [[Brena]] —El oro es tuyo.", cast)).toEqual([
      { speaker: null, paragraphs: ["La taberna huele a cerveza agria."] },
      { speaker: "Brena", paragraphs: ["—El oro es tuyo."] },
    ]);
    expect(splitDialogue("[[Brena]] —Andate. [[Goblin 1]] —¡No!", cast)).toEqual([
      { speaker: "Brena", paragraphs: ["—Andate."] },
      { speaker: "Goblin 1", paragraphs: ["—¡No!"] },
    ]);
  });

  it("hides a glued marker that is still arriving", () => {
    expect(splitDialogue("Huele a cerveza. [[Bre", cast)).toEqual([
      { speaker: null, paragraphs: ["Huele a cerveza."] },
    ]);
  });

  it("returns nothing for an empty narration", () => {
    expect(splitDialogue("", cast)).toEqual([]);
  });
});

describe("findNpc", () => {
  it("matches ignoring case and spaces", () => {
    expect(findNpc(cast.npcs, " brena ")?.name).toBe("Brena");
    expect(findNpc([], "X")).toBeUndefined();
  });
});

describe("speakingNow", () => {
  it("is the NPC whose line is being written", () => {
    expect(speakingNow("Entra.\n[[Brena]] —Ho", cast)).toBe("Brena");
    expect(speakingNow("[[ brena ]] Ho", cast)).toBe("Brena");
  });

  it("is null while the DM narrates, for the player, and for no text", () => {
    expect(speakingNow("[[Brena]] Hola.\nElla se va.", cast)).toBeNull();
    expect(speakingNow("[[Lira]] Sí", cast)).toBeNull();
    expect(speakingNow("", cast)).toBeNull();
  });
});

describe("castOf", () => {
  it("takes the NPCs and the players' names from the state", () => {
    expect(castOf(newGame())).toEqual({ npcs: [], playerNames: ["Lira"] });
  });
});
