import { describe, expect, it } from "vitest";
import { withPlayersFrom } from "../src/game/usePlayerUpdate";
import { newGame } from "./helpers";

describe("withPlayersFrom", () => {
  it("takes the saved players and keeps what only lives on screen (an old save's suggestions)", () => {
    const shown = { ...newGame(), suggestedActions: ["Miro alrededor"] };
    const saved = { ...newGame(), players: [{ ...newGame().players[0]!, level: 4 }], updatedAt: "later" };
    const merged = withPlayersFrom(shown, saved);
    expect(merged.players[0]!.level).toBe(4);
    expect(merged.updatedAt).toBe("later");
    expect(merged.suggestedActions).toEqual(["Miro alrededor"]);
  });
});
