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
