import { describe, expect, it } from "vitest";
import type { Character } from "../src/domain/types";
import { statsFromSheet } from "../src/domain/stats";
import {
  applyLevelUp, canUpgradeSheet, lockedPicks, pendingLevelUp, pendingSpecs, previewLevelUp, upgradeSheet,
} from "../src/domain/sheetProgress";
import { buildSheet, type CharacterChoices } from "../src/rules/buildSheet";
import { fighterChoices, greedyChoices, newGame } from "./helpers";

/** A player built from `choices`, then raised to `level` (the DM's level change). */
function hero(choices: CharacterChoices, level = choices.level, overrides: Partial<Character> = {}): Character {
  const built = buildSheet(choices);
  if (!built.ok) throw new Error(JSON.stringify(built.errors));
  const stats = statsFromSheet(built.sheet);
  const player = newGame().players[0]!;
  return {
    ...player, speciesId: choices.speciesId, classId: choices.classId, srdBackgroundId: choices.backgroundId,
    level, stats, currentHp: stats.maxHp, choices, inventory: [{ name: "Cuerda", quantity: 1 }], ...overrides,
  };
}

const fighter3 = () => greedyChoices("human", "fighter", "soldier", 3);

describe("pendingLevelUp", () => {
  it("true when the level is above the choices' level", () => expect(pendingLevelUp(hero(fighter3(), 4))).toBe(true));
  it("false at the same level", () => expect(pendingLevelUp(hero(fighter3()))).toBe(false));
  it("false without rules data for the level", () => expect(pendingLevelUp(hero(fighter3(), 5))).toBe(false));
  it("false without choices", () => expect(pendingLevelUp({ ...hero(fighter3(), 4), choices: null })).toBe(false));
});

describe("pendingSpecs", () => {
  it("a level 4 fighter: the feat and the extra weapon mastery", () => {
    const player = hero(fighter3(), 4);
    const ids = pendingSpecs(player, lockedPicks(player)).map((s) => s.id);
    expect(ids).toContain("class.fighter.level4_feat");
    expect(ids).toContain("class.fighter.weapon_mastery_level4");
    expect(ids).not.toContain("class.fighter.skills");
  });

  it("picking Ability Score Improvement adds its abilities", () => {
    const player = hero(fighter3(), 4);
    const picks = { ...lockedPicks(player), "class.fighter.level4_feat": ["ability_score_improvement"] };
    expect(pendingSpecs(player, picks).map((s) => s.id)).toContain("feat.asi.abilities");
  });

  it("a wizard at level 2: spellbook and prepared spells grow under the same ids", () => {
    const player = hero(greedyChoices("human", "wizard", "sage", 1), 2);
    const specs = pendingSpecs(player, lockedPicks(player));
    const book = specs.find((s) => s.id === "class.wizard.spellbook");
    expect(book?.count).toBe(8);
    expect(player.choices!.picks["class.wizard.spellbook"]).toHaveLength(6);
    expect(specs.map((s) => s.id)).toContain("class.wizard.prepared");
  });
});

describe("applyLevelUp", () => {
  it("fighter 1 -> 2: fixed HP gain, choices at level 2, inventory kept", () => {
    const player = hero(fighterChoices(), 2);
    const result = applyLevelUp(player, player.choices!.picks);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // d10, Con 14 (+2): 10/2 + 1 + 2 = 8 more.
    expect(result.player.stats!.maxHp).toBe(player.stats!.maxHp + 8);
    expect(result.player.currentHp).toBe(player.currentHp! + 8);
    expect(result.player.choices!.level).toBe(2);
    expect(result.player.inventory).toEqual(player.inventory);
  });

  it("while dying, HP stays at 0 and the maximum still rises", () => {
    const player = hero(fighterChoices(), 2, { currentHp: 0, condition: "dying" });
    const result = applyLevelUp(player, player.choices!.picks);
    expect(result.ok && result.player.currentHp).toBe(0);
    expect(result.ok && result.player.stats!.maxHp).toBe(player.stats!.maxHp + 8);
  });

  it("missing picks: errors and no change", () => {
    const player = hero(fighter3(), 4);
    const result = applyLevelUp(player, player.choices!.picks);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThan(0);
  });

  it("previewLevelUp builds the sheet at the player's level", () => {
    const player = hero(fighterChoices(), 2);
    const preview = previewLevelUp(player, player.choices!.picks);
    expect(preview.ok && preview.sheet.level).toBe(2);
  });
});

describe("canUpgradeSheet", () => {
  const old = (overrides: Partial<Character> = {}): Character => ({
    ...newGame().players[0]!, srdBackgroundId: "criminal", ...overrides,
  });
  it("an old save with SRD ids", () => expect(canUpgradeSheet(old())).toBe(true));
  it("not without an SRD background", () => expect(canUpgradeSheet(old({ srdBackgroundId: null }))).toBe(false));
  it("not when it already has choices", () => expect(canUpgradeSheet(old({ choices: fighterChoices() }))).toBe(false));
  it("not beyond the loaded levels", () => expect(canUpgradeSheet(old({ level: 5 }))).toBe(false));
});

describe("upgradeSheet", () => {
  const choices = greedyChoices("elf", "rogue", "criminal", 3);
  const built = buildSheet(choices);
  if (!built.ok) throw new Error("rogue");
  const sheet = { ...built.sheet, hitPoints: 30 };
  const old = (currentHp: number, maxHp: number): Character => {
    const p = newGame().players[0]!;
    return { ...p, inventory: [{ name: "Daga", quantity: 2 }], stats: { ...statsFromSheet(built.sheet), maxHp }, currentHp };
  };

  it("keeps HP in proportion", () => expect(upgradeSheet(old(10, 20), choices, sheet).currentHp).toBe(15));
  it("0 stays 0", () => expect(upgradeSheet(old(0, 20), choices, sheet).currentHp).toBe(0));
  it("alive stays at least 1", () => expect(upgradeSheet(old(1, 40), choices, { ...sheet, hitPoints: 10 }).currentHp).toBe(1));

  it("replaces stats and choices, keeps everything else", () => {
    const before = old(10, 20);
    const after = upgradeSheet(before, choices, sheet);
    expect(after.stats!.maxHp).toBe(30);
    expect(after.choices).toEqual(choices);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.name).toBe(before.name);
    expect(after.level).toBe(before.level);
  });
});
