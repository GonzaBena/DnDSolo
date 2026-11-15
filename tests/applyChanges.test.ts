import { describe, expect, it } from "vitest";
import { applyStateChanges } from "../src/domain/applyChanges";
import { newGame, PLAYER_ID } from "./helpers";

describe("applyStateChanges", () => {
  it("clamps HP between 0 and the maximum", () => {
    const game = newGame();
    const maxHp = game.players[0]!.maxHp;
    const hurt = applyStateChanges(game, [{ type: "hp", playerId: PLAYER_ID, delta: -5 }]).state;
    expect(hurt.players[0]!.hp).toBe(maxHp - 5);
    const healed = applyStateChanges(hurt, [{ type: "hp", playerId: PLAYER_ID, delta: 999 }]).state;
    expect(healed.players[0]!.hp).toBe(maxHp);
    const dead = applyStateChanges(hurt, [{ type: "hp", playerId: PLAYER_ID, delta: -999 }]).state;
    expect(dead.players[0]!.hp).toBe(0);
  });

  it("does not mutate the input state", () => {
    const game = newGame();
    const snapshot = structuredClone(game);
    applyStateChanges(game, [
      { type: "hp", playerId: PLAYER_ID, delta: -3 },
      { type: "inventory_add", playerId: PLAYER_ID, item: "Daga", quantity: 1 },
      { type: "location", name: "Bosque", description: "Oscuro" },
    ]);
    expect(game).toEqual(snapshot);
  });

  it("stacks items regardless of case and removes them when they run out", () => {
    const game = newGame();
    const added = applyStateChanges(game, [
      { type: "inventory_add", playerId: PLAYER_ID, item: "Poción", quantity: 2 },
      { type: "inventory_add", playerId: PLAYER_ID, item: "poción", quantity: 1 },
    ]).state;
    expect(added.players[0]!.inventory).toEqual([{ name: "Poción", quantity: 3 }]);
    const used = applyStateChanges(added, [
      { type: "inventory_remove", playerId: PLAYER_ID, item: "Poción", quantity: 5 },
    ]);
    expect(used.state.players[0]!.inventory).toEqual([]);
    expect(used.rejected).toEqual([]);
  });

  it("rejects removing an item the player doesn't have and keeps going", () => {
    const result = applyStateChanges(newGame(), [
      { type: "inventory_remove", playerId: PLAYER_ID, item: "Espada", quantity: 1 },
      { type: "location", name: "Cripta", description: "Fría" },
    ]);
    expect(result.rejected).toHaveLength(1);
    expect(result.state.location.name).toBe("Cripta");
  });

  it("falls back to the only player when the id is wrong", () => {
    const result = applyStateChanges(newGame(), [{ type: "hp", playerId: "nope", delta: -1 }]);
    expect(result.rejected).toEqual([]);
    expect(result.state.players[0]!.hp).toBe(result.state.players[0]!.maxHp - 1);
  });

  it("rejects an unknown id when there are several players", () => {
    const game = newGame();
    const two = { ...game, players: [...game.players, { ...game.players[0]!, id: "other" }] };
    const result = applyStateChanges(two, [{ type: "hp", playerId: "nope", delta: -1 }]);
    expect(result.rejected).toHaveLength(1);
  });

  it("updates NPCs and quests in place instead of duplicating them", () => {
    const state = applyStateChanges(newGame(), [
      { type: "npc", name: "Berta", description: "Posadera", attitude: "neutral" },
      { type: "npc", name: "berta", description: "Posadera agradecida", attitude: "friendly" },
      { type: "quest", title: "El anillo", description: "Encontrarlo", status: "active" },
      { type: "quest", title: "El anillo", description: "Encontrarlo", status: "completed" },
    ]).state;
    expect(state.npcs).toHaveLength(1);
    expect(state.npcs[0]!.attitude).toBe("friendly");
    expect(state.quests).toEqual([
      { title: "El anillo", description: "Encontrarlo", status: "completed" },
    ]);
  });
});
