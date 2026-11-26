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

  it("ignores roll requests, which the DM has to repeat", () => {
    const line = "Hacé una tirada de 1d20 + tu modificador de destreza.";
    expect(wornPhrases(withNarrations(line, line, line))).toEqual([]);
  });

  it("ignores what is carried or in the scene", () => {
    const line = "La armadura de cuero tachonado cruje.";
    const game = newGame();
    const state = {
      ...withNarrations(line, line, line),
      players: game.players.map((p) => ({ ...p, inventory: [{ name: "Armadura de cuero tachonado", quantity: 1 }] })),
    };
    expect(wornPhrases(state)).toEqual([]);
  });

  it("lists each habit once, not its overlapping variants", () => {
    const state = withNarrations(
      "Sentís el aire húmedo del pozo.",
      "El aire húmedo te envuelve.",
      "Respirás el aire húmedo de la cripta.",
      "Todo es aire húmedo y silencio.",
    );
    expect(wornPhrases(state)).toEqual(["el aire húmedo"]);
  });

  it("reaches the DM as its own block before the current turn", () => {
    const line = "Un escalofrío te recorre la espalda.";
    const prompt = buildTurnPrompt(withNarrations(line, line, line), { type: "action", text: "Sigo" }, 6);
    expect(prompt).toContain('FRASES GASTADAS\n"un escalofrío te recorre la espalda"\n\nTURNO ACTUAL');
    expect(buildTurnPrompt(newGame(), { type: "start" }, 6)).not.toContain("FRASES GASTADAS");
  });
});
