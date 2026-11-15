import { describe, expect, it } from "vitest";
import {
  ARMOR,
  BACKGROUNDS,
  CLASSES_DATA,
  FEATS,
  LOADED_MAX_LEVEL,
  SPECIES,
  STANDARD_ARRAY,
  WEAPONS,
  findBackground,
  findClass,
  findFeat,
  findItem,
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
    for (const x of [...SPECIES, ...BACKGROUNDS, ...FEATS, ...WEAPONS, ...ARMOR]) expect(x.source).toBe("SRD 5.2");
  });

  it("exposes the constants", () => {
    expect(LOADED_MAX_LEVEL).toBe(4);
    expect(STANDARD_ARRAY).toEqual([15, 14, 13, 12, 10, 8]);
  });
});

describe("equipment data", () => {
  it("has a longsword with a mastery property", () => {
    const sword = findItem("longsword");
    expect(sword && "damage" in sword ? sword.damage : null).toBe("1d8");
    expect(sword && "mastery" in sword ? sword.mastery.length : 0).toBeGreaterThan(0);
  });
  it("has unique ids across weapons and armor", () => {
    const ids = [...WEAPONS, ...ARMOR].map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(WEAPONS).toHaveLength(38);
    expect(ARMOR).toHaveLength(13);
  });
  it.each([
    ["lance", "1d10", "perforante", "Derribar"],
    ["greataxe", "1d12", "cortante", "Hender"],
    ["rapier", "1d8", "perforante", "Molestar"],
    ["spear", "1d6", "perforante", "Debilitar"],
    ["longbow", "1d8", "perforante", "Ralentizar"],
    ["hand_crossbow", "1d6", "perforante", "Molestar"],
  ])("matches the SRD table for %s", (id, damage, damageType, mastery) => {
    const w = WEAPONS.find((x) => x.id === id);
    expect(w).toMatchObject({ damage, damageType, mastery });
  });
  it("uses the PDF gender for Pesada on the longbow", () => {
    expect(WEAPONS.find((x) => x.id === "longbow")?.properties).toContain("Pesada");
  });
});

