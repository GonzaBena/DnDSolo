import { describe, expect, it } from "vitest";
import type { Character } from "../src/domain/types";
import { statsFromSheet } from "../src/domain/stats";
import { applySubclassPick, needsSubclassChoice, setOutsideSrd, stripOutsideSrdPhrase } from "../src/domain/outsideSrd";
import { buildSheet, type CharacterChoices } from "../src/rules/buildSheet";
import { OUTSIDE_SRD_PHRASE } from "../src/rules/generatorPrompt";
import { greedyChoices, newGame } from "./helpers";

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

  it("custom: the name, no SRD subclass, and the sheet rebuilt without it", () => {
    const before = sorcerer();
    const after = applySubclassPick(before, { kind: "custom", name: "  Hechicería salvaje " });
    expect(after.outsideSrd.subclass).toBe("Hechicería salvaje");
    expect(after.subclassId).toBeNull();
    expect(after.choices!.srdSubclass).toBe(false);
    expect(after.stats!.maxHp).toBe(before.stats!.maxHp - 3); // no Draconic Resilience
    expect(after.currentHp).toBe(before.currentHp! - 3);
  });

  it("srd: back to the SRD subclass and its hit points", () => {
    const custom = applySubclassPick(sorcerer(), { kind: "custom", name: "Hechicería salvaje" });
    const back = applySubclassPick(custom, { kind: "srd" });
    expect(back.subclassId).toBe("draconic");
    expect(back.outsideSrd.subclass).toBeNull();
    expect(back.choices!.srdSubclass).toBeUndefined();
    expect(back.stats!.maxHp).toBe(sorcerer().stats!.maxHp);
  });

  it("a blank name means no subclass from the manual", () =>
    expect(applySubclassPick(sorcerer(), { kind: "custom", name: "   " }).outsideSrd.subclass).toBeNull());

  it("without stored choices only the names change", () => {
    const after = applySubclassPick(hero(null, { level: 3 }), { kind: "custom", name: "Maestro de armas" });
    expect(after.outsideSrd.subclass).toBe("Maestro de armas");
    expect(after.choices).toBeNull();
  });
});

describe("setOutsideSrd", () => {
  it("trims and cuts the note to 1000 characters", () => {
    const after = setOutsideSrd(hero(null), { note: ` ${"a".repeat(1200)}`, subclass: null });
    expect(after.outsideSrd.note).toBe("a".repeat(1000));
  });
  it("a null subclass leaves it as it was", () => {
    const p = hero(null, { level: 3, outsideSrd: { note: "", subclass: "Maestro de armas" } });
    expect(setOutsideSrd(p, { note: "x", subclass: null }).outsideSrd).toEqual({ note: "x", subclass: "Maestro de armas" });
  });
});

describe("stripOutsideSrdPhrase", () => {
  it("drops the generator's fixed phrase", () =>
    expect(stripOutsideSrdPhrase(`${OUTSIDE_SRD_PHRASE} Pediste Ermitaño; te di Sabio.`)).toBe("Pediste Ermitaño; te di Sabio."));
  it("keeps a note without it", () => expect(stripOutsideSrdPhrase("Pediste Ermitaño.")).toBe("Pediste Ermitaño."));
  it("null is empty", () => expect(stripOutsideSrdPhrase(null)).toBe(""));
});
