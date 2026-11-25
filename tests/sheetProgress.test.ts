import { describe, expect, it } from "vitest";
import type { Character } from "../src/domain/types";
import { statsFromSheet } from "../src/domain/stats";
import {
  confirmLevelUp,
  hiddenErrors,
  levelSpecs,
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
/** Valid level 4 picks for fighter3: what the greedy level 4 build adds (a feat, its own choices, a mastery). */
const levelFour = () => {
  const before = fighter3().picks;
  return Object.fromEntries(
    Object.entries(greedyChoices("human", "fighter", "soldier", 4).picks).filter(([id]) => !(id in before)),
  );
};

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

describe("levelSpecs", () => {
  it("keeps showing a level's choice once it is filled, so it can be changed", () => {
    const player = hero(fighter3(), 4);
    const picks = {
      ...lockedPicks(player),
      ...levelFour(),
    };
    const ids = levelSpecs(player, picks).map((s) => s.id);
    expect(ids).toContain("class.fighter.level4_feat");
    expect(ids).toContain("class.fighter.weapon_mastery_level4");
    expect(ids).not.toContain("class.fighter.skills");
  });
});

describe("applyLevelUp", () => {
  it("ignores picks of a choice the other picks no longer open", () => {
    const player = hero(fighter3(), 4);
    const picks = {
      ...lockedPicks(player),
      ...levelFour(),
      "feat.asi.abilities": ["str", "str"],
    };
    const result = applyLevelUp(player, picks);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.player.choices!.picks["feat.asi.abilities"]).toBeUndefined();
  });

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

describe("a locked pick the new level makes illegal", () => {
  it("a cleric reaching 3 with Cure Wounds prepared: it unlocks and the picker asks for another", () => {
    const player = hero(greedyChoices("human", "cleric", "acolyte", 2), 3);
    expect(player.choices!.picks["class.cleric.prepared"]).toContain("cure_wounds");
    expect(lockedPicks(player)["class.cleric.prepared"]).not.toContain("cure_wounds");
    expect(pendingSpecs(player, lockedPicks(player)).map((s) => s.id)).toContain("class.cleric.prepared");
  });

  it("once replaced, the level up applies", () => {
    const player = hero(greedyChoices("human", "cleric", "acolyte", 2), 3);
    const picks = { ...lockedPicks(player) };
    const spec = pendingSpecs(player, picks).find((s) => s.id === "class.cleric.prepared")!;
    const taken = new Set([...picks[spec.id]!, ...player.choices!.picks[spec.id]!, "aid", "bless", "lesser_restoration"]);
    while (picks[spec.id]!.length < spec.count) {
      const next = spec.options.find((o) => !taken.has(o.id))!;
      taken.add(next.id);
      picks[spec.id] = [...picks[spec.id]!, next.id];
    }
    const remaining = pendingSpecs(player, picks).filter((s) => s.id !== spec.id);
    for (const other of remaining) picks[other.id] = greedyChoices("human", "cleric", "acolyte", 3).picks[other.id] ?? [];
    const result = applyLevelUp(player, picks);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });
});

describe("hiddenErrors", () => {
  it("errors on choices the picker doesn't show, so the screen offers a way out", () => {
    // Soldier already gives Athletics: a class skill repeating it is illegal and lives in a finished choice.
    const choices = fighterChoices({ picks: { ...fighterChoices().picks, "class.fighter.skills": ["athletics", "survival"] } });
    const player: Character = { ...hero(fighterChoices(), 2), choices };
    expect(hiddenErrors(player, lockedPicks(player)).map((e) => e.field)).toEqual(["picks.class.fighter.skills"]);
  });

  it("none for a level up that just needs its picks", () => {
    const player = hero(fighterChoices(), 2);
    expect(hiddenErrors(player, lockedPicks(player))).toEqual([]);
  });
});

describe("confirmLevelUp", () => {
  const twoToThree = () => hero(greedyChoices("human", "fighter", "soldier", 2), 3);

  it("a subclass from the manual: level 3 sheet without the Champion, and the note saved", () => {
    const player = twoToThree();
    const after = confirmLevelUp(player, lockedPicks(player), { kind: "custom", name: "Maestro de armas" }, "Compañero: ninguno.");
    expect(after.choices!.level).toBe(3);
    expect(after.choices!.srdSubclass).toBe(false);
    expect(after.outsideSrd).toEqual({ note: "Compañero: ninguno.", subclass: "Maestro de armas" });
    expect(after.subclassId).toBeNull();
  });

  it("the SRD subclass: Champion set and applied", () => {
    const player = twoToThree();
    const after = confirmLevelUp(player, lockedPicks(player), { kind: "srd" }, "");
    expect(after.subclassId).toBe("champion");
    expect(after.choices!.level).toBe(3);
  });

  it("without stored choices: only the subclass and the note", () => {
    const player: Character = { ...twoToThree(), choices: null };
    const after = confirmLevelUp(player, {}, { kind: "custom", name: "Maestro de armas" }, "x");
    expect(after.outsideSrd).toEqual({ note: "x", subclass: "Maestro de armas" });
    expect(after.stats).toEqual(player.stats);
  });
});
