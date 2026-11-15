import { describe, expect, it } from "vitest";
import { validateChoices } from "../src/rules/buildSheet";
import type { CharacterChoices, ChoiceError } from "../src/rules/buildSheet";
import { spellsFor } from "../src/rules";
import { fighterChoices } from "./helpers";

const fields = (errors: ChoiceError[]) => errors.map((e) => e.field);
const errorFor = (errors: ChoiceError[], field: string) => errors.find((e) => e.field === field);
const spellIds = (list: string, level: number) => spellsFor(list, level).map((s) => s.id);

function withPicks(picks: Record<string, string[]>, base: CharacterChoices = fighterChoices()): CharacterChoices {
  return { ...base, picks: { ...base.picks, ...picks } };
}

/** Level 4 human fighter that took Grappler: Str 12 and Dex 12 (10 + 2) after the background bonus. */
function grapplerFighter(baseScores = { str: 12, dex: 10, con: 15, int: 13, wis: 14, cha: 8 }): CharacterChoices {
  return withPicks(
    {
      "class.fighter.level4_feat": ["grappler"],
      "feat.grappler.ability": ["str"],
      "class.fighter.weapon_mastery_level4": ["dagger"],
    },
    fighterChoices({ level: 4, baseScores, backgroundBonus: { dex: 2, con: 1 } }),
  );
}

function asiFighter(abilities: string[], baseScores = fighterChoices().baseScores): CharacterChoices {
  return withPicks(
    {
      "class.fighter.level4_feat": ["ability_score_improvement"],
      "feat.asi.abilities": abilities,
      "class.fighter.weapon_mastery_level4": ["dagger"],
    },
    fighterChoices({ level: 4, baseScores }),
  );
}

function clericChoices(): CharacterChoices {
  return {
    speciesId: "human", classId: "cleric", backgroundId: "acolyte", level: 1,
    baseScores: { str: 13, dex: 12, con: 14, int: 8, wis: 15, cha: 10 },
    backgroundBonus: { wis: 2, cha: 1 },
    classEquipment: "A", backgroundEquipment: "B",
    picks: {
      "species.human.skillful": ["perception"],
      "species.human.versatile": ["alert"],
      "feat.magic_initiate_cleric.ability": ["wis"],
      "feat.magic_initiate_cleric.cantrips": ["guidance", "resistance"],
      "feat.magic_initiate_cleric.spell": [spellIds("cleric", 1)[0]!],
      "class.cleric.skills": ["history", "medicine"],
      "class.cleric.divine_order": ["protector"],
      "class.cleric.cantrips": ["sacred_flame", "light", "mending"],
      "class.cleric.prepared": spellIds("cleric", 1).slice(0, 4),
    },
  };
}

function wizardChoices(): CharacterChoices {
  const cantrips = spellIds("wizard", 0);
  const book = spellIds("wizard", 1).slice(0, 8); // 6 + 2 at level 2
  return {
    speciesId: "human", classId: "wizard", backgroundId: "sage", level: 2,
    baseScores: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
    backgroundBonus: { int: 2, con: 1 },
    classEquipment: "A", backgroundEquipment: "A",
    picks: {
      "species.human.skillful": ["perception"],
      "species.human.versatile": ["alert"],
      "feat.magic_initiate_wizard.ability": ["int"],
      "feat.magic_initiate_wizard.cantrips": cantrips.slice(3, 5),
      "feat.magic_initiate_wizard.spell": [spellIds("wizard", 1)[8]!],
      "class.wizard.skills": ["insight", "investigation"],
      "class.wizard.cantrips": cantrips.slice(0, 3),
      "class.wizard.spellbook": book,
      "class.wizard.prepared": book.slice(0, 5),
      "class.wizard.scholar": ["arcana"],
    },
  };
}

function warlockChoices(): CharacterChoices {
  return {
    speciesId: "human", classId: "warlock", backgroundId: "soldier", level: 2,
    baseScores: { str: 8, dex: 14, con: 13, int: 10, wis: 12, cha: 15 },
    backgroundBonus: { dex: 1, con: 2 },
    classEquipment: "A", backgroundEquipment: "A",
    picks: {
      "species.human.skillful": ["perception"],
      "species.human.versatile": ["alert"],
      "background.soldier.tool": ["dice"],
      "class.warlock.skills": ["arcana", "deception"],
      "class.warlock.invocation": ["eldritch_mind"],
      "class.warlock.invocation_2": ["agonizing_blast", "devils_sight"],
      "class.warlock.cantrips": ["eldritch_blast", "minor_illusion"],
      "class.warlock.prepared": spellIds("warlock", 1).slice(0, 3),
    },
  };
}

