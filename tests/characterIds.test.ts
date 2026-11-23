import { describe, expect, it } from "vitest";
import { GAME_STATE_VERSION } from "../src/domain/types";
import { createCharacter, createGame } from "../src/domain/character";
import { gameStateSchema } from "../src/domain/schemas";
import { migrateSave } from "../src/persistence/migrations";
import { newGame } from "./helpers";

const base = { name: "Lira", subclassId: null, srdBackgroundId: null, level: 1, background: "" };

function v3(race: string, characterClass: string) {
  const { players: _players, ...rest } = newGame();
  return {
    ...rest,
    version: 3,
    players: [{ id: "p", name: "X", race, characterClass, level: 3, background: null, inventory: [] }],
  };
}

describe("character ids", () => {
  it("migrates a v3 save with a species missing from SRD 5.2", () => {
    const game = migrateSave(v3("Semielfo", "Pícaro"));
    expect(game?.version).toBe(GAME_STATE_VERSION);
    expect(game?.players[0]).toMatchObject({ speciesId: null, classId: "rogue", subclassId: null, srdBackgroundId: null });
  });

  it("resolves the species id of a v3 save", () => {
    expect(migrateSave(v3("Elfo", "Guerrero"))?.players[0]).toMatchObject({ speciesId: "elf", classId: "fighter" });
  });

  it("stores the Spanish labels when creating a game", () => {
    const game = createGame({ ...base, speciesId: "elf", classId: "rogue" });
    expect(game.players[0]).toMatchObject({ speciesId: "elf", race: "Elfo", classId: "rogue", characterClass: "Pícaro" });
  });

  it("rejects unknown ids and subclasses that are unavailable", () => {
    const id = () => "x";
    expect(() => createCharacter({ ...base, speciesId: "nope", classId: "rogue" }, id)).toThrow();
    expect(() => createCharacter({ ...base, speciesId: "elf", classId: "rogue", level: 2, subclassId: "thief" }, id)).toThrow();
    expect(() => createCharacter({ ...base, speciesId: "elf", classId: "rogue", level: 3, subclassId: "evoker" }, id)).toThrow();
  });

  it("accepts the new fields in the schema", () => {
    expect(gameStateSchema.safeParse(newGame()).success).toBe(true);
  });
});

describe("v4 -> v5", () => {
  it("seeds the story items with what the players carry", () => {
    const { storyItems: _items, ...rest } = newGame();
    const player = { ...rest.players[0]!, inventory: [{ name: "Daga", quantity: 2 }] };
    const game = migrateSave({ ...rest, version: 4, players: [player] });
    expect(game?.version).toBe(GAME_STATE_VERSION);
    expect(game?.storyItems).toEqual([{ name: "Daga", description: "", location: "", status: "taken" }]);
  });
});

describe("v5 -> v6", () => {
  it("gives every NPC an empty voice", () => {
    const game = newGame();
    const npcs = [{ name: "Berta", description: "Posadera", attitude: "neutral", present: true }];
    const migrated = migrateSave({ ...game, version: 5, npcs });
    expect(migrated?.version).toBe(GAME_STATE_VERSION);
    expect(migrated?.npcs[0]?.voice).toBe("");
  });
});

describe("v6 -> v7", () => {
  it("gives every NPC no portrait", () => {
    const game = newGame();
    const npcs = [{ name: "Berta", description: "Posadera", attitude: "neutral", present: true, voice: "" }];
    const migrated = migrateSave({ ...game, version: 6, npcs });
    expect(migrated?.version).toBe(GAME_STATE_VERSION);
    expect(migrated?.npcs[0]?.portrait).toBeNull();
  });
});

describe("v7 -> v8", () => {
  it("renames NPCs named after their portrait archetype", () => {
    const game = newGame();
    const npc = { description: "", attitude: "neutral", present: true, voice: "", portrait: "innkeeper-male" };
    const npcs = [{ ...npc, name: "innkeeper-male" }, { ...npc, name: "Berta" }];
    const scene = { inCombat: false, turnOf: "innkeeper-male" };
    const migrated = migrateSave({ ...game, version: 7, npcs, scene });
    expect(migrated?.npcs.map((n) => n.name)).toEqual(["Tabernero", "Berta"]);
    expect(migrated?.scene.turnOf).toBe("Tabernero");
  });
});