describe("classes (levels 1-4)", () => {
  const cls = (id: string) => findClass(id)!;
  const row = (id: string, level: number) => cls(id).levels[level - 1];
  const choiceIds = (id: string, level: number) => row(id, level).choices.map((c) => c.id);
  const generalFeats = FEATS.filter((f) => f.category === "general").map((f) => f.id);
  const classChoices = () =>
    CLASSES_DATA.flatMap((c) => [...c.levels.flatMap((l) => l.choices), ...c.subclass.features.flatMap((f) => f.choices ?? [])]);

  it.todo("has exactly the 12 SRD classes (second dispatch)");

  it("finds classes by id or Spanish name, ignoring case", () => {
    expect(findClass("barbarian")?.name).toBe("Bárbaro");
    expect(findClass("BÁRBARO")?.id).toBe("barbarian");
    expect(findClass("paladín")?.id).toBe("paladin");
    expect(findClass("explorador")?.id).toBe("ranger");
    expect(findClass("pícaro")?.id).toBe("rogue");
    expect(findClass("nope")).toBeUndefined();
  });

  it.each(CLASSES_DATA.map((c) => [c.id]))("%s has rows 1..LOADED_MAX_LEVEL with proficiency 2", (id) => {
    const c = cls(id);
    expect(c.levels).toHaveLength(LOADED_MAX_LEVEL);
    expect(c.levels.map((l) => l.level)).toEqual([1, 2, 3, 4]);
    for (const l of c.levels) expect(l.proficiencyBonus).toBe(2);
    expect(c.source).toBe("SRD 5.2");
  });

  it.each(CLASSES_DATA.map((c) => [c.id]))("%s gets its subclass at level 3 and a level 4 feat choice", (id) => {
    expect(cls(id).subclass.level).toBe(3);
    expect(cls(id).subclass.features.length).toBeGreaterThan(0);
    const feat = row(id, 4).choices.find((c) => c.id === `class.${id}.level4_feat`);
    expect(feat?.options.map((o) => o.id).sort()).toEqual([...generalFeats].sort());
    expect(feat?.options.map((o) => o.id)).toContain("ability_score_improvement");
  });

  it("has unique choice ids across species, backgrounds, feats and classes", () => {
    const ids = [...allChoices(), ...classChoices()].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only references existing equipment or text items", () => {
    for (const c of CLASSES_DATA) {
      for (const opt of Object.values(c.equipment)) {
        for (const item of opt?.items ?? []) {
          expect(item.startsWith("text:") || findItem(item) !== undefined, `${c.id}: ${item}`).toBe(true);
        }
      }
    }
  });

  it("weapon mastery choices use real weapons and match the class count", () => {
    for (const c of CLASSES_DATA) {
      const picks = c.levels.flatMap((l) => l.choices).filter((x) => x.id.startsWith(`class.${c.id}.weapon_mastery`));
      for (const p of picks) for (const o of p.options) expect(WEAPONS.some((w) => w.id === o.id)).toBe(true);
      expect(row(c.id, 1).choices.find((x) => x.id === `class.${c.id}.weapon_mastery`)?.count ?? 0).toBe(c.weaponMasteryCount);
    }
  });

  it("models the barbarian", () => {
    const b = cls("barbarian");
    expect(b).toMatchObject({ hitDie: 12, saves: ["str", "con"], weaponMasteryCount: 2, unarmoredDefense: "barbarian", spellcasting: null });
    expect(b.skillChoice.count).toBe(2);
    expect(sorted(b.skillChoice.options)).toEqual(
      sorted(["animal_handling", "athletics", "intimidation", "nature", "perception", "survival"]),
    );
    expect(row("barbarian", 1).resources.Furias).toBe(2);
    expect(row("barbarian", 3).resources.Furias).toBe(3);
    expect(choiceIds("barbarian", 1)).toContain("class.barbarian.weapon_mastery");
    expect(b.subclass.id).toBe("berserker");
  });

  it("models the fighter", () => {
    const f = cls("fighter");
    expect(f).toMatchObject({ hitDie: 10, saves: ["str", "con"], weaponMasteryCount: 3 });
    const style = row("fighter", 1).choices.find((c) => c.id === "class.fighter.fighting_style");
    expect(style?.options.map((o) => o.id).sort()).toEqual(
      FEATS.filter((x) => x.category === "fighting_style").map((x) => x.id).sort(),
    );
    expect(f.subclass.id).toBe("champion");
    expect(row("fighter", 1).resources["Tomar aliento"]).toBe(2);
  });

  it("models the rogue", () => {
    const r = cls("rogue");
    expect(r).toMatchObject({ hitDie: 8, saves: ["dex", "int"] });
    expect(r.skillChoice.count).toBe(4);
    expect(row("rogue", 1).choices.find((c) => c.id === "class.rogue.expertise")?.count).toBe(2);
    expect(r.subclass.id).toBe("thief");
  });

  it("models the monk", () => {
    const m = cls("monk");
    expect(m).toMatchObject({ hitDie: 8, saves: ["str", "dex"], weaponMasteryCount: 0, unarmoredDefense: "monk" });
    expect(row("monk", 2).resources["Puntos de concentración"]).toBe(2);
    expect(row("monk", 4).resources["Puntos de concentración"]).toBe(4);
  });

  it("models the paladin as a caster from level 1", () => {
    const p = cls("paladin");
    expect(p).toMatchObject({ hitDie: 10, saves: ["wis", "cha"], spellcasting: { ability: "cha" } });
    expect(p.levels.map((l) => l.slots)).toEqual([[2], [2], [3], [3]]);
    expect(p.levels.map((l) => l.preparedSpells)).toEqual([2, 3, 4, 5]);
    expect(choiceIds("paladin", 2)).toContain("class.paladin.fighting_style");
  });

  it("models the ranger as a caster from level 1", () => {
    const r = cls("ranger");
    expect(r).toMatchObject({ hitDie: 10, saves: ["str", "dex"], spellcasting: { ability: "wis" } });
    expect(r.levels.map((l) => l.slots)).toEqual([[2], [2], [3], [3]]);
    expect(r.levels.map((l) => l.preparedSpells)).toEqual([2, 3, 4, 5]);
    expect(choiceIds("ranger", 2)).toEqual(
      expect.arrayContaining(["class.ranger.fighting_style", "class.ranger.expertise"]),
    );
  });
});
