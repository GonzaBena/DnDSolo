import { describe, expect, it } from "vitest";
import { applyStateChanges } from "../src/domain/applyChanges";
import { newGame, PLAYER_ID } from "./helpers";

describe("applyStateChanges", () => {
  it("does not mutate the input state", () => {
    const game = newGame();
    const snapshot = structuredClone(game);
    applyStateChanges(game, [
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
    const result = applyStateChanges(newGame(), [
      { type: "inventory_add", playerId: "nope", item: "Daga", quantity: 1 },
    ]);
    expect(result.rejected).toEqual([]);
    expect(result.state.players[0]!.inventory).toEqual([{ name: "Daga", quantity: 1 }]);
  });

  it("rejects an unknown id when there are several players", () => {
    const game = newGame();
    const two = { ...game, players: [...game.players, { ...game.players[0]!, id: "other" }] };
    const result = applyStateChanges(two, [
      { type: "inventory_add", playerId: "nope", item: "Daga", quantity: 1 },
    ]);
    expect(result.rejected).toHaveLength(1);
  });

  it("updates NPCs and quests in place instead of duplicating them", () => {
    const state = applyStateChanges(newGame(), [
      { type: "npc", name: "Berta", description: "Posadera", attitude: "neutral", present: true },
      { type: "npc", name: "berta", description: "Posadera agradecida", attitude: "friendly", present: true },
      { type: "quest", title: "El anillo", description: "Encontrarlo", status: "active" },
      { type: "quest", title: "El anillo", description: "Encontrarlo", status: "completed" },
    ]).state;
    expect(state.npcs).toHaveLength(1);
    expect(state.npcs[0]!.attitude).toBe("friendly");
    expect(state.quests).toEqual([
      { title: "El anillo", description: "Encontrarlo", status: "completed" },
    ]);
  });

  describe("scene", () => {
    const goblin = (present = true) =>
      ({ type: "npc", name: "Goblin 1", description: "Flaco", attitude: "hostile", present }) as const;

    it("starts a fight and hands the turn to someone in the scene, matching their name", () => {
      const { state, rejected } = applyStateChanges(newGame(), [
        goblin(),
        { type: "scene", inCombat: true, turnOf: "goblin 1" },
      ]);
      expect(rejected).toEqual([]);
      expect(state.scene).toEqual({ inCombat: true, turnOf: "Goblin 1" });
    });

    it("gives the turn back to the player when it names nobody in the scene", () => {
      const { state, rejected } = applyStateChanges(newGame(), [
        goblin(false),
        { type: "scene", inCombat: true, turnOf: "Goblin 1" },
      ]);
      expect(rejected).toHaveLength(1);
      expect(state.scene).toEqual({ inCombat: true, turnOf: null });
    });

    it("clears the scene on a new location, whatever order the changes come in", () => {
      const before = applyStateChanges(newGame(), [
        { type: "location", name: "Posada", description: "" },
        goblin(),
        { type: "scene", inCombat: false, turnOf: "Goblin 1" },
      ]).state;
      const after = applyStateChanges(before, [
        { type: "npc", name: "Berta", description: "Posadera", attitude: "friendly", present: true },
        { type: "location", name: "Bosque", description: "" },
      ]).state;
      expect(after.npcs.map((n) => [n.name, n.present])).toEqual([
        ["Goblin 1", false],
        ["Berta", true],
      ]);
      expect(after.scene.turnOf).toBeNull();
    });

    it("keeps the scene when the location is only redescribed", () => {
      const before = applyStateChanges(newGame(), [
        { type: "location", name: "Posada", description: "" },
        goblin(),
      ]).state;
      const after = applyStateChanges(before, [
        { type: "location", name: "posada", description: "Llena de humo" },
      ]).state;
      expect(after.npcs[0]!.present).toBe(true);
    });
  });
});