describe("v8 -> v9", () => {
  it("gives a pending player roll the normal mode", () => {
    const game = newGame();
    const pending = { die: "d20", count: 1, reason: "x", difficulty: 12 };
    const migrated = migrateSave({ ...game, version: 8, pendingPlayerRoll: pending });
    expect(migrated?.version).toBe(GAME_STATE_VERSION);
    expect(migrated?.pendingPlayerRoll).toEqual({ ...pending, mode: "normal" });
  });

  it("gives pending enemy rolls and past enemy_rolls turns the normal mode", () => {
    const game = newGame();
    const request = { die: "d20", count: 1, modifier: 2, reason: "x" };
    const turn = {
      number: 1,
      input: { type: "enemy_rolls", results: [{ ...request, values: [5], total: 7 }] },
      narration: "n",
      events: [],
      stateChanges: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const migrated = migrateSave({
      ...game,
      version: 8,
      pendingEnemyRolls: [request],
      turns: [turn],
    });
    expect(migrated?.pendingEnemyRolls).toEqual([{ ...request, mode: "normal" }]);
    const input = migrated?.turns[0]?.input;
    expect(input?.type === "enemy_rolls" && input.results[0]?.mode).toBe("normal");
  });

  it("survives malformed enemy_rolls turns and migrates the valid results", () => {
    const request = { die: "d20", count: 1, modifier: 2, reason: "x" };
    const base = { number: 1, narration: "n", events: [], stateChanges: [], createdAt: "2026-01-01T00:00:00.000Z" };
    const run = () =>
      migrateSave({
        ...newGame(),
        version: 8,
        turns: [
          { ...base, input: { type: "enemy_rolls", results: ["junk", { ...request, values: [5], total: 7 }] } },
          { ...base, number: 2 },
          null,
          { ...base, number: 3, input: { type: "enemy_rolls" } },
        ],
      });
    expect(run).not.toThrow();
    // The malformed turns fail schema validation, so the save is rejected, not crashed.
    expect(run()).toBeNull();
    const valid = migrateSave({
      ...newGame(),
      version: 8,
      turns: [{ ...base, input: { type: "enemy_rolls", results: [{ ...request, values: [5], total: 7 }] } }],
    });
    const input = valid?.turns[0]?.input;
    expect(input?.type === "enemy_rolls" && input.results[0]?.mode).toBe("normal");
  });

  it("keeps a missing pending roll as null", () => {
    const migrated = migrateSave({ ...newGame(), version: 8, pendingPlayerRoll: null });
    expect(migrated?.pendingPlayerRoll).toBeNull();
  });
});

describe("v9 -> v10", () => {
  it("adds untracked stats and hit points to every player", () => {
    const game = newGame();
    // A real v9 save has no stats or currentHp on its players.
    const players = game.players.map((p) => {
      const { stats: _stats, currentHp: _currentHp, ...legacy } = p;
      return legacy;
    });
    expect(players.every((p) => !("stats" in p) && !("currentHp" in p))).toBe(true);
    const migrated = migrateSave({ ...game, players, version: 9 });
    expect(migrated?.version).toBe(GAME_STATE_VERSION);
    expect(migrated?.players.every((p) => p.stats === null && p.currentHp === null)).toBe(true);
  });
});


describe("v10 -> v11", () => {
  it("adds a healthy condition, no death saves and no milestones to every player", () => {
    const game = newGame();
    const players = game.players.map((p) => {
      const { condition: _c, deathSaves: _d, milestonesSinceLevel: _m, ...legacy } = p;
      return legacy;
    });
    const migrated = migrateSave({ ...game, players, version: 10 });
    expect(migrated?.version).toBe(GAME_STATE_VERSION);
    expect(migrated?.players[0]).toMatchObject({
      condition: "ok",
      deathSaves: { successes: 0, failures: 0 },
      milestonesSinceLevel: 0,
    });
  });

  it("keeps a v10 player at 0 HP dying rather than healthy", () => {
    const game = newGame();
    const stats = {
      maxHp: 20, armorClass: 14, initiative: 3, speed: 30, hitDice: "3d8",
      attacks: [], spellSaveDc: null, spellAttackBonus: null,
    };
    const players = game.players.map((p) => {
      const { condition: _c, deathSaves: _d, milestonesSinceLevel: _m, ...legacy } = p;
      return { ...legacy, stats, currentHp: 0 };
    });
    const migrated = migrateSave({ ...game, players, version: 10 });
    expect(migrated?.players[0]?.condition).toBe("dying");
  });
});

describe("v11 -> v12", () => {
  it("adds untracked NPC hit points, an empty initiative order and no suggestions", () => {
    const game = newGame();
    const { suggestedActions: _s, ...rest } = game;
    const legacy = {
      ...rest,
      version: 11,
      scene: { inCombat: false, turnOf: null },
      npcs: [{ name: "Berta", description: "", attitude: "neutral", present: true, voice: "", portrait: null }],
    };
    const migrated = migrateSave(legacy);
    expect(migrated?.version).toBe(GAME_STATE_VERSION);
    expect(migrated?.npcs[0]).toMatchObject({ hp: null, maxHp: null });
    expect(migrated?.scene.order).toEqual([]);
    expect(migrated?.suggestedActions).toEqual([]);
  });
});

describe("v12 -> v13", () => {
  it("starts with no campaign threads", () => {
    const { threads: _t, ...rest } = newGame();
    const migrated = migrateSave({ ...rest, version: 12 });
    expect(migrated?.version).toBe(GAME_STATE_VERSION);
    expect(migrated?.threads).toEqual([]);
  });
});

describe("v13 -> v14", () => {
  it("marks old saves as free adventures (campaignId: null)", () => {
    const { campaignId: _c, ...rest } = newGame();
    const migrated = migrateSave({ ...rest, version: 13 });
    expect(migrated?.version).toBe(GAME_STATE_VERSION);
    expect(migrated?.campaignId).toBeNull();
  });
});