function rogueChoices(expertise: string[]): CharacterChoices {
  return {
    speciesId: "elf", classId: "rogue", backgroundId: "criminal", level: 1,
    baseScores: { str: 8, dex: 15, con: 14, int: 12, wis: 13, cha: 10 },
    backgroundBonus: { dex: 2, con: 1 },
    classEquipment: "A", backgroundEquipment: "A",
    picks: {
      "species.elf.lineage": ["wood_elf"],
      "species.elf.spell_ability": ["wis"],
      "species.elf.keen_senses": ["perception"],
      "class.rogue.skills": ["acrobatics", "deception", "insight", "investigation"],
      "class.rogue.expertise": expertise,
      "class.rogue.weapon_mastery": ["dagger", "shortsword"],
      "class.rogue.language": ["elvish"],
    },
  };
}

describe("validateChoices: valid characters", () => {
  it("accepts the fighter fixture", () => {
    expect(validateChoices(fighterChoices())).toEqual([]);
  });

  it("accepts a level 4 fighter with an ability score improvement", () => {
    expect(validateChoices(asiFighter(["str", "con"]))).toEqual([]);
    expect(validateChoices(asiFighter(["dex", "dex"]))).toEqual([]);
  });

  it("accepts a cleric, a wizard, a warlock and a rogue", () => {
    expect(validateChoices(clericChoices())).toEqual([]);
    expect(validateChoices(wizardChoices())).toEqual([]);
    expect(validateChoices(warlockChoices())).toEqual([]);
    expect(validateChoices(rogueChoices(["stealth", "perception"]))).toEqual([]);
  });

  it("accepts the Skilled feat when its skills are new", () => {
    const choices = withPicks({
      "species.human.versatile": ["skilled"],
      "feat.skilled.skills": ["arcana", "history", "stealth"],
    });
    expect(validateChoices(choices)).toEqual([]);
  });
});

describe("validateChoices: concept", () => {
  it("rejects levels outside 1..LOADED_MAX_LEVEL", () => {
    expect(fields(validateChoices(fighterChoices({ level: 0 })))).toContain("level");
    expect(fields(validateChoices(fighterChoices({ level: 5 })))).toContain("level");
    expect(fields(validateChoices(fighterChoices({ level: 1.5 })))).toContain("level");
  });

  it("rejects unknown species, class and background ids", () => {
    expect(fields(validateChoices(fighterChoices({ speciesId: "kender" })))).toContain("speciesId");
    expect(fields(validateChoices(fighterChoices({ classId: "artificer" })))).toContain("classId");
    expect(fields(validateChoices(fighterChoices({ backgroundId: "noble" })))).toContain("backgroundId");
  });
});

describe("validateChoices: ability scores", () => {
  it("requires the standard array", () => {
    const choices = fighterChoices({ baseScores: { str: 15, dex: 15, con: 13, int: 8, wis: 12, cha: 10 } });
    expect(fields(validateChoices(choices))).toEqual(["baseScores"]);
  });

  it("only allows the background abilities", () => {
    const errors = validateChoices(fighterChoices({ backgroundBonus: { int: 2, str: 1 } }));
    expect(fields(errors)).toEqual(["backgroundBonus"]);
    expect(errors[0]!.message).toContain("Inteligencia");
  });

  it("requires +2/+1 or +1/+1/+1", () => {
    expect(fields(validateChoices(fighterChoices({ backgroundBonus: { str: 2, dex: 2 } })))).toEqual(["backgroundBonus"]);
    expect(fields(validateChoices(fighterChoices({ backgroundBonus: { str: 3 } })))).toEqual(["backgroundBonus"]);
    expect(fields(validateChoices(fighterChoices({ backgroundBonus: { str: 1 } })))).toEqual(["backgroundBonus"]);
    expect(validateChoices(fighterChoices({ backgroundBonus: { str: 1, dex: 1, con: 1 } }))).toEqual([]);
  });

  it("rejects an ability score improvement above 20", () => {
    const choices = asiFighter(["str", "str"], { str: 19, dex: 14, con: 13, int: 8, wis: 12, cha: 10 });
    const errors = validateChoices(choices);
    expect(fields(errors)).toContain("picks.feat.asi.abilities");
    expect(errorFor(errors, "picks.feat.asi.abilities")!.message).toContain("Fuerza");
  });
});

