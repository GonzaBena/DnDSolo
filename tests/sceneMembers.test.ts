import { describe, expect, it } from "vitest";
import { applyStateChanges } from "../src/domain/applyChanges";
import { sceneMembers } from "../src/game/SceneDrawer";
import { newGame } from "./helpers";

const npc = (name: string) =>
  ({ type: "npc", name, description: "", attitude: "hostile", present: true, voice: "", portrait: null, maxHp: 7 }) as const;

describe("sceneMembers", () => {
  it("in a fight, follows the initiative order with the DM first and the unlisted last", () => {
    const { state } = applyStateChanges(newGame(), [
      npc("Goblin 1"),
      npc("Goblin 2"),
      npc("Lobo"),
      { type: "scene", inCombat: true, turnOf: null, order: ["Goblin 2", "Lira", "Goblin 1"] },
    ]);
    expect(sceneMembers(state, false).map((m) => m.name)).toEqual([
      "Dungeon Master", "Goblin 2", "Lira", "Goblin 1", "Lobo",
    ]);
  });

  it("outside a fight keeps players then NPCs", () => {
    const { state } = applyStateChanges(newGame(), [npc("Goblin 1")]);
    expect(sceneMembers(state, false).map((m) => m.name)).toEqual(["Dungeon Master", "Lira", "Goblin 1"]);
  });
});

describe("initiative numbers", () => {
  it("numbers whoever is in the order, from 1", () => {
    const { state } = applyStateChanges(newGame(), [
      npc("Goblin 1"),
      npc("Lobo"),
      { type: "scene", inCombat: true, turnOf: null, order: ["Goblin 1", "Lira"] },
    ]);
    expect(sceneMembers(state, false).map((m) => m.initiative)).toEqual([null, 1, 2, null]);
  });
});

describe("initiative numbers with someone away", () => {
  it("count only who is in the scene", () => {
    const { state } = applyStateChanges(newGame(), [
      npc("Goblin 1"),
      { ...npc("Goblin 2"), present: false },
      { type: "scene", inCombat: true, turnOf: null, order: ["Goblin 2", "Goblin 1", "Lira"] },
    ]);
    expect(sceneMembers(state, false).map((m) => [m.name, m.initiative])).toEqual([
      ["Dungeon Master", null], ["Goblin 1", 1], ["Lira", 2],
    ]);
  });
});
