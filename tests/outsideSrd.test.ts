import { describe, expect, it } from "vitest";
import type { Character } from "../src/domain/types";
import { statsFromSheet } from "../src/domain/stats";
import { applySubclassPick, needsSubclassChoice, setOutsideSrd, stripOutsideSrdPhrase } from "../src/domain/outsideSrd";
import { buildSheet, type CharacterChoices } from "../src/rules/buildSheet";
import { OUTSIDE_SRD_PHRASE } from "../src/rules/generatorPrompt";
import { greedyChoices, newGame } from "./helpers";
import { findClass } from "../src/rules";

function hero(choices: CharacterChoices | null, overrides: Partial<Character> = {}): Character {
  const p = newGame().players[0]!;
  if (!choices) return { ...p, classId: "fighter", characterClass: "Guerrero", subclassId: null, ...overrides };
  const built = buildSheet(choices);
  if (!built.ok) throw new Error(JSON.stringify(built.errors));
  const stats = statsFromSheet(built.sheet);
  return {
    ...p, speciesId: choices.speciesId, classId: choices.classId, srdBackgroundId: choices.backgroundId,
    level: choices.level, subclassId: null, stats, currentHp: stats.maxHp, choices, ...overrides,
  };
}

describe("needsSubclassChoice", () => {
  it("a level 3 fighter without a subclass", () => expect(needsSubclassChoice(hero(null, { level: 3 }))).toBe(true));
  it("not with the SRD one", () => expect(needsSubclassChoice(hero(null, { level: 3, subclassId: "champion" }))).toBe(false));
  it("not with one from the manual", () =>
    expect(needsSubclassChoice(hero(null, { level: 3, outsideSrd: { note: "", subclass: "Maestro de armas" } }))).toBe(false));
  it("not before its level", () => expect(needsSubclassChoice(hero(null, { level: 2 }))).toBe(false));
});

describe("applySubclassPick", () => {
  const sorcerer = () => hero(greedyChoices("human", "sorcerer", "sage", 3));
  const ok = (r: ReturnType<typeof applySubclassPick>) => {
    if (!r.ok) throw new Error(r.message);
    return r.player;
  };

  it("custom: the name, no SRD subclass, and the sheet rebuilt without it", () => {
    const before = sorcerer();
    const after = ok(applySubclassPick(before, { kind: "custom", name: "  Hechicería salvaje " }));
    expect(after.outsideSrd.subclass).toBe("Hechicería salvaje");
    expect(after.subclassId).toBeNull();
    expect(after.choices!.srdSubclass).toBe(false);
    expect(after.stats!.maxHp).toBe(before.stats!.maxHp - 3); // no Draconic Resilience
    expect(after.currentHp).toBe(before.currentHp! - 3);
  });

  it("srd: back to the SRD subclass and its hit points", () => {
    const custom = ok(applySubclassPick(sorcerer(), { kind: "custom", name: "Hechicería salvaje" }));
    const back = ok(applySubclassPick(custom, { kind: "srd" }));
    expect(back.subclassId).toBe("draconic");
    expect(back.outsideSrd.subclass).toBeNull();
    expect(back.choices!.srdSubclass).toBeUndefined();
    expect(back.stats!.maxHp).toBe(sorcerer().stats!.maxHp);
  });

  it("a blank name is refused", () => {
    const result = applySubclassPick(sorcerer(), { kind: "custom", name: "   " });
    expect(result.ok).toBe(false);
  });

  it("without stored choices only the names change", () => {
    const after = ok(applySubclassPick(hero(null, { level: 3 }), { kind: "custom", name: "Maestro de armas" }));
    expect(after.outsideSrd.subclass).toBe("Maestro de armas");
    expect(after.choices).toBeNull();
  });
});

describe("setOutsideSrd", () => {
  it("trims and cuts the note to 1000 characters", () => {
    const after = setOutsideSrd(hero(null), { note: ` ${"a".repeat(1200)}`, subclass: null });
    expect(after.ok && after.player.outsideSrd.note).toBe("a".repeat(1000));
  });
  it("a null subclass leaves it as it was", () => {
    const p = hero(null, { level: 3, outsideSrd: { note: "", subclass: "Maestro de armas" } });
    const after = setOutsideSrd(p, { note: "x", subclass: null });
    expect(after.ok && after.player.outsideSrd).toEqual({ note: "x", subclass: "Maestro de armas" });
  });
});

describe("stripOutsideSrdPhrase", () => {
  it("drops the generator's fixed phrase", () =>
    expect(stripOutsideSrdPhrase(`${OUTSIDE_SRD_PHRASE} Pediste Ermitaño; te di Sabio.`)).toBe("Pediste Ermitaño; te di Sabio."));
  it("keeps a note without it", () => expect(stripOutsideSrdPhrase("Pediste Ermitaño.")).toBe("Pediste Ermitaño."));
  it("null is empty", () => expect(stripOutsideSrdPhrase(null)).toBe(""));
});

describe("switching subclass when the SRD one has choices (bard, druid, ranger)", () => {
  const cases = [
    ["bard", "human", "sage", "Colegio del valor"],
    ["druid", "human", "acolyte", "Círculo de la luna"],
    ["ranger", "human", "soldier", "Maestro de las bestias"],
  ] as const;

  for (const [classId, speciesId, backgroundId, name] of cases) {
    it(`${classId}: SRD -> custom drops the SRD subclass picks and rebuilds`, () => {
      const choices = greedyChoices(speciesId, classId, backgroundId, 3);
      const before = hero(choices, { subclassId: findClass(classId)!.subclass.id });
      const result = applySubclassPick(before, { kind: "custom", name });
      if (!result.ok) throw new Error(result.message);
      expect(result.player.choices!.srdSubclass).toBe(false);
      expect(Object.keys(result.player.choices!.picks).some((k) => k.startsWith("subclass."))).toBe(false);
      expect(buildSheet(result.player.choices!).ok).toBe(true);
    });

    it(`${classId}: custom -> SRD needs the subclass's picks, so it is refused and nothing changes`, () => {
      const choices = greedyChoices(speciesId, classId, backgroundId, 3);
      const custom = applySubclassPick(hero(choices, { subclassId: findClass(classId)!.subclass.id }), { kind: "custom", name });
      if (!custom.ok) throw new Error(custom.message);
      const back = applySubclassPick(custom.player, { kind: "srd" });
      expect(back.ok).toBe(false);
      if (!back.ok) expect(back.message).toContain("No se puede");
    });
  }
});

describe("switching subclass with a level up pending", () => {
  it("the sheet is rebuilt at the level the choices were made (no stale Draconic Resilience)", () => {
    const choices = greedyChoices("human", "sorcerer", "sage", 3);
    const pending = hero(choices, { level: 4, subclassId: "draconic" });
    const result = applySubclassPick(pending, { kind: "custom", name: "Hechicería salvaje" });
    if (!result.ok) throw new Error(result.message);
    expect(result.player.stats!.maxHp).toBe(pending.stats!.maxHp - 3);
    expect(result.player.choices!.level).toBe(3);
  });
});
