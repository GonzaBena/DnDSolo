import { describe, expect, it } from "vitest";
import { createGame } from "../src/domain/character";
import { inventoryFromSheet, statsFromForm, statsFromSheet } from "../src/domain/stats";
import { buildSheet } from "../src/rules/buildSheet";
import type { CharacterSheet } from "../src/rules/types";
import { fighterChoices, greedyChoices } from "./helpers";

function sheetOf(choices: ReturnType<typeof fighterChoices>): CharacterSheet {
  const built = buildSheet(choices);
  if (!built.ok) throw new Error("sheet failed");
  return built.sheet;
}

const base = { name: "Lira", speciesId: "elf", classId: "rogue", subclassId: null, srdBackgroundId: null, level: 1, background: "" };

describe("statsFromSheet", () => {
  it("copies the fighter's numbers and leaves spell numbers null", () => {
    const sheet = sheetOf(fighterChoices());
    const stats = statsFromSheet(sheet);
    expect(stats).toMatchObject({
      maxHp: sheet.hitPoints,
      armorClass: sheet.armorClass,
      initiative: sheet.initiative,
      speed: sheet.speed,
      hitDice: sheet.hitDice,
      spellSaveDc: null,
      spellAttackBonus: null,
    });
    expect(stats.attacks).toEqual(sheet.attacks.map(({ name, attackBonus, damage }) => ({ name, attackBonus, damage })));
    for (const attack of stats.attacks) expect(attack).not.toHaveProperty("mastery");
  });

  it("takes the spell numbers from a wizard", () => {
    const sheet = sheetOf(greedyChoices("human", "wizard", "sage", 1));
    const stats = statsFromSheet(sheet);
    expect(stats.spellSaveDc).toBe(sheet.spellcasting!.saveDc);
    expect(stats.spellAttackBonus).toBe(sheet.spellcasting!.attackBonus);
  });
});

describe("inventoryFromSheet", () => {
  it("splits quantities and adds the gold", () => {
    const sheet = sheetOf(fighterChoices());
    expect(inventoryFromSheet({ ...sheet, equipment: ["Espada larga", "Jabalina (8)"], gold: 4 })).toEqual([
      { name: "Espada larga", quantity: 1 },
      { name: "Jabalina", quantity: 8 },
      { name: "Monedas de oro", quantity: 4 },
    ]);
  });

  it("skips the gold line at zero", () => {
    const sheet = sheetOf(fighterChoices());
    expect(inventoryFromSheet({ ...sheet, equipment: ["Daga"], gold: 0 })).toEqual([{ name: "Daga", quantity: 1 }]);
  });
});

describe("statsFromForm", () => {
  it("needs both numbers", () => {
    expect(statsFromForm(18, 16)).toEqual({
      maxHp: 18, armorClass: 16, initiative: 0, speed: 9, hitDice: "", attacks: [], spellSaveDc: null, spellAttackBonus: null,
    });
    expect(statsFromForm(18, null)).toBeNull();
    expect(statsFromForm(null, 16)).toBeNull();
  });
});

describe("createGame with a sheet", () => {
  const stats = statsFromForm(18, 16)!;
  const startingInventory = [{ name: "Daga", quantity: 2 }];

  it("starts at full HP with the inventory, already marked as taken", () => {
    const game = createGame({ ...base, stats, startingInventory });
    expect(game.players[0]).toMatchObject({ stats, currentHp: 18, inventory: startingInventory });
    expect(game.storyItems).toEqual([{ name: "Daga", description: "", location: "", status: "taken" }]);
  });

  it("stays empty without them", () => {
    const game = createGame(base);
    expect(game.players[0]).toMatchObject({ stats: null, currentHp: null, inventory: [] });
    expect(game.storyItems).toEqual([]);
  });
});
