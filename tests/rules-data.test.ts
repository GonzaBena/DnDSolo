import { describe, expect, it } from "vitest";
import {
  ARMOR,
  BACKGROUNDS,
  CLASSES_DATA,
  FEATS,
  LOADED_MAX_LEVEL,
  SPECIES,
  SPELLS,
  STANDARD_ARRAY,
  WEAPONS,
  findBackground,
  findClass,
  findFeat,
  findItem,
  findSpecies,
  findSpell,
  spellsFor,
} from "../src/rules";
import { SHEET_HOOKS, isWeaponProficient } from "../src/rules/sheet";
import { SKILLS, requirementsOf } from "../src/rules/types";
import type { ChoiceSpec } from "../src/rules/types";

const sorted = (xs: string[]) => [...xs].sort();
const CLASS_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/** Slots by level of the full casters (SRD tables of bard, cleric, druid, sorcerer and wizard). */
const FULL_CASTER_SLOTS = [[2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2]];

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
    for (const c of allChoices()) for (const r of requirementsOf(c)) expect(ids.has(r.choiceId)).toBe(true);
  });

  it("marks every entry as SRD 5.2", () => {
    for (const x of [...SPECIES, ...BACKGROUNDS, ...FEATS, ...WEAPONS, ...ARMOR]) expect(x.source).toBe("SRD 5.2");
  });

  it("exposes the constants", () => {
    expect(LOADED_MAX_LEVEL).toBe(10);
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

describe("classes (levels 1-10)", () => {
  const cls = (id: string) => findClass(id)!;
  const row = (id: string, level: number) => cls(id).levels[level - 1];
  const choiceIds = (id: string, level: number) => row(id, level).choices.map((c) => c.id);
  const level4Feats = (withStyles: boolean) =>
    FEATS.filter((f) => f.category !== "fighting_style" || withStyles).map((f) => f.id);
  const classChoices = () =>
    CLASSES_DATA.flatMap((c) => [...c.levels.flatMap((l) => l.choices), ...c.subclass.features.flatMap((f) => f.choices ?? [])]);

  it("has exactly the 12 SRD classes", () => {
    expect(CLASSES_DATA).toHaveLength(12);
    expect(sorted(CLASSES_DATA.map((c) => c.name))).toEqual(
      sorted(["Bárbaro", "Bardo", "Brujo", "Clérigo", "Druida", "Explorador", "Guerrero", "Hechicero", "Mago", "Monje", "Paladín", "Pícaro"]),
    );
  });

  it("finds classes by id or Spanish name, ignoring case", () => {
    expect(findClass("barbarian")?.name).toBe("Bárbaro");
    expect(findClass("BÁRBARO")?.id).toBe("barbarian");
    expect(findClass("paladín")?.id).toBe("paladin");
    expect(findClass("explorador")?.id).toBe("ranger");
    expect(findClass("pícaro")?.id).toBe("rogue");
    expect(findClass("nope")).toBeUndefined();
  });

  it.each(CLASSES_DATA.map((c) => [c.id]))("%s has rows 1..LOADED_MAX_LEVEL with the SRD proficiency bonus", (id) => {
    const c = cls(id);
    expect(c.levels).toHaveLength(LOADED_MAX_LEVEL);
    expect(c.levels.map((l) => l.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(c.levels.map((l) => l.proficiencyBonus)).toEqual([2, 2, 2, 2, 3, 3, 3, 3, 4, 4]);
    expect(c.source).toBe("SRD 5.2");
  });

  it.each(CLASSES_DATA.map((c) => [c.id]))("%s gets its subclass at level 3 and a level 4 feat choice", (id) => {
    expect(cls(id).subclass.level).toBe(3);
    expect(cls(id).subclass.features.length).toBeGreaterThan(0);
    const feat = row(id, 4).choices.find((c) => c.id === `class.${id}.level4_feat`);
    const withStyles = ["fighter", "paladin", "ranger"].includes(id);
    expect(feat?.options.map((o) => o.id).sort()).toEqual(level4Feats(withStyles).sort());
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
    for (const b of BACKGROUNDS) {
      for (const item of [...b.equipment.A, ...b.equipment.B]) {
        expect(item.startsWith("text:") || findItem(item) !== undefined, `${b.id}: ${item}`).toBe(true);
      }
    }
  });

  it("only uses weapon proficiencies the sheet knows how to apply", () => {
    for (const c of CLASSES_DATA) expect(() => isWeaponProficient(WEAPONS[0]!, c.weapons), c.id).not.toThrow();
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
    expect(p.levels.map((l) => l.slots)).toEqual([[2], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2]]);
    expect(p.levels.map((l) => l.preparedSpells)).toEqual([2, 3, 4, 5, 6, 6, 7, 7, 9, 9]);
    expect(choiceIds("paladin", 2)).toContain("class.paladin.fighting_style");
  });

  it("models the ranger as a caster from level 1", () => {
    const r = cls("ranger");
    expect(r).toMatchObject({ hitDie: 10, saves: ["str", "dex"], spellcasting: { ability: "wis" } });
    expect(r.levels.map((l) => l.slots)).toEqual([[2], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2]]);
    expect(r.levels.map((l) => l.preparedSpells)).toEqual([2, 3, 4, 5, 6, 6, 7, 7, 9, 9]);
    expect(choiceIds("ranger", 2)).toEqual(
      expect.arrayContaining(["class.ranger.fighting_style", "class.ranger.expertise"]),
    );
  });

  const masteryTotal = (id: string) =>
    cls(id).levels.flatMap((l) => l.choices).filter((c) => c.id.startsWith(`class.${id}.weapon_mastery`)).reduce((n, c) => n + c.count, 0);

  it.each([
    ["barbarian", 4], ["fighter", 5], ["paladin", 2], ["ranger", 2], ["rogue", 2], ["monk", 0],
    ["bard", 0], ["cleric", 0], ["druid", 0], ["sorcerer", 0], ["warlock", 0], ["wizard", 0],
  ])(
    "%s has %i weapon mastery picks by level 10", (id, total) => {
      expect(masteryTotal(id)).toBe(total);
    },
  );

  it.each([
    ["barbarian", 2, ["animal_handling", "athletics", "intimidation", "nature", "perception", "survival"]],
    ["fighter", 2, ["acrobatics", "animal_handling", "athletics", "history", "insight", "intimidation", "perception", "persuasion", "survival"]],
    ["monk", 2, ["acrobatics", "athletics", "history", "insight", "religion", "stealth"]],
    ["paladin", 2, ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"]],
    ["ranger", 3, ["animal_handling", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"]],
    ["rogue", 4, ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "persuasion", "sleight_of_hand", "stealth"]],
    ["bard", 3, SKILLS.map((x) => x.id).sort()],
    ["cleric", 2, ["history", "insight", "medicine", "persuasion", "religion"]],
    ["druid", 2, ["animal_handling", "arcana", "insight", "medicine", "nature", "perception", "religion", "survival"]],
    ["sorcerer", 2, ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"]],
    ["warlock", 2, ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"]],
    ["wizard", 2, ["arcana", "history", "insight", "investigation", "medicine", "nature", "religion"]],
  ])("%s skill choice: %i of the SRD list", (id, count, options) => {
    expect(cls(id).skillChoice.count).toBe(count);
    expect(sorted(cls(id).skillChoice.options)).toEqual(options);
  });

  it.each([
    ["barbarian", ["Armaduras ligeras", "Armaduras medias", "Escudos"], ["Armas sencillas", "Armas marciales"], []],
    ["fighter", ["Armaduras ligeras", "Armaduras medias", "Armaduras pesadas", "Escudos"], ["Armas sencillas", "Armas marciales"], []],
    ["monk", [], ["Armas sencillas", "Armas marciales con la propiedad ligera"], ["Un tipo de herramientas de artesano o instrumento musical a elección"]],
    ["paladin", ["Armaduras ligeras", "Armaduras medias", "Armaduras pesadas", "Escudos"], ["Armas sencillas", "Armas marciales"], []],
    ["ranger", ["Armaduras ligeras", "Armaduras medias", "Escudos"], ["Armas sencillas", "Armas marciales"], []],
    ["rogue", ["Armaduras ligeras"], ["Armas sencillas", "Armas marciales con las propiedades ligera o sutil"], ["Herramientas de ladrón"]],
    ["bard", ["Armaduras ligeras"], ["Armas sencillas"], ["Tres instrumentos musicales a elección"]],
    ["cleric", ["Armaduras ligeras", "Armaduras medias", "Escudos"], ["Armas sencillas"], []],
    ["druid", ["Armaduras ligeras", "Escudos"], ["Armas sencillas"], ["Útiles de herborista"]],
    ["sorcerer", [], ["Armas sencillas"], []],
    ["warlock", ["Armaduras ligeras"], ["Armas sencillas"], []],
    ["wizard", [], ["Armas sencillas"], []],
  ])("%s armor, weapon and tool proficiencies", (id, armor, weapons, tools) => {
    expect(cls(id)).toMatchObject({ armor, weapons, tools });
  });

  it("monk tool choice offers 17 artisan tools and 10 instruments", () => {
    const tool = row("monk", 1).choices.find((c) => c.id === "class.monk.tool");
    expect(tool?.count).toBe(1);
    expect(tool?.options).toHaveLength(27);
  });

  it("tracks class resources by level", () => {
    const of = (id: string, resource: string) => CLASS_LEVELS.map((n) => row(id, n).resources[resource]);
    expect(of("paladin", "Imponer las manos")).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
    expect(of("paladin", "Canalizar divinidad")).toEqual([undefined, undefined, 2, 2, 2, 2, 2, 2, 2, 2]);
    expect(of("rogue", "Ataque furtivo (d6)")).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(of("barbarian", "Furias")).toEqual([2, 2, 3, 3, 3, 4, 4, 4, 4, 4]);
    expect(of("barbarian", "Daño por furia")).toEqual([2, 2, 2, 2, 2, 2, 2, 2, 3, 3]);
    expect(of("fighter", "Tomar aliento")).toEqual([2, 2, 2, 3, 3, 3, 3, 3, 3, 4]);
    expect(of("fighter", "Indómito")).toEqual([undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 1, 1]);
    expect(of("ranger", "Enemigo predilecto")).toEqual([2, 2, 2, 2, 3, 3, 3, 3, 4, 4]);
    expect(of("monk", "Dado de artes marciales")).toEqual([6, 6, 6, 6, 8, 8, 8, 8, 8, 8]);
    expect(of("monk", "Puntos de concentración")).toEqual([undefined, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(of("monk", "Movimiento sin armadura (m)")).toEqual([undefined, 3, 3, 3, 3, 4.5, 4.5, 4.5, 4.5, 6]);
  });

  it("models Hunter's Prey, languages and expertise counts", () => {
    const prey = cls("ranger").subclass.features.flatMap((f) => f.choices ?? []).find((c) => c.id === "subclass.hunter.hunters_prey");
    expect(prey?.options.map((o) => o.id)).toEqual(["colossus_slayer", "horde_breaker"]);
    const find = (id: string, level: number, cid: string) => row(id, level).choices.find((c) => c.id === cid);
    expect(find("ranger", 2, "class.ranger.expertise")?.count).toBe(1);
    expect(find("ranger", 2, "class.ranger.languages")?.count).toBe(2);
    expect(find("rogue", 1, "class.rogue.expertise")?.count).toBe(2);
    expect(find("rogue", 1, "class.rogue.language")?.count).toBe(1);
    expect(find("rogue", 1, "class.rogue.language")?.options.some((o) => o.id === "thieves_cant")).toBe(false);
  });
  it("models the wizard", () => {
    const w = cls("wizard");
    expect(w).toMatchObject({ hitDie: 6, saves: ["int", "wis"], spellcasting: { ability: "int", spellList: "wizard" } });
    expect(w.levels[0].cantrips).toBe(3);
    expect(w.levels[0].preparedSpells).toBe(4);
    expect(w.levels.map((l) => l.slots)).toEqual(FULL_CASTER_SLOTS);
    expect(w.levels.map((l) => l.cantrips)).toEqual([3, 3, 3, 4, 4, 4, 4, 4, 4, 5]);
    expect(w.levels.map((l) => l.preparedSpells)).toEqual([4, 5, 6, 7, 9, 10, 11, 12, 14, 15]);
    expect(w.subclass.id).toBe("evoker");
    const scholar = row("wizard", 2).choices.find((c) => c.id === "class.wizard.scholar");
    expect(scholar?.count).toBe(1);
    expect(sorted(scholar!.options.map((o) => o.id))).toEqual(["arcana", "history", "investigation", "medicine", "nature", "religion"]);
  });

  it("models the warlock with Pact Magic slots and invocations", () => {
    const w = cls("warlock");
    expect(w).toMatchObject({ hitDie: 8, saves: ["wis", "cha"], spellcasting: { ability: "cha", spellList: "warlock" } });
    expect(w.levels.map((l) => l.pactSlots)).toEqual([
      { count: 1, slotLevel: 1 }, { count: 2, slotLevel: 1 }, { count: 2, slotLevel: 2 }, { count: 2, slotLevel: 2 },
      { count: 2, slotLevel: 3 }, { count: 2, slotLevel: 3 }, { count: 2, slotLevel: 4 }, { count: 2, slotLevel: 4 },
      { count: 2, slotLevel: 5 }, { count: 2, slotLevel: 5 },
    ]);
    expect(w.levels.every((l) => l.slots === undefined)).toBe(true);
    expect(w.levels.map((l) => l.cantrips)).toEqual([2, 2, 2, 3, 3, 3, 3, 3, 3, 4]);
    expect(w.levels.map((l) => l.preparedSpells)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 10]);
    expect(w.subclass.id).toBe("fiend");
  });

  it("gives the warlock 1 invocation at level 1 and 3 in total at level 2, all valid for that level", () => {
    const inv = (n: number) => CLASS_LEVELS.slice(0, n).flatMap((l) => row("warlock", l).choices).filter((c) => c.id.startsWith("class.warlock.invocation"));
    expect(inv(1).reduce((n, c) => n + c.count, 0)).toBe(1);
    expect(inv(2).reduce((n, c) => n + c.count, 0)).toBe(3);
    expect(inv(4).reduce((n, c) => n + c.count, 0)).toBe(3);
    expect(inv(5).reduce((n, c) => n + c.count, 0)).toBe(5);
    expect(inv(7).reduce((n, c) => n + c.count, 0)).toBe(6);
    expect(inv(10).reduce((n, c) => n + c.count, 0)).toBe(7);
    const first = row("warlock", 1).choices.find((c) => c.id === "class.warlock.invocation")!;
    // Only invocations without a level prerequisite at level 1: the three pacts, Armor of Shadows and Eldritch Mind.
    expect(sorted(first.options.map((o) => o.id))).toEqual(
      ["armor_of_shadows", "eldritch_mind", "pact_of_the_blade", "pact_of_the_chain", "pact_of_the_tome"],
    );
    const more = row("warlock", 2).choices.find((c) => c.id === "class.warlock.invocation_2")!;
    expect(more.count).toBe(2);
    expect(more.options.map((o) => o.id)).toEqual(expect.arrayContaining(["agonizing_blast", "devils_sight", "lessons_of_the_first_ones"]));
    // No invocation with a level 5+ prerequisite is offered yet.
    expect(more.options.map((o) => o.id)).not.toContain("eldritch_smite");
    expect(more.options.find((o) => o.id === "agonizing_blast")?.summary).toMatch(/Requisito/);
  });

  it("models the bard", () => {
    const b = cls("bard");
    expect(b).toMatchObject({ hitDie: 8, saves: ["dex", "cha"], spellcasting: { ability: "cha", spellList: "bard" } });
    expect(b.levels.map((l) => l.cantrips)).toEqual([2, 2, 2, 3, 3, 3, 3, 3, 3, 4]);
    expect(b.levels.map((l) => l.preparedSpells)).toEqual([4, 5, 6, 7, 9, 10, 11, 12, 14, 15]);
    expect(b.levels.map((l) => l.slots)).toEqual(FULL_CASTER_SLOTS);
    expect(b.levels.map((l) => l.resources["Dado de Inspiración bárdica"])).toEqual([6, 6, 6, 6, 8, 8, 8, 8, 8, 10]);
    expect(row("bard", 1).resources["Dado de Inspiración bárdica"]).toBe(6);
    const instruments = row("bard", 1).choices.find((c) => c.id === "class.bard.instruments");
    expect(instruments?.count).toBe(3);
    expect(instruments?.options).toHaveLength(10);
    expect(row("bard", 2).choices.find((c) => c.id === "class.bard.expertise")?.count).toBe(2);
    expect(b.subclass.id).toBe("lore");
    const bonus = b.subclass.features.flatMap((f) => f.choices ?? []).find((c) => c.id === "subclass.lore.bonus_skills");
    expect(bonus?.count).toBe(3);
  });

  it("models the cleric with Divine Order and Channel Divinity", () => {
    const c = cls("cleric");
    expect(c).toMatchObject({ hitDie: 8, saves: ["wis", "cha"], spellcasting: { ability: "wis", spellList: "cleric" } });
    expect(c.levels.map((l) => l.cantrips)).toEqual([3, 3, 3, 4, 4, 4, 4, 4, 4, 5]);
    expect(c.levels.map((l) => l.preparedSpells)).toEqual([4, 5, 6, 7, 9, 10, 11, 12, 14, 15]);
    expect(c.levels.map((l) => l.slots)).toEqual(FULL_CASTER_SLOTS);
    const order = row("cleric", 1).choices.find((x) => x.id === "class.cleric.divine_order");
    expect(order?.options.map((o) => o.id)).toEqual(["protector", "thaumaturge"]);
    expect(CLASS_LEVELS.map((n) => row("cleric", n).resources["Canalizar divinidad"])).toEqual([undefined, 2, 2, 2, 2, 3, 3, 3, 3, 3]);
    expect(c.subclass.id).toBe("life");
  });

  it("models the druid with Primal Order, Wild Shape and the Circle of the Land", () => {
    const d = cls("druid");
    expect(d).toMatchObject({ hitDie: 8, saves: ["int", "wis"], spellcasting: { ability: "wis", spellList: "druid" } });
    expect(d.levels.map((l) => l.cantrips)).toEqual([2, 2, 2, 3, 3, 3, 3, 3, 3, 4]);
    expect(d.levels.map((l) => l.preparedSpells)).toEqual([4, 5, 6, 7, 9, 10, 11, 12, 14, 15]);
    expect(d.levels.map((l) => l.slots)).toEqual(FULL_CASTER_SLOTS);
    expect(row("druid", 1).choices.find((x) => x.id === "class.druid.primal_order")?.options.map((o) => o.id)).toEqual(["magician", "warden"]);
    expect(CLASS_LEVELS.map((n) => row("druid", n).resources["Forma salvaje"])).toEqual([undefined, 2, 2, 2, 2, 3, 3, 3, 3, 3]);
    expect(CLASS_LEVELS.map((n) => row("druid", n).resources["Formas conocidas"])).toEqual([undefined, 4, 4, 6, 6, 6, 6, 8, 8, 8]);
    expect(d.subclass.id).toBe("land");
    const land = d.subclass.features.flatMap((f) => f.choices ?? []).find((x) => x.id === "subclass.land.land_type");
    expect(land?.options.map((o) => o.id)).toEqual(["arid", "polar", "temperate", "tropical"]);
  });

  it("models the sorcerer with Sorcery Points and Metamagic", () => {
    const s = cls("sorcerer");
    expect(s).toMatchObject({ hitDie: 6, saves: ["con", "cha"], spellcasting: { ability: "cha", spellList: "sorcerer" } });
    expect(s.levels.map((l) => l.cantrips)).toEqual([4, 4, 4, 5, 5, 5, 5, 5, 5, 6]);
    expect(s.levels.map((l) => l.preparedSpells)).toEqual([2, 4, 6, 7, 9, 10, 11, 12, 14, 15]);
    expect(s.levels.map((l) => l.slots)).toEqual(FULL_CASTER_SLOTS);
    expect(CLASS_LEVELS.map((n) => row("sorcerer", n).resources["Puntos de hechicería"])).toEqual([undefined, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(CLASS_LEVELS.map((n) => row("sorcerer", n).resources["Hechicería innata"])).toEqual([2, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
    const meta = row("sorcerer", 2).choices.find((x) => x.id === "class.sorcerer.metamagic");
    expect(meta?.count).toBe(2);
    expect(meta?.options).toHaveLength(10);
    expect(s.subclass).toMatchObject({ id: "draconic", unarmoredDefense: "draconic" });
  });

  it("only the draconic sorcerer subclass overrides unarmored defense", () => {
    expect(CLASSES_DATA.filter((c) => c.subclass.unarmoredDefense).map((c) => c.id)).toEqual(["sorcerer"]);
  });

  it("uses the official Spanish subclass names", () => {
    expect(
      ["bard", "cleric", "druid", "sorcerer", "warlock", "wizard"].map((id) => cls(id).subclass.name),
    ).toEqual(["Colegio del conocimiento", "Dominio de la vida", "Círculo de la tierra", "Hechicería dracónica", "Patrón infernal", "Evocador"]);
  });
});

describe("spells (cantrips to level 2)", () => {
  it("flags the SRD rituals", () => {
    for (const id of ["detect_magic", "find_familiar", "identify", "alarm", "unseen_servant", "augury", "silence"]) {
      expect(findSpell(id)?.ritual, id).toBe(true);
    }
    for (const id of ["magic_missile", "cure_wounds", "shield", "misty_step", "fire_bolt"]) expect(findSpell(id)?.ritual, id).toBe(false);
  });

  it("flags damaging cantrips with attack roll and range", () => {
    expect(findSpell("eldritch_blast")?.damage).toEqual({ attackRoll: true, rangeFt: 120 });
    expect(findSpell("chill_touch")?.damage).toEqual({ attackRoll: true, rangeFt: 0 });
    expect(findSpell("vicious_mockery")?.damage).toEqual({ attackRoll: false, rangeFt: 60 });
    expect(findSpell("minor_illusion")?.damage).toBeUndefined();
    expect(findSpell("true_strike")?.damage).toBeUndefined();
    for (const sp of SPELLS) if (sp.damage) expect(sp.level, sp.id).toBe(0);
  });

  const LISTS = ["bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "warlock", "wizard"];

  /** Every ChoiceSpec reachable from the rules data, including class levels and subclass features. */
  function everyChoice(): ChoiceSpec[] {
    return [
      ...allChoices(),
      ...CLASSES_DATA.flatMap((c) => [
        ...c.levels.flatMap((l) => l.choices),
        ...c.subclass.features.flatMap((f) => f.choices ?? []),
      ]),
    ];
  }

  it("every spellId granted by species, feats and classes exists", () => {
    const granted = [
      ...SPECIES.flatMap((s) => s.choices),
      ...BACKGROUNDS.flatMap((b) => b.choices),
      ...FEATS.flatMap((f) => f.choices),
      ...CLASSES_DATA.flatMap((c) => c.levels.flatMap((l) => l.choices)),
      ...CLASSES_DATA.flatMap((c) => c.subclass.features.flatMap((f) => f.choices ?? [])),
    ]
      .flatMap((c) => c.options)
      .flatMap((o) => o.spells ?? []);
    expect(granted.length).toBeGreaterThan(0);
    for (const g of granted) expect(findSpell(g.spellId), g.spellId).toBeDefined();
  });

  it("has the class resources, features and options the sheet calculation relies on", () => {
    for (const [classId, names] of Object.entries(SHEET_HOOKS.resources)) {
      for (const name of names) expect(findClass(classId)!.levels.some((l) => name in l.resources), `${classId}: ${name}`).toBe(true);
    }
    for (const [classId, names] of Object.entries(SHEET_HOOKS.features)) {
      const features = findClass(classId)!.levels.flatMap((l) => l.features.map((f) => f.name));
      for (const name of names) expect(features, `${classId}: ${name}`).toContain(name);
    }
    const specs = CLASSES_DATA.flatMap((c) => c.levels.flatMap((l) => l.choices));
    const items = [
      ...CLASSES_DATA.flatMap((c) => Object.values(c.equipment).flatMap((e) => e?.items ?? [])),
      ...BACKGROUNDS.flatMap((b) => [...b.equipment.A, ...b.equipment.B]),
    ];
    const allSpecs = [...specs, ...BACKGROUNDS.flatMap((b) => b.choices)];
    for (const [item, choiceId] of Object.entries(SHEET_HOOKS.itemsFromPicks)) {
      expect(items, item).toContain(item);
      expect(allSpecs.map((s) => s.id), item).toContain(choiceId);
    }
    for (const [choiceId, ids] of Object.entries(SHEET_HOOKS.options)) {
      const options = specs.find((s) => s.id === choiceId)?.options.map((o) => o.id);
      for (const id of ids) expect(options, `${choiceId}: ${id}`).toContain(id);
    }
  });

  it("gives the Strength column of heavy armor", () => {
    const strength = (id: string) => ARMOR.find((a) => a.id === id)?.strength;
    expect([strength("ring_mail"), strength("chain_mail"), strength("splint_armor"), strength("plate_armor")]).toEqual([undefined, 13, 15, 15]);
    expect(ARMOR.filter((a) => a.strength !== undefined).map((a) => a.id)).toEqual(["chain_mail", "splint_armor", "plate_armor"]);
  });

  it("every always-prepared spell of species and class features exists", () => {
    const ids = [
      ...SPECIES.flatMap((s) => s.spells ?? []).map((g) => g.spellId),
      ...CLASSES_DATA.flatMap((c) => c.levels.flatMap((l) => l.features)).flatMap((t) => t.spells ?? []),
      ...CLASSES_DATA.flatMap((c) => c.subclass.features).flatMap((f) => f.feature.spells ?? []),
    ];
    expect(ids).toEqual(expect.arrayContaining(["thaumaturgy", "speak_with_animals", "hunters_mark", "divine_smite", "command"]));
    for (const id of ids) expect(findSpell(id), id).toBeDefined();
  });

  it("has unique ids, valid levels, known lists and a non-empty summary", () => {
    expect(new Set(SPELLS.map((s) => s.id)).size).toBe(SPELLS.length);
    for (const s of SPELLS) {
      expect([0, 1, 2, 3, 4, 5]).toContain(s.level);
      expect(s.summary.trim(), s.id).not.toBe("");
      expect(s.name.trim(), s.id).not.toBe("");
      expect(s.school.trim(), s.id).not.toBe("");
      expect(s.lists.length, s.id).toBeGreaterThan(0);
      for (const l of s.lists) expect(LISTS, `${s.id}: ${l}`).toContain(l);
      expect(s.source).toBe("SRD 5.2");
    }
  });

  it("spellsFor filters by list and level", () => {
    expect(spellsFor("wizard", 0).map((s) => s.id)).toContain("ray_of_frost");
    expect(spellsFor("cleric", 1).map((s) => s.id)).toContain("cure_wounds");
    expect(spellsFor("wizard", 0).every((s) => s.level === 0 && s.lists.includes("wizard"))).toBe(true);
    expect(spellsFor("fighter", 1)).toEqual([]);
  });

  it("matches known list sizes from the SRD spell list tables", () => {
    expect(spellsFor("wizard", 0)).toHaveLength(15);
    expect(spellsFor("cleric", 0)).toHaveLength(7);
    expect(spellsFor("druid", 0)).toHaveLength(11);
    expect(spellsFor("bard", 0)).toHaveLength(10);
    expect(SPELLS.filter((s) => s.level === 0)).toHaveLength(27);
    expect(SPELLS.filter((s) => s.level === 1)).toHaveLength(57);
    expect(SPELLS.filter((s) => s.level === 2)).toHaveLength(57);
  });

  it("cross-checks list membership of a few spells against their own class lines", () => {
    expect(findSpell("faerie_fire")?.lists.sort()).toEqual(["bard", "druid"]);
    expect(findSpell("find_familiar")?.lists).toEqual(["wizard"]);
    expect(findSpell("divine_smite")?.lists).toEqual(["paladin"]);
    expect(findSpell("hex")?.lists).toEqual(["warlock"]);
    expect(findSpell("detect_magic")?.lists).toHaveLength(8);
  });

  for (const list of ["cleric", "druid", "wizard"] as const) {
    it(`Magic Initiate (${list}) offers exactly the ${list} cantrips and level 1 spells`, () => {
      const feat = findFeat(`magic_initiate_${list}`)!;
      const cantrips = feat.choices.find((c) => c.id === `feat.magic_initiate_${list}.cantrips`)!;
      const spell = feat.choices.find((c) => c.id === `feat.magic_initiate_${list}.spell`)!;
      expect(cantrips.count).toBe(2);
      expect(spell.count).toBe(1);
      expect(cantrips.options.map((o) => o.id)).toEqual(spellsFor(list, 0).map((s) => s.id));
      expect(spell.options.map((o) => o.id)).toEqual(spellsFor(list, 1).map((s) => s.id));
    });
  }

  const extraCantrips = [
    { id: "class.paladin.blessed_warrior_cantrips", list: "cleric", count: 2, choice: "class.paladin.fighting_style", option: "blessed_warrior" },
    { id: "class.ranger.druidic_warrior_cantrips", list: "druid", count: 2, choice: "class.ranger.fighting_style", option: "druidic_warrior" },
    { id: "class.cleric.thaumaturge_cantrip", list: "cleric", count: 1, choice: "class.cleric.divine_order", option: "thaumaturge" },
    { id: "class.druid.magician_cantrip", list: "druid", count: 1, choice: "class.druid.primal_order", option: "magician" },
  ];
  for (const e of extraCantrips) {
    it(`${e.id} requires an existing pick and offers the ${e.list} cantrips`, () => {
      const matches = everyChoice().filter((c) => c.id === e.id);
      expect(matches).toHaveLength(1);
      const spec = matches[0]!;
      expect(spec.count).toBe(e.count);
      expect(spec.requires).toEqual({ choiceId: e.choice, optionId: e.option });
      const target = everyChoice().find((c) => c.id === e.choice);
      expect(target?.options.some((o) => o.id === e.option)).toBe(true);
      expect(spec.options.map((o) => o.id)).toEqual(spellsFor(e.list, 0).map((s) => s.id));
    });
  }
});
