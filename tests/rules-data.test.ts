import { describe, expect, it } from "vitest";
import {
  BACKGROUNDS,
  FEATS,
  LOADED_MAX_LEVEL,
  SPECIES,
  STANDARD_ARRAY,
  findBackground,
  findFeat,
  findSpecies,
} from "../src/rules";
import { SKILLS } from "../src/rules/types";
import type { ChoiceSpec } from "../src/rules/types";

const sorted = (xs: string[]) => [...xs].sort();

function allChoices(): ChoiceSpec[] {
  return [...SPECIES.flatMap((s) => s.choices), ...BACKGROUNDS.flatMap((b) => b.choices), ...FEATS.flatMap((f) => f.choices)];
}

describe("species", () => {
  it("has exactly the SRD 5.2 species", () => {
    expect(sorted(SPECIES.map((s) => s.id))).toEqual(
      ["dragonborn", "dwarf", "elf", "gnome", "goliath", "halfling", "human", "orc", "tiefling"],
    );
  });

  it("has the right speed and hit point bonus", () => {
    expect(findSpecies("goliath")?.speed).toBe(35);
    expect(findSpecies("dwarf")?.speed).toBe(30);
    expect(findSpecies("dwarf")?.hpBonusPerLevel).toBe(1);
    expect(findSpecies("elf")?.hpBonusPerLevel).toBe(0);
  });

  it("models the elf lineage and keen senses", () => {
    const elf = findSpecies("elf")!;
    expect(elf.choices.find((c) => c.id === "species.elf.lineage")?.options).toHaveLength(3);
    const keen = elf.choices.find((c) => c.id === "species.elf.keen_senses")!;
    expect(sorted(keen.options.map((o) => o.skill!))).toEqual(["insight", "perception", "survival"]);
  });

  it("models the human skillful and versatile traits", () => {
    const human = findSpecies("human")!;
    const skillful = human.choices.find((c) => c.id === "species.human.skillful")!;
    expect(skillful.count).toBe(1);
    expect(skillful.options).toHaveLength(18);
    const versatile = human.choices.find((c) => c.id === "species.human.versatile")!;
    const originFeats = FEATS.filter((f) => f.category === "origin").map((f) => f.id);
    expect(sorted(versatile.options.map((o) => o.id))).toEqual(sorted(originFeats));
  });

  it("finds a species by id or Spanish name, ignoring case", () => {
    expect(findSpecies("Elfo")).toBeDefined();
    expect(findSpecies("Elfo")).toBe(findSpecies("elf"));
    expect(findSpecies("ELF")).toBe(findSpecies("elf"));
    expect(findSpecies("nope")).toBeUndefined();
  });
});

describe("backgrounds", () => {
  it("has exactly the SRD 5.2 backgrounds", () => {
    expect(sorted(BACKGROUNDS.map((b) => b.id))).toEqual(["acolyte", "criminal", "sage", "soldier"]);
  });

  it("matches the SRD values", () => {
    const soldier = findBackground("soldier")!;
    expect(soldier.abilities).toEqual(["str", "dex", "con"]);
    expect(soldier.featId).toBe("savage_attacker");
    expect(soldier.skills).toEqual(["athletics", "intimidation"]);
    expect(findBackground("acolyte")?.featId).toBe("magic_initiate_cleric");
    expect(findBackground("sage")?.featId).toBe("magic_initiate_wizard");
    expect(findBackground("criminal")?.featId).toBe("alert");
  });
});

describe("choices", () => {
  it("models the soldier gaming set pick", () => {
    const pick = findBackground("soldier")!.choices.find((c) => c.id === "background.soldier.tool")!;
    expect(pick.count).toBe(1);
    expect(pick.options.map((o) => o.id)).toEqual(["dice", "dragonchess", "playing_cards", "three_dragon_ante"]);
    for (const id of ["acolyte", "criminal", "sage"]) expect(findBackground(id)?.choices).toEqual([]);
  });

  it("models the spellcasting ability of lineage species", () => {
    for (const id of ["elf", "gnome", "tiefling"]) {
      const pick = findSpecies(id)!.choices.find((c) => c.id === `species.${id}.spell_ability`)!;
      expect(pick.count).toBe(1);
      expect(pick.options.map((o) => o.id)).toEqual(["int", "wis", "cha"]);
    }
  });

  it("namespaces the Magic Initiate ability choice", () => {
    for (const list of ["cleric", "druid", "wizard"]) {
      const ids = findFeat(`magic_initiate_${list}`)!.choices.map((c) => c.id);
      expect(ids).toContain(`feat.magic_initiate_${list}.ability`);
    }
  });
});

describe("feats", () => {
  it("has the feats of this task", () => {
    expect(sorted(FEATS.map((f) => f.id))).toEqual(sorted([
      "alert", "magic_initiate_cleric", "magic_initiate_druid", "magic_initiate_wizard",
      "savage_attacker", "skilled", "ability_score_improvement", "grappler",
      "archery", "defense", "great_weapon_fighting", "two_weapon_fighting",
    ]));
  });

  it("models ability score improvement and skilled", () => {
    const asi = findFeat("ability_score_improvement")!;
    expect(asi.category).toBe("general");
    expect(asi.prerequisite?.minLevel).toBe(4);
    const pick = asi.choices.find((c) => c.id === "feat.asi.abilities")!;
    expect(pick.count).toBe(2);
    expect(pick.allowRepeat).toBe(true);
    const skilled = findFeat("skilled")!.choices.find((c) => c.id === "feat.skilled.skills")!;
    expect(skilled.count).toBe(3);
    expect(skilled.options).toHaveLength(SKILLS.length);
  });

  it("requires Strength or Dexterity 13 for grappler", () => {
    expect(findFeat("grappler")?.prerequisite?.anyAbility).toEqual({ abilities: ["str", "dex"], min: 13 });
  });
});

describe("integrity", () => {
  it("has unique ids in each list", () => {
    for (const list of [SPECIES, BACKGROUNDS, FEATS]) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("has unique choice ids and option ids within each choice", () => {
    const ids = allChoices().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of allChoices()) {
      const opts = c.options.map((o) => o.id);
      expect(new Set(opts).size).toBe(opts.length);
    }
  });

  it("points every background at an existing feat", () => {
    for (const b of BACKGROUNDS) expect(findFeat(b.featId)).toBeDefined();
  });

  it("points every requires at an existing choice", () => {
    const ids = new Set(allChoices().map((c) => c.id));
    for (const c of allChoices()) if (c.requires) expect(ids.has(c.requires.choiceId)).toBe(true);
  });

  it("marks every entry as SRD 5.2", () => {
    for (const x of [...SPECIES, ...BACKGROUNDS, ...FEATS]) expect(x.source).toBe("SRD 5.2");
  });

  it("exposes the constants", () => {
    expect(LOADED_MAX_LEVEL).toBe(4);
    expect(STANDARD_ARRAY).toEqual([15, 14, 13, 12, 10, 8]);
  });
});