describe("validateChoices: picks", () => {
  it("rejects a class skill the background already gives, naming it", () => {
    const errors = validateChoices(withPicks({ "class.fighter.skills": ["athletics", "survival"] }));
    expect(fields(errors)).toEqual(["picks.class.fighter.skills"]);
    expect(errors[0]!.message).toContain("Atletismo");
  });

  it("rejects a skill picked twice from different sources", () => {
    const errors = validateChoices(withPicks({ "species.human.skillful": ["survival"] }));
    expect(fields(errors)).toEqual(["picks.class.fighter.skills"]);
    expect(errors[0]!.message).toContain("Supervivencia");
  });

  it("rejects Skilled skills the character already has", () => {
    const choices = withPicks({
      "species.human.versatile": ["skilled"],
      "feat.skilled.skills": ["intimidation", "history", "stealth"],
    });
    expect(fields(validateChoices(choices))).toEqual(["picks.feat.skilled.skills"]);
  });

  it("rejects the wrong number of picks", () => {
    const errors = validateChoices(withPicks({ "class.fighter.weapon_mastery": ["longsword", "greatsword"] }));
    expect(fields(errors)).toEqual(["picks.class.fighter.weapon_mastery"]);
  });

  it("rejects an option that does not exist", () => {
    const errors = validateChoices(withPicks({ "class.fighter.fighting_style": ["dueling"] }));
    expect(fields(errors)).toEqual(["picks.class.fighter.fighting_style"]);
    expect(errors[0]!.message).toContain("dueling");
  });

  it("rejects a repeated option without allowRepeat", () => {
    const errors = validateChoices(withPicks({ "class.fighter.weapon_mastery": ["longsword", "longsword", "longbow"] }));
    expect(fields(errors)).toEqual(["picks.class.fighter.weapon_mastery"]);
  });

  it("rejects an active choice that was not made", () => {
    const { ["background.soldier.tool"]: _omit, ...picks } = fighterChoices().picks;
    expect(fields(validateChoices(fighterChoices({ picks })))).toEqual(["picks.background.soldier.tool"]);
    const skilled = withPicks({ "species.human.versatile": ["skilled"] });
    expect(fields(validateChoices(skilled))).toEqual(["picks.feat.skilled.skills"]);
  });

  it("rejects picks for choices this character does not have", () => {
    const errors = validateChoices(withPicks({ "class.fighter.level4_feat": ["grappler"] }));
    expect(fields(errors)).toEqual(["picks.class.fighter.level4_feat"]);
  });

  it("rejects an origin feat the background already gives", () => {
    const errors = validateChoices(withPicks({ "species.human.versatile": ["savage_attacker"] }));
    expect(fields(errors)).toEqual(["picks.species.human.versatile"]);
    expect(errors[0]!.message).toContain("Atacante salvaje");
  });

  it("rejects a class equipment option the class does not have", () => {
    const cleric = clericChoices();
    expect(fields(validateChoices({ ...cleric, classEquipment: "C" }))).toEqual(["classEquipment"]);
    expect(validateChoices(fighterChoices({ classEquipment: "C" }))).toEqual([]);
  });
});

describe("validateChoices: feat prerequisites", () => {
  it("rejects Grappler with Str 12 and Dex 12", () => {
    const errors = validateChoices(grapplerFighter());
    expect(fields(errors)).toEqual(["picks.class.fighter.level4_feat"]);
    expect(errors[0]!.message).toContain("Apresador");
  });

  it("accepts Grappler with Str 13", () => {
    expect(validateChoices(grapplerFighter({ str: 13, dex: 10, con: 15, int: 12, wis: 14, cha: 8 }))).toEqual([]);
  });
});

describe("validateChoices: expertise", () => {
  it("requires expertise in skills the character is proficient in, naming the skill", () => {
    const errors = validateChoices(rogueChoices(["stealth", "athletics"]));
    expect(fields(errors)).toEqual(["picks.class.rogue.expertise"]);
    expect(errors[0]!.message).toContain("Atletismo");
  });

  it("counts species and class skills as proficiencies", () => {
    expect(validateChoices(rogueChoices(["perception", "acrobatics"]))).toEqual([]);
  });

  it("applies the same rule to the wizard's Scholar", () => {
    const wizard = wizardChoices();
    const errors = validateChoices(withPicks({ "class.wizard.scholar": ["medicine"] }, wizard));
    expect(fields(errors)).toEqual(["picks.class.wizard.scholar"]);
    expect(errors[0]!.message).toContain("Medicina");
    expect(validateChoices(withPicks({ "class.wizard.scholar": ["investigation"] }, wizard))).toEqual([]);
  });
});

