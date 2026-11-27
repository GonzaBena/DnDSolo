import { describe, expect, it } from "vitest";
import { applyLevelUp } from "../src/domain/sheetProgress";
import {
  abilityValuesOf, correctAbilities, correctStats, playerSheet, resetAbilities, resetStats, statValuesOf,
} from "../src/domain/statCorrections";
import { statsFromSheet } from "../src/domain/stats";
import type { Character } from "../src/domain/types";
import { buildSheet, type CharacterChoices } from "../src/rules/buildSheet";
import { fighterChoices, greedyChoices, newGame } from "./helpers";

function hero(choices: CharacterChoices, level = choices.level, overrides: Partial<Character> = {}): Character {
  const built = buildSheet(choices);
  if (!built.ok) throw new Error(JSON.stringify(built.errors));
  const stats = statsFromSheet(built.sheet);
  const player = newGame().players[0]!;
  return {
    ...player, speciesId: choices.speciesId, classId: choices.classId, srdBackgroundId: choices.backgroundId,
    level, stats, currentHp: stats.maxHp, choices, ...overrides,
  };
}

describe("correctStats", () => {
  it("the player's numbers become the stats, kept as differences from the built sheet", () => {
    const player = hero(fighterChoices());
    const values = statValuesOf(player.stats!);
    const result = correctStats(player, { ...values, armorClass: values.armorClass + 1, maxHp: values.maxHp + 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.player.stats!.armorClass).toBe(player.stats!.armorClass + 1);
    expect(result.player.stats!.maxHp).toBe(player.stats!.maxHp + 2);
    expect(result.player.statAdjustments).toEqual({ armorClass: 1, maxHp: 2 });
    // Full HP stays full when the maximum rises.
    expect(result.player.currentHp).toBe(result.player.stats!.maxHp);
  });

  it("the same numbers as the built sheet leave no corrections", () => {
    const player = hero(fighterChoices());
    const result = correctStats(player, statValuesOf(player.stats!));
    expect(result.ok && result.player.statAdjustments).toBeUndefined();
  });

  it("corrections survive a level up", () => {
    const player = hero(fighterChoices(), 2);
    const corrected = correctStats(player, { ...statValuesOf(player.stats!), armorClass: player.stats!.armorClass + 1 });
    if (!corrected.ok) throw new Error(corrected.message);
    const leveled = applyLevelUp(corrected.player, corrected.player.choices!.picks);
    expect(leveled.ok).toBe(true);
    if (!leveled.ok) return;
    const plain = applyLevelUp(player, player.choices!.picks);
    if (!plain.ok) throw new Error("level up failed");
    expect(leveled.player.stats!.armorClass).toBe(plain.player.stats!.armorClass + 1);
    expect(leveled.player.stats!.maxHp).toBe(plain.player.stats!.maxHp);
  });

  it("attacks: a changed bonus or damage, one removed and one added", () => {
    const player = hero(fighterChoices());
    const [first, ...others] = player.stats!.attacks;
    expect(first).toBeDefined();
    const values = {
      ...statValuesOf(player.stats!),
      attacks: [
        { ...first!, attackBonus: first!.attackBonus + 1, damage: "1d8+4" },
        { name: "Daga +1", attackBonus: 6, damage: "1d4+4" },
      ],
    };
    const result = correctStats(player, values);
    if (!result.ok) throw new Error(result.message);
    expect(result.player.stats!.attacks).toEqual(values.attacks);
    expect(result.player.statAdjustments!.attacks).toEqual({ [first!.name]: { bonus: 1, damage: "1d8+4" } });
    expect(result.player.statAdjustments!.extraAttacks).toEqual([values.attacks[1]]);
    expect(result.player.statAdjustments!.removedAttacks).toEqual(others.map((a) => a.name));
  });

  it("a non-caster can note a spell save DC from a magic item", () => {
    const player = hero(fighterChoices());
    expect(player.stats!.spellSaveDc).toBeNull();
    const result = correctStats(player, { ...statValuesOf(player.stats!), spellSaveDc: 13 });
    expect(result.ok && result.player.stats!.spellSaveDc).toBe(13);
  });

  it("refuses nonsense", () => {
    const player = hero(fighterChoices());
    const values = statValuesOf(player.stats!);
    expect(correctStats(player, { ...values, maxHp: 0 }).ok).toBe(false);
    expect(correctStats(player, { ...values, armorClass: 1.5 }).ok).toBe(false);
    expect(correctStats(player, { ...values, attacks: [{ name: " ", attackBonus: 1, damage: "" }] }).ok).toBe(false);
  });

  it("a manual sheet (no choices) just takes the numbers", () => {
    const player = { ...newGame().players[0]!, choices: null };
    const values = { maxHp: 20, armorClass: 15, initiative: 2, speed: 30, spellSaveDc: null, spellAttackBonus: null, attacks: [] };
    const result = correctStats(player, values);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.player.stats).toMatchObject(values);
    expect(result.player.statAdjustments).toBeUndefined();
  });

  it("while down, current HP stays at 0", () => {
    const player = hero(fighterChoices(), 1, { currentHp: 0, condition: "dying" });
    const result = correctStats(player, { ...statValuesOf(player.stats!), maxHp: player.stats!.maxHp + 5 });
    expect(result.ok && result.player.currentHp).toBe(0);
  });
});

describe("resetStats", () => {
  it("goes back to the built sheet", () => {
    const player = hero(fighterChoices());
    const corrected = correctStats(player, { ...statValuesOf(player.stats!), armorClass: 20 });
    if (!corrected.ok) throw new Error(corrected.message);
    const reset = resetStats(corrected.player);
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    expect(reset.player.stats).toEqual(player.stats);
    expect(reset.player.statAdjustments).toBeUndefined();
  });
});

