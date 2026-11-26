import { describe, expect, it } from "vitest";
import { buildTurnPrompt } from "../src/engine/dmPrompt";
import { wornPhrases } from "../src/domain/wornPhrases";
import type { GameState, Turn } from "../src/domain/types";
import { newGame } from "./helpers";

function withNarrations(...narrations: string[]): GameState {
  const turns: Turn[] = narrations.map((narration, i) => ({
    number: i + 1,
    input: { type: "start" },
    narration,
    events: [],
  }));
  return { ...newGame(), turns };
}

describe("wornPhrases", () => {
  it("finds an expression repeated across three turns", () => {
    const state = withNarrations(
      "Un escalofrío te recorre la espalda. La puerta cede.",
      "Caminás por el pasillo. Un escalofrío te recorre la espalda otra vez.",
      "El fuego chisporrotea y un escalofrío te recorre la espalda.",
    );
    expect(wornPhrases(state)).toEqual(["un escalofrío te recorre la espalda"]);
  });

  it("ignores phrases seen in fewer than three turns", () => {
    const state = withNarrations(
      "Un escalofrío te recorre la espalda.",
      "Un escalofrío te recorre la espalda.",
      "La lluvia golpea el techo.",
    );
    expect(wornPhrases(state)).toEqual([]);
  });

  it("counts a phrase once per turn", () => {
    const state = withNarrations("El viento aúlla fuerte. El viento aúlla fuerte. El viento aúlla fuerte.");
    expect(wornPhrases(state)).toEqual([]);
  });

  it("leaves out NPC lines and names from the story", () => {
    const state = {
      ...withNarrations(
        "[[Brena]] —Mirá vos, forastero cansado.\nLa forja humea.",
        "[[Brena]] —Mirá vos, forastero cansado.\nLlueve.",
        "[[Brena]] —Mirá vos, forastero cansado.\nAmanece.",
        "Brena Hierro Viejo te mira.",
        "Brena Hierro Viejo te mira.",
        "Brena Hierro Viejo te mira.",
      ),
      npcs: [
        { name: "Brena Hierro Viejo", description: "", attitude: "neutral" as const, present: true, voice: "", portrait: null, hp: null, maxHp: null },
      ],
    };
    expect(wornPhrases(state)).toEqual([]);
  });

  it("reaches the DM as its own block before the current turn", () => {
    const line = "Un escalofrío te recorre la espalda.";
    const prompt = buildTurnPrompt(withNarrations(line, line, line), { type: "action", text: "Sigo" }, 6);
    expect(prompt).toContain('FRASES GASTADAS\n"un escalofrío te recorre la espalda"\n\nTURNO ACTUAL');
    expect(buildTurnPrompt(newGame(), { type: "start" }, 6)).not.toContain("FRASES GASTADAS");
  });
});