describe("validateChoices: duplicates across related choices", () => {
  it("rejects a weapon mastery repeated at level 4", () => {
    const choices = withPicks({ "class.fighter.weapon_mastery_level4": ["longsword"] }, asiFighter(["str", "con"]));
    expect(fields(validateChoices(choices))).toEqual(["picks.class.fighter.weapon_mastery_level4"]);
  });

  it("rejects an invocation taken twice unless it is repeatable", () => {
    const warlock = warlockChoices();
    const repeated = withPicks({ "class.warlock.invocation_2": ["eldritch_mind", "devils_sight"] }, warlock);
    expect(fields(validateChoices(repeated))).toEqual(["picks.class.warlock.invocation_2"]);
    const repeatable = withPicks({ "class.warlock.invocation_2": ["agonizing_blast", "agonizing_blast"] }, warlock);
    expect(validateChoices(repeatable)).toEqual([]);
  });

  it("requires one distinct origin feat per Lessons of the First Ones", () => {
    const warlock = warlockChoices();
    const lessons = withPicks({
      "class.warlock.invocation_2": ["lessons_of_the_first_ones", "devils_sight"],
      "class.warlock.lessons_feat": ["magic_initiate_wizard"],
      "feat.magic_initiate_wizard.ability": ["cha"],
      "feat.magic_initiate_wizard.cantrips": ["fire_bolt", "light"],
      "feat.magic_initiate_wizard.spell": [spellIds("wizard", 1)[0]!],
    }, warlock);
    expect(validateChoices(lessons)).toEqual([]);
    const sameAsVersatile = withPicks({ "class.warlock.lessons_feat": ["alert"] }, lessons);
    const errors = validateChoices(sameAsVersatile);
    expect(fields(errors)).toContain("picks.class.warlock.lessons_feat");
  });

  it("rejects a cantrip known twice from the class and an extra-cantrip choice", () => {
    const thaumaturge = withPicks({
      "class.cleric.divine_order": ["thaumaturge"],
      "class.cleric.thaumaturge_cantrip": ["light"],
    }, clericChoices());
    expect(fields(validateChoices(thaumaturge))).toEqual(["picks.class.cleric.thaumaturge_cantrip"]);
  });

  it("rejects a class cantrip already learned from Magic Initiate", () => {
    const choices = withPicks({ "class.cleric.cantrips": ["guidance", "light", "mending"] }, clericChoices());
    expect(fields(validateChoices(choices))).toEqual(["picks.class.cleric.cantrips"]);
  });

  it("rejects a repeated language", () => {
    const ranger: CharacterChoices = {
      speciesId: "dwarf", classId: "ranger", backgroundId: "soldier", level: 2,
      baseScores: { str: 12, dex: 15, con: 13, int: 8, wis: 14, cha: 10 },
      backgroundBonus: { dex: 2, con: 1 },
      classEquipment: "A", backgroundEquipment: "A",
      picks: {
        "background.soldier.tool": ["dice"],
        "class.ranger.skills": ["perception", "stealth", "survival"],
        "class.ranger.weapon_mastery": ["longbow", "shortsword"],
        "class.ranger.fighting_style": ["archery"],
        "class.ranger.expertise": ["perception"],
        "class.ranger.languages": ["elvish", "elvish"],
        "class.ranger.prepared": spellIds("ranger", 1).slice(0, 3),
      },
    };
    expect(fields(validateChoices(ranger))).toEqual(["picks.class.ranger.languages"]);
    const ok = withPicks({ "class.ranger.languages": ["elvish", "giant"] }, ranger);
    expect(validateChoices(ok)).toEqual([]);
  });
});

describe("validateChoices: wizard spellbook", () => {
  it("requires prepared spells to come from the spellbook", () => {
    const wizard = wizardChoices();
    const outside = spellIds("wizard", 1)[9]!;
    const choices = withPicks({ "class.wizard.prepared": [...wizard.picks["class.wizard.prepared"]!.slice(0, 4), outside] }, wizard);
    expect(fields(validateChoices(choices))).toEqual(["picks.class.wizard.prepared"]);
  });
});