describe("ability, save and skill corrections", () => {
  // A rogue in leather armor: Dex counts in full for AC, initiative and finesse/ranged attacks.
  const rogue = () => hero(greedyChoices("elf", "rogue", "criminal", 3));
  const built = (player: Character) => {
    const result = buildSheet(player.choices!);
    if (!result.ok) throw new Error("build failed");
    return result.sheet;
  };

  it("lowering Dexterity lowers AC, initiative and Dex attacks by the rules (no AC 20 with Dex 4)", () => {
    const player = rogue();
    const sheet = built(player);
    const values = abilityValuesOf(sheet);
    const result = correctAbilities(player, { ...values, scores: { ...values.scores, dex: 4 } });
    if (!result.ok) throw new Error(result.message);
    const dexDrop = sheet.abilities.dex.modifier - -3;
    expect(result.player.stats!.armorClass).toBe(player.stats!.armorClass - dexDrop);
    expect(result.player.stats!.initiative).toBe(player.stats!.initiative - dexDrop);
    const before = new Map(player.stats!.attacks.map((x) => [x.name, x.attackBonus]));
    const dexAttack = result.player.stats!.attacks.find((x) => before.get(x.name)! - x.attackBonus === dexDrop);
    expect(dexAttack).toBeDefined();
  });

  it("a combat correction stays on top of the recomputed number (a +1 shield on the new AC)", () => {
    const player = rogue();
    const plusOne = correctStats(player, { ...statValuesOf(player.stats!), armorClass: player.stats!.armorClass + 1 });
    if (!plusOne.ok) throw new Error(plusOne.message);
    const values = abilityValuesOf(built(player));
    const result = correctAbilities(plusOne.player, { ...values, scores: { ...values.scores, dex: values.scores.dex - 2 } });
    if (!result.ok) throw new Error(result.message);
    expect(result.player.stats!.armorClass).toBe(player.stats!.armorClass - 1 + 1);
    expect(result.player.statAdjustments).toEqual({ armorClass: 1, abilities: { dex: -2 } });
  });

  it("more Constitution, more HP at every level; current HP follows", () => {
    const player = rogue();
    const values = abilityValuesOf(built(player));
    const result = correctAbilities(player, { ...values, scores: { ...values.scores, con: values.scores.con + 2 } });
    if (!result.ok) throw new Error(result.message);
    expect(result.player.stats!.maxHp).toBe(player.stats!.maxHp + player.level);
    expect(result.player.currentHp).toBe(result.player.stats!.maxHp);
  });

  it("training a skill adds the proficiency bonus; a save proficiency too; passive Perception follows", () => {
    const player = rogue();
    const sheet = built(player);
    const values = abilityValuesOf(sheet);
    const untrainedSave = (["str", "dex", "con", "int", "wis", "cha"] as const).find((x) => !sheet.abilities[x].proficientSave)!;
    const perception = sheet.skills.find((k) => k.id === "perception")!;
    const tier = perception.expertise ? "none" : "expertise";
    const result = correctAbilities(player, {
      ...values,
      saves: { ...values.saves, [untrainedSave]: true },
      skills: { ...values.skills, perception: tier },
    });
    if (!result.ok) throw new Error(result.message);
    const after = playerSheet(result.player)!;
    expect(after.abilities[untrainedSave].save).toBe(sheet.abilities[untrainedSave].save + sheet.proficiencyBonus);
    const newPerception = after.skills.find((k) => k.id === "perception")!;
    expect(newPerception.expertise).toBe(tier === "expertise");
    expect(after.passivePerception).toBe(10 + newPerception.bonus);
  });

  it("corrections survive a level up and keep counting", () => {
    const player = hero(fighterChoices(), 2);
    const values = abilityValuesOf(built(player));
    const corrected = correctAbilities(player, { ...values, scores: { ...values.scores, con: values.scores.con + 2 } });
    if (!corrected.ok) throw new Error(corrected.message);
    const leveled = applyLevelUp(corrected.player, corrected.player.choices!.picks);
    const plain = applyLevelUp(player, player.choices!.picks);
    if (!leveled.ok || !plain.ok) throw new Error("level up failed");
    expect(leveled.player.stats!.maxHp).toBe(plain.player.stats!.maxHp + 2);
  });

  it("only what differs is kept; resetting one kind keeps the other", () => {
    const player = rogue();
    const withAc = correctStats(player, { ...statValuesOf(player.stats!), armorClass: player.stats!.armorClass + 1 });
    if (!withAc.ok) throw new Error(withAc.message);
    const values = abilityValuesOf(built(player));
    const result = correctAbilities(withAc.player, { ...values, scores: { ...values.scores, cha: values.scores.cha + 3 } });
    if (!result.ok) throw new Error(result.message);
    expect(result.player.statAdjustments).toEqual({ armorClass: 1, abilities: { cha: 3 } });
    const reset = resetStats(result.player);
    expect(reset.ok && reset.player.statAdjustments).toEqual({ abilities: { cha: 3 } });
    expect(resetAbilities(result.player).statAdjustments).toEqual({ armorClass: 1 });
  });

  it("refuses scores out of range and sheets without choices", () => {
    const player = rogue();
    const values = abilityValuesOf(built(player));
    expect(correctAbilities(player, { ...values, scores: { ...values.scores, str: 31 } }).ok).toBe(false);
    expect(correctAbilities({ ...player, choices: null }, values).ok).toBe(false);
  });
});
