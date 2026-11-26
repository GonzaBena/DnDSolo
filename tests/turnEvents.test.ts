import { describe, expect, it } from "vitest";
import { applyStateChanges } from "../src/domain/applyChanges";
import { deriveEvents } from "../src/domain/turnEvents";
import type { GameState, StateChange } from "../src/domain/types";
import { newGame, PLAYER_ID } from "./helpers";

function events(prev: GameState, changes: StateChange[]) {
  return deriveEvents(prev, applyStateChanges(prev, changes).state, changes);
}

const goblin: StateChange = {
  type: "npc", name: "Goblin 1", description: "Flaco.", attitude: "hostile",
  present: true, voice: "", maxHp: 7,
};

describe("deriveEvents", () => {
  it("is empty when nothing changed", () => {
    expect(events(newGame(), [])).toEqual([]);
  });

  it("tells damage to the hero from damage to an NPC", () => {
    const withGoblin = applyStateChanges(newGame(), [goblin]).state;
    expect(events(withGoblin, [{ type: "hp", target: PLAYER_ID, delta: -3 }])).toEqual(["damage_taken"]);
    expect(events(withGoblin, [{ type: "hp", target: "Goblin 1", delta: -3 }])).toEqual(["damage_dealt"]);
    expect(events(withGoblin, [{ type: "hp", target: "Lira", delta: 2 }])).toEqual(["healing"]);
  });

  it("reports damage to a hero without tracked hit points", () => {
    const game = newGame();
    const untracked = { ...game, players: game.players.map((p) => ({ ...p, stats: null, currentHp: null })) };
    expect(events(untracked, [{ type: "hp", target: PLAYER_ID, delta: -4 }])).toEqual(["damage_taken"]);
  });

  it("sees combat start and end, a new place, a new NPC and a gained item", () => {
    const start = events(newGame(), [
      { type: "location", name: "Cripta", description: "" },
      goblin,
      { type: "scene", inCombat: true, turnOf: null, order: [] },
      { type: "inventory_add", playerId: PLAYER_ID, item: "Llave", quantity: 1 },
    ]);
    expect(start).toEqual(expect.arrayContaining(["combat_start", "scene_change", "new_npc", "item_gained"]));
    const fighting = applyStateChanges(newGame(), [{ type: "scene", inCombat: true, turnOf: null, order: [] }]).state;
    expect(events(fighting, [{ type: "scene", inCombat: false, turnOf: null, order: [] }])).toEqual(["combat_end"]);
  });

  it("sees new and completed quests", () => {
    const quest = (status: "active" | "completed"): StateChange => ({ type: "quest", title: "La llave", description: "x", status });
    expect(events(newGame(), [quest("active")])).toEqual(["new_quest"]);
    const open = applyStateChanges(newGame(), [quest("active")]).state;
    expect(events(open, [quest("completed")])).toEqual(["quest_completed"]);
  });

  it("sees a level up and a death", () => {
    const prev = newGame();
    const next: GameState = {
      ...prev,
      players: prev.players.map((p) => ({ ...p, level: p.level + 1, condition: "dead" as const })),
    };
    expect(deriveEvents(prev, next, [])).toEqual(["level_up", "death"]);
  });
});
