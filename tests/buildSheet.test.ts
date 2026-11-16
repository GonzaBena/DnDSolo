import { describe, expect, it } from "vitest";
import { buildSheet, replaceRepeatedSpells, validateChoices } from "../src/rules/buildSheet";
import type { CharacterChoices, ChoiceError } from "../src/rules/buildSheet";
import { WEAPONS, findClass, findSpell, spellsFor } from "../src/rules";
import type { CharacterSheet, SkillId } from "../src/rules";
import { isWeaponProficient, weaponAbilityModifier } from "../src/rules/sheet";
import { requiredChoices } from "../src/rules/choices";
import { fighterChoices, greedyChoices } from "./helpers";

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
      "origin.languages": ["elvish", "dwarvish"],
      "species.human.skillful": ["perception"],
      "species.human.versatile": ["alert"],
      "feat.magic_initiate_cleric.ability": ["wis"],
      "feat.magic_initiate_cleric.cantrips": ["guidance", "resistance"],
      "feat.magic_initiate_cleric.spell": [spellIds("cleric", 1)[0]!],
      "class.cleric.skills": ["history", "medicine"],
      "class.cleric.divine_order": ["protector"],
      "class.cleric.cantrips": ["sacred_flame", "light", "mending"],
      "class.cleric.prepared": spellIds("cleric", 1).slice(1, 5),
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
      "origin.languages": ["elvish", "dwarvish"],
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
      "origin.languages": ["elvish", "dwarvish"],
      "species.human.skillful": ["perception"],
      "species.human.versatile": ["alert"],
      "background.soldier.tool": ["dice"],
      "class.warlock.skills": ["arcana", "deception"],
      "class.warlock.invocation": ["eldritch_mind"],
      "class.warlock.invocation_2": ["agonizing_blast", "devils_sight"],
      "class.warlock.cantrips": ["eldritch_blast", "minor_illusion"],
      "class.warlock.prepared": spellIds("warlock", 1).slice(0, 3),
      "invocation.agonizing_blast.cantrip": ["eldritch_blast"],
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
      "origin.languages": ["dwarvish", "giant"],
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
    const repeated = withPicks({ "class.warlock.invocation_2": ["eldritch_mind", "devils_sight"] }, without(warlock, "invocation.agonizing_blast.cantrip"));
    expect(fields(validateChoices(repeated))).toEqual(["picks.class.warlock.invocation_2"]);
    const twoEligible = withPicks({
      "class.warlock.invocation_2": ["agonizing_blast", "agonizing_blast"],
      "class.warlock.cantrips": ["eldritch_blast", "chill_touch"],
      "invocation.agonizing_blast.cantrip": ["eldritch_blast", "chill_touch"],
    }, warlock);
    expect(validateChoices(twoEligible)).toEqual([]);
  });

  it("requires one distinct origin feat per Lessons of the First Ones", () => {
    const warlock = warlockChoices();
    const lessons = withPicks({
      "class.warlock.invocation_2": ["lessons_of_the_first_ones", "devils_sight"],
      "class.warlock.lessons_feat": ["magic_initiate_wizard"],
      "feat.magic_initiate_wizard.ability": ["cha"],
      "feat.magic_initiate_wizard.cantrips": ["fire_bolt", "light"],
      "feat.magic_initiate_wizard.spell": [spellIds("wizard", 1)[0]!],
    }, without(warlock, "invocation.agonizing_blast.cantrip"));
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
        "origin.languages": ["dwarvish", "orc"],
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

/** Same picks without one key. */
function without(choices: CharacterChoices, key: string): CharacterChoices {
  const picks = Object.fromEntries(Object.entries(choices.picks).filter(([k]) => k !== key));
  return { ...choices, picks };
}

describe("validateChoices: origin languages", () => {
  it("requires two standard languages besides Common", () => {
    expect(fields(validateChoices(without(fighterChoices(), "origin.languages")))).toEqual(["picks.origin.languages"]);
    const rare = withPicks({ "origin.languages": ["elvish", "infernal"] });
    expect(fields(validateChoices(rare))).toEqual(["picks.origin.languages"]);
  });

  it("rejects a class language already known from the origin", () => {
    const errors = validateChoices(withPicks({ "class.rogue.language": ["giant"] }, rogueChoices(["stealth", "perception"])));
    expect(fields(errors)).toEqual(["picks.class.rogue.language"]);
    expect(errors[0]!.message).toContain("Gigante");
  });
});

describe("validateChoices: invocations that improve a cantrip", () => {
  const warlock = warlockChoices();

  it("rejects Agonizing Blast taken twice with only one eligible cantrip", () => {
    const one = withPicks({
      "class.warlock.invocation_2": ["agonizing_blast", "agonizing_blast"],
      "invocation.agonizing_blast.cantrip": ["eldritch_blast", "eldritch_blast"],
    }, warlock);
    expect(fields(validateChoices(one))).toEqual(["picks.invocation.agonizing_blast.cantrip"]);
    const nonDamaging = withPicks({ "invocation.agonizing_blast.cantrip": ["eldritch_blast", "minor_illusion"] }, one);
    expect(fields(validateChoices(nonDamaging))).toEqual(["picks.invocation.agonizing_blast.cantrip"]);
  });

  it("requires a cantrip the warlock knows", () => {
    const errors = validateChoices(withPicks({ "invocation.agonizing_blast.cantrip": ["chill_touch"] }, warlock));
    expect(fields(errors)).toEqual(["picks.invocation.agonizing_blast.cantrip"]);
    expect(errors[0]!.message).toContain("Toque helado");
  });

  it("follows each invocation's prerequisite", () => {
    const spear = withPicks({
      "class.warlock.invocation_2": ["eldritch_spear", "devils_sight"],
      "class.warlock.cantrips": ["chill_touch", "eldritch_blast"],
    }, without(warlock, "invocation.agonizing_blast.cantrip"));
    const touch = withPicks({ "invocation.eldritch_spear.cantrip": ["chill_touch"] }, spear); // range Touch
    expect(fields(validateChoices(touch))).toEqual(["picks.invocation.eldritch_spear.cantrip"]);
    expect(validateChoices(withPicks({ "invocation.eldritch_spear.cantrip": ["eldritch_blast"] }, spear))).toEqual([]);
  });
});

describe("validateChoices: Pact of the Tome", () => {
  const tome = withPicks({
    "class.warlock.invocation": ["pact_of_the_tome"],
    "invocation.pact_of_the_tome.cantrips": ["guidance", "fire_bolt", "light"],
    "invocation.pact_of_the_tome.rituals": ["alarm", "identify"],
  }, warlockChoices());

  it("accepts three cantrips and two level 1 rituals from any list", () => {
    expect(validateChoices(tome)).toEqual([]);
  });

  it("asks for them when the pact is taken at level 2 too", () => {
    const atLevel2 = withPicks({
      "class.warlock.invocation": ["eldritch_mind"],
      "class.warlock.invocation_2": ["pact_of_the_tome", "agonizing_blast"],
    }, tome);
    expect(validateChoices(atLevel2)).toEqual([]);
    expect(fields(validateChoices(without(atLevel2, "invocation.pact_of_the_tome.rituals"))))
      .toEqual(["picks.invocation.pact_of_the_tome.rituals"]);
  });

  it("rejects non-ritual spells and cantrips the warlock already knows", () => {
    const shield = withPicks({ "invocation.pact_of_the_tome.rituals": ["alarm", "shield"] }, tome);
    expect(fields(validateChoices(shield))).toEqual(["picks.invocation.pact_of_the_tome.rituals"]);
    const known = withPicks({ "invocation.pact_of_the_tome.cantrips": ["guidance", "fire_bolt", "eldritch_blast"] }, tome);
    expect(fields(validateChoices(known))).toEqual(["picks.invocation.pact_of_the_tome.cantrips"]);
  });

  it("lets a Book of Shadows cantrip be improved by Agonizing Blast", () => {
    expect(validateChoices(withPicks({ "invocation.agonizing_blast.cantrip": ["fire_bolt"] }, tome))).toEqual([]);
  });
});

describe("validateChoices: repeatable feats and level 4 feats", () => {
  it("allows Skilled twice, asking for three skills each time", () => {
    const three = withPicks({
      "species.human.versatile": ["skilled"],
      "class.warlock.invocation_2": ["lessons_of_the_first_ones", "devils_sight"],
      "class.warlock.lessons_feat": ["skilled"],
      "feat.skilled.skills": ["history", "stealth", "medicine"],
    }, without(warlockChoices(), "invocation.agonizing_blast.cantrip"));
    expect(fields(validateChoices(three))).toEqual(["picks.feat.skilled.skills"]);
    const six = withPicks({ "feat.skilled.skills": ["history", "stealth", "medicine", "nature", "religion", "insight"] }, three);
    expect(validateChoices(six)).toEqual([]);
  });

  it("offers origin feats at level 4", () => {
    const skilled = withPicks({
      "class.fighter.level4_feat": ["skilled"],
      "feat.skilled.skills": ["history", "stealth", "medicine"],
      "class.fighter.weapon_mastery_level4": ["dagger"],
    }, fighterChoices({ level: 4 }));
    expect(validateChoices(skilled)).toEqual([]);
  });

  it("offers fighting style feats at level 4 only to classes with Fighting Style, once each", () => {
    const fighter = withPicks({
      "class.fighter.level4_feat": ["archery"],
      "class.fighter.weapon_mastery_level4": ["dagger"],
    }, fighterChoices({ level: 4 }));
    expect(validateChoices(fighter)).toEqual([]);
    const again = withPicks({ "class.fighter.level4_feat": ["defense"] }, fighter);
    expect(fields(validateChoices(again))).toEqual(["picks.class.fighter.level4_feat"]);

    const wizard = { ...wizardChoices(), level: 4 };
    const errors = validateChoices(withPicks({ "class.wizard.level4_feat": ["archery"] }, wizard));
    expect(errorFor(errors, "picks.class.wizard.level4_feat")?.message).toContain("archery");
  });
});

describe("validateChoices: spells from several sources", () => {
  it("rejects a class cantrip the species already grants", () => {
    const wizard = wizardChoices();
    const picks = Object.fromEntries(Object.entries(wizard.picks).filter(([k]) => !k.startsWith("species.human")));
    const highElf: CharacterChoices = {
      ...wizard, speciesId: "elf",
      picks: {
        ...picks,
        "species.elf.lineage": ["high_elf"],
        "species.elf.spell_ability": ["int"],
        "species.elf.keen_senses": ["perception"],
        "class.wizard.cantrips": ["prestidigitation", "fire_bolt", "light"],
        "feat.magic_initiate_wizard.cantrips": ["mage_hand", "ray_of_frost"],
      },
    };
    const errors = validateChoices(highElf);
    expect(fields(errors)).toEqual(["picks.class.wizard.cantrips"]);
    expect(errors[0]!.message).toContain("Prestidigitación");
  });

  it("rejects preparing the Magic Initiate spell again", () => {
    const choices = withPicks({ "class.cleric.prepared": spellIds("cleric", 1).slice(0, 4) }, clericChoices());
    expect(fields(validateChoices(choices))).toEqual(["picks.class.cleric.prepared"]);
  });
});

function sheetOf(choices: CharacterChoices): CharacterSheet {
  const result = buildSheet(choices);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.sheet;
}

const spellName = (id: string) => findSpell(id)!.name;
const skillOf = (sheet: CharacterSheet, id: SkillId) => sheet.skills.find((s) => s.id === id)!;
const attackOf = (sheet: CharacterSheet, name: string) => sheet.attacks.find((a) => a.name === name);
const featureNames = (sheet: CharacterSheet) => sheet.features.map((f) => f.name);
/** Every spell outside the class spell choices, whatever its group. */
const otherSpells = (sheet: CharacterSheet) => sheet.otherSpells.flatMap((g) => g.spells);

function withoutHuman(choices: CharacterChoices): CharacterChoices {
  return { ...choices, picks: Object.fromEntries(Object.entries(choices.picks).filter(([k]) => !k.startsWith("species.human"))) };
}

/** Level 1 human paladin, soldier: Str 17 (+3), longsword from equipment A. */
function paladinChoices(mastery = ["longsword", "javelin"]): CharacterChoices {
  return {
    speciesId: "human", classId: "paladin", backgroundId: "soldier", level: 1,
    baseScores: { str: 15, dex: 10, con: 13, int: 8, wis: 12, cha: 14 },
    backgroundBonus: { str: 2, con: 1 },
    classEquipment: "A", backgroundEquipment: "A",
    picks: {
      "origin.languages": ["elvish", "dwarvish"],
      "species.human.skillful": ["perception"],
      "species.human.versatile": ["alert"],
      "background.soldier.tool": ["dice"],
      "class.paladin.skills": ["insight", "religion"],
      "class.paladin.weapon_mastery": mastery,
      "class.paladin.prepared": spellIds("paladin", 1).slice(0, 2),
    },
  };
}

/** Level 1 wizard with Int 16 (+3): 15 base + 1 from the sage background. */
function level1Wizard(): CharacterChoices {
  const base = wizardChoices();
  const book = spellIds("wizard", 1).slice(0, 6);
  const picks: Record<string, string[]> = { ...base.picks, "class.wizard.spellbook": book, "class.wizard.prepared": book.slice(0, 4) };
  delete picks["class.wizard.scholar"];
  return { ...base, level: 1, backgroundBonus: { con: 2, int: 1 }, picks };
}

describe("buildSheet: fighter (human soldier, Defense)", () => {
  const sheet = sheetOf(fighterChoices());

  it("names the concept in Spanish", () => {
    expect(sheet).toMatchObject({ species: "Humano", className: "Guerrero", subclass: null, level: 1, background: "Soldado" });
  });

  it("adds the background bonus to the scores", () => {
    expect(sheet.abilities.str).toEqual({ score: 17, modifier: 3, save: 5, proficientSave: true });
    expect(sheet.abilities.con).toMatchObject({ score: 14, modifier: 2, proficientSave: true });
    expect(sheet.abilities.dex).toEqual({ score: 14, modifier: 2, save: 2, proficientSave: false });
  });

  it("computes hit points with the fixed value per level", () => {
    expect(sheet.hitPoints).toBe(12);
    expect(sheet.hitDice).toBe("1d10");
    expect(sheetOf(fighterChoices({ level: 3 })).hitPoints).toBe(28);
    expect(sheetOf(fighterChoices({ level: 3 })).hitDice).toBe("3d10");
  });

  it("uses proficiency on proficient skills", () => {
    expect(sheet.proficiencyBonus).toBe(2);
    expect(skillOf(sheet, "athletics")).toMatchObject({ name: "Atletismo", bonus: 5, proficient: true, expertise: false });
    expect(skillOf(sheet, "history")).toMatchObject({ bonus: -1, proficient: false });
    expect(sheet.skills).toHaveLength(18);
  });

  it("adds the proficiency bonus to initiative with Alert only", () => {
    expect(sheet.initiative).toBe(4);
    const skilled = withPicks({ "species.human.versatile": ["skilled"], "feat.skilled.skills": ["history", "insight", "medicine"] });
    expect(sheetOf(skilled).initiative).toBe(2);
  });

  it("wears the first armor of option A and adds Defense", () => {
    expect(sheet.armorClass).toBe(17); // chain mail 16 + 1
    expect(sheetOf(withPicks({ "class.fighter.fighting_style": ["great_weapon_fighting"] })).armorClass).toBe(16);
  });

  it("computes passive Perception from the Perception bonus", () => {
    expect(skillOf(sheet, "perception").bonus).toBe(3);
    expect(sheet.passivePerception).toBe(13);
  });

  it("keeps the speed in feet", () => {
    expect(sheet.speed).toBe(30);
  });

  it("lists weapon attacks once per weapon, with mastery only for the picked weapons", () => {
    expect(attackOf(sheet, "Espadón")).toEqual({ name: "Espadón", attackBonus: 5, damage: "2d6+3", mastery: "Rozar" });
    expect(attackOf(sheet, "Mangual")).toEqual({ name: "Mangual", attackBonus: 5, damage: "1d8+3", mastery: null });
    expect(attackOf(sheet, "Arco corto")).toEqual({ name: "Arco corto", attackBonus: 4, damage: "1d6+2", mastery: null });
    expect(sheet.attacks.filter((a) => a.name === "Jabalina")).toHaveLength(1);
  });

  it("lists the class and background equipment and gold", () => {
    expect(sheet.equipment).toEqual(expect.arrayContaining([
      "Cota de malla", "Espadón", "Jabalina (8)", "Paquete de explorador de mazmorras", "Lanza", "Arco corto", "20 flechas",
    ]));
    expect(sheet.gold).toBe(18);
    const gold = sheetOf(fighterChoices({ classEquipment: "C", backgroundEquipment: "B" }));
    expect(gold.equipment).toEqual([]);
    expect(gold.gold).toBe(205);
    expect(gold.attacks).toEqual([]);
    expect(gold.armorClass).toBe(12); // unarmored: Defense does not apply
  });

  it("lists proficiencies, with the picked gaming set", () => {
    expect(sheet.proficiencies.armor).toContain("Armaduras pesadas");
    expect(sheet.proficiencies.weapons).toEqual(["Armas sencillas", "Armas marciales"]);
    expect(sheet.proficiencies.tools).toEqual(["Dados"]);
  });

  it("lists features with their source", () => {
    expect(sheet.features).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "Humano", name: "Ingenioso" }),
      expect.objectContaining({ source: "Guerrero 1", name: "Tomar aliento" }),
      expect.objectContaining({ source: "Estilo de combate", name: "Defensa" }),
      expect.objectContaining({ source: "Versátil", name: "Alerta" }),
      expect.objectContaining({ source: "Trasfondo Soldado", name: "Atacante salvaje" }),
    ]));
    expect(featureNames(sheet)).not.toContain("Acción súbita");
  });

  it("has no spellcasting", () => {
    expect(sheet.spellcasting).toBeNull();
    expect(sheet.otherSpells).toEqual([]);
  });

  it("assigns the subclass at its level", () => {
    const l3 = sheetOf(fighterChoices({ level: 3 }));
    expect(l3.subclass).toBe("Campeón");
    expect(l3.features).toEqual(expect.arrayContaining([expect.objectContaining({ source: "Campeón", name: "Crítico mejorado" })]));
    expect(featureNames(l3)).toContain("Acción súbita");
  });
});

describe("buildSheet: picks shown on the sheet", () => {
  it("lists Common and the origin languages", () => {
    expect(sheetOf(fighterChoices()).languages).toEqual(["Común", "Elfo", "Enano"]);
  });

  it("adds the rogue's Thieves' Cant and the class language pick", () => {
    expect(sheetOf(rogueChoices(["stealth", "perception"])).languages).toEqual(["Común", "Enano", "Gigante", "Jerga de ladrones", "Elfo"]);
  });

  it("adds the druid's Druidic and the ranger's level 2 languages", () => {
    expect(sheetOf(greedyChoices("human", "druid", "sage", 1)).languages).toContain("Druídico");
    const ranger = greedyChoices("human", "ranger", "sage", 2);
    const picked = ranger.picks["class.ranger.languages"]!;
    expect(picked).toHaveLength(2);
    expect(sheetOf(ranger).languages).toHaveLength(5);
  });

  it("lists every weapon mastery picked, with its property, even without the weapon", () => {
    expect(sheetOf(fighterChoices()).masteries).toEqual([
      { weapon: "Espada larga", mastery: "Debilitar" },
      { weapon: "Espadón", mastery: "Rozar" },
      { weapon: "Arco largo", mastery: "Ralentizar" },
    ]);
    expect(sheetOf(fighterChoices({ classEquipment: "C" })).masteries).toHaveLength(3);
    expect(sheetOf(grapplerFighter({ str: 13, dex: 10, con: 15, int: 12, wis: 14, cha: 8 })).masteries.map((m) => m.weapon)).toContain("Daga");
    expect(sheetOf(greedyChoices("human", "wizard", "sage", 1)).masteries).toEqual([]);
  });

  it("names the soldier's gaming set and the monk's tool in the equipment", () => {
    const soldier = sheetOf(withPicks({ "background.soldier.tool": ["playing_cards"] }));
    expect(soldier.equipment).toContain("Naipes");
    expect(soldier.equipment.join()).not.toContain("el mismo de la competencia");
    const monkChoices = greedyChoices("human", "monk", "soldier", 1);
    const monk = sheetOf(monkChoices);
    const tool = requiredChoices(monkChoices).find((s) => s.id === "class.monk.tool")!
      .options.find((o) => o.id === monkChoices.picks["class.monk.tool"]![0])!.name;
    expect(monk.equipment).toContain(tool);
    expect(monk.proficiencies.tools).toContain(tool);
    expect(monk.equipment.join()).not.toContain("elegido");
  });

  it("sorts the skills by their Spanish name", () => {
    const names = sheetOf(fighterChoices()).skills.map((s) => s.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "es")));
    expect(names[0]).toBe("Acrobacias");
    expect(names.indexOf("Trato con animales")).toBeGreaterThan(names.indexOf("Supervivencia"));
  });
});

describe("buildSheet: ability increases", () => {
  it("applies an ASI of +1/+1 or +2", () => {
    const split = sheetOf(asiFighter(["str", "con"]));
    expect(split.abilities.str.score).toBe(18);
    expect(split.abilities.con.score).toBe(15);
    expect(sheetOf(asiFighter(["dex", "dex"])).abilities.dex.score).toBe(16);
  });

  it("applies the Grappler increase", () => {
    expect(sheetOf(grapplerFighter({ str: 13, dex: 10, con: 15, int: 12, wis: 14, cha: 8 })).abilities.str.score).toBe(14);
  });
});

describe("buildSheet: hit points", () => {
  it("gives the dwarf 1 extra hit point per level", () => {
    const human = sheetOf(fighterChoices({ level: 2 }));
    const dwarf = sheetOf(withoutHuman(fighterChoices({ level: 2, speciesId: "dwarf" })));
    expect(human.hitPoints).toBe(20);
    expect(dwarf.hitPoints).toBe(22);
  });

  it("raises a Draconic Sorcerer's hit points and unarmored AC from level 3", () => {
    // Cha 15 (+2), Dex 13 (+1), Con 12 + 2 = 14 (+2).
    const l2 = sheetOf(greedyChoices("human", "sorcerer", "sage", 2));
    const l3 = sheetOf(greedyChoices("human", "sorcerer", "sage", 3));
    expect(l2.hitPoints).toBe(14);
    expect(l3.hitPoints).toBe(23); // 8 + 6 + 6 + 3
    expect(l2.armorClass).toBe(11);
    expect(l3.armorClass).toBe(13);
    expect(l3.subclass).toBe("Hechicería dracónica");
  });

  it("subtracts a negative Constitution modifier, never below 1 per level", () => {
    const frail = {
      ...greedyChoices("human", "wizard", "sage", 2),
      baseScores: { str: 10, dex: 14, con: 8, int: 15, wis: 13, cha: 12 },
      backgroundBonus: { int: 2, wis: 1 },
    };
    expect(sheetOf(frail).hitPoints).toBe(8); // (6 - 1) + (4 - 1)
  });
});

describe("buildSheet: skills", () => {
  it("doubles proficiency with expertise", () => {
    const sheet = sheetOf(rogueChoices(["stealth", "perception"]));
    expect(skillOf(sheet, "stealth")).toMatchObject({ bonus: 7, proficient: true, expertise: true }); // Dex 17 (+3) + 4
  });

  it("adds Jack of All Trades to a level 2 bard's non-proficient skills, not to initiative", () => {
    const l1 = sheetOf(greedyChoices("human", "bard", "sage", 1));
    const l2 = sheetOf(greedyChoices("human", "bard", "sage", 2));
    const skill = l2.skills.find((s) => !s.proficient)!;
    expect(skill.bonus).toBe(l1.skills.find((s) => s.id === skill.id)!.bonus + 1);
    expect(l2.initiative).toBe(l1.initiative);
  });

  it("adds the Thaumaturge bonus to Arcana and Religion", () => {
    const thaumaturge = withPicks(
      { "class.cleric.divine_order": ["thaumaturge"], "class.cleric.thaumaturge_cantrip": ["thaumaturgy"] },
      clericChoices(),
    );
    const sheet = sheetOf(thaumaturge);
    // Int 8 (-1), Wis 17 (+3); Religion is proficient from the acolyte background.
    expect(skillOf(sheet, "arcana").bonus).toBe(2);
    expect(skillOf(sheet, "religion").bonus).toBe(4);
    expect(skillOf(sheetOf(clericChoices()), "arcana").bonus).toBe(-1);
  });
});

describe("buildSheet: speed", () => {
  it("gives the wood elf 35 feet", () => {
    expect(sheetOf(rogueChoices(["stealth", "perception"])).speed).toBe(35);
  });

  it("gives an unarmored level 2 monk 40 feet", () => {
    expect(sheetOf(greedyChoices("human", "monk", "soldier", 1)).speed).toBe(30);
    expect(sheetOf(greedyChoices("human", "monk", "soldier", 2)).speed).toBe(40);
  });

  it("takes 10 feet off in heavy armor whose Strength requirement is not met", () => {
    // Chain mail (option A) needs Str 13.
    const weak = fighterChoices({ baseScores: { str: 8, dex: 15, con: 13, int: 10, wis: 14, cha: 12 }, backgroundBonus: { dex: 2, con: 1 } });
    expect(sheetOf(weak).speed).toBe(20);
    const enough = fighterChoices({ baseScores: { str: 13, dex: 15, con: 14, int: 8, wis: 12, cha: 10 }, backgroundBonus: { dex: 2, con: 1 } });
    expect(sheetOf(enough).speed).toBe(30);
    expect(sheetOf(fighterChoices()).speed).toBe(30); // Str 17
  });
});

describe("buildSheet: attacks", () => {
  it("uses Strength and proficiency for a longsword, with mastery only when picked", () => {
    const sheet = sheetOf(paladinChoices());
    expect(attackOf(sheet, "Espada larga")).toEqual({ name: "Espada larga", attackBonus: 5, damage: "1d8+3", mastery: "Debilitar" });
    expect(attackOf(sheetOf(paladinChoices(["javelin", "spear"])), "Espada larga")!.mastery).toBeNull();
  });

  it("omits +0, writes negative modifiers and uses the better of Str and Dex for finesse", () => {
    const sheet = sheetOf(wizardChoices()); // Str 8 (-1), Dex 14 (+2)
    expect(attackOf(sheet, "Bastón")).toMatchObject({ attackBonus: 1, damage: "1d6-1" });
    expect(attackOf(sheet, "Daga")).toMatchObject({ attackBonus: 4, damage: "1d4+2" });
    const even = sheetOf({ ...wizardChoices(), baseScores: { str: 10, dex: 14, con: 13, int: 15, wis: 12, cha: 8 } });
    expect(attackOf(even, "Bastón")!.damage).toBe("1d6");
  });

  it("adds proficiency only for weapons the class is proficient with", () => {
    const rogue = sheetOf(rogueChoices(["stealth", "perception"]));
    expect(attackOf(rogue, "Espada corta")).toMatchObject({ attackBonus: 5, damage: "1d6+3", mastery: "Molestar" });
    // A sorcerer is proficient with simple weapons only; the soldier background brings a spear and a shortbow (simple).
    const sorcerer = sheetOf(greedyChoices("human", "sorcerer", "soldier", 1));
    expect(attackOf(sorcerer, "Lanza")!.attackBonus).toBe(sorcerer.abilities.str.modifier + 2);
  });

  it("knows which weapons each class proficiency covers", () => {
    const weapon = (id: string) => WEAPONS.find((w) => w.id === id)!;
    const proficient = (id: string, classId: string) => isWeaponProficient(weapon(id), findClass(classId)!.weapons);
    expect(proficient("longsword", "wizard")).toBe(false);
    expect(proficient("spear", "wizard")).toBe(true);
    expect(proficient("shortsword", "monk")).toBe(true);
    expect(proficient("longsword", "monk")).toBe(false);
    expect(proficient("rapier", "rogue")).toBe(true);
    expect(proficient("hand_crossbow", "rogue")).toBe(true);
    expect(proficient("longsword", "rogue")).toBe(false);
    expect(() => isWeaponProficient(weapon("dagger"), ["Armas raras"])).toThrow();
  });

  it("lets a monk use Dexterity and the Martial Arts die with monk weapons and unarmed strikes", () => {
    const monk = sheetOf({
      ...greedyChoices("human", "monk", "soldier", 1),
      baseScores: { str: 8, dex: 15, con: 13, int: 10, wis: 14, cha: 12 },
      backgroundBonus: { dex: 2, con: 1 },
    });
    expect(attackOf(monk, "Daga")).toMatchObject({ attackBonus: 5, damage: "1d6+3" });
    expect(attackOf(monk, "Ataque sin armas")).toMatchObject({ attackBonus: 5, damage: "1d6+3", mastery: null });
    expect(monk.armorClass).toBe(15); // 10 + 3 + 2
  });

  it("lets finesse win over ranged (the Dart)", () => {
    const dart = WEAPONS.find((w) => w.id === "dart")!;
    const strong = { str: 3, dex: 1, con: 0, int: 0, wis: 0, cha: 0 };
    expect(weaponAbilityModifier(dart, strong)).toBe(3);
    expect(weaponAbilityModifier(WEAPONS.find((w) => w.id === "shortbow")!, strong)).toBe(1);
    expect(weaponAbilityModifier(WEAPONS.find((w) => w.id === "longsword")!, strong)).toBe(3);
  });

  it("adds Archery to ranged attacks", () => {
    const archer = sheetOf(withPicks({ "class.fighter.fighting_style": ["archery"] }));
    expect(attackOf(archer, "Arco corto")!.attackBonus).toBe(6);
    expect(attackOf(archer, "Espadón")!.attackBonus).toBe(5);
  });
});

describe("buildSheet: spellcasting", () => {
  it("computes a level 1 wizard with Int 16", () => {
    const choices = level1Wizard();
    const sc = sheetOf(choices).spellcasting!;
    expect(sc).toMatchObject({ ability: "int", saveDc: 13, attackBonus: 5, slots: [2], pactSlots: null });
    expect(sc.cantrips).toHaveLength(3);
    expect(sc.prepared).toHaveLength(4);
    expect(sc.spellbook).toHaveLength(6);
    expect(sc.cantrips).toContain(spellName(choices.picks["class.wizard.cantrips"]![0]!));
    const initiate = [...choices.picks["feat.magic_initiate_wizard.cantrips"]!, ...choices.picks["feat.magic_initiate_wizard.spell"]!];
    expect(sheetOf(choices).otherSpells).toEqual([
      { source: "Iniciado en la magia (mago)", ability: "int", saveDc: 13, attackBonus: 5, spells: initiate.map(spellName) },
    ]);
  });

  it("gives the warlock pact slots", () => {
    const sc = sheetOf(warlockChoices()).spellcasting!;
    expect(sc).toMatchObject({ ability: "cha", slots: [], pactSlots: { count: 2, slotLevel: 1 }, spellbook: null });
    expect(sc.cantrips).toEqual(["eldritch_blast", "minor_illusion"].map(spellName));
  });

  it("lists Magic Initiate spells as other spells of a cleric", () => {
    const sheet = sheetOf(clericChoices());
    expect(sheet.spellcasting!.saveDc).toBe(13); // Wis 17 (+3)
    expect(sheet.otherSpells).toEqual([expect.objectContaining({
      source: "Iniciado en la magia (clérigo)", ability: "wis", saveDc: 13,
      spells: expect.arrayContaining([spellName("guidance"), spellName("resistance")]),
    })]);
  });

  it("gives a non-caster with species spells only a group with the chosen spellcasting ability", () => {
    const sheet = sheetOf(rogueChoices(["stealth", "perception"]));
    expect(sheet.spellcasting).toBeNull();
    // Wood elf with Wisdom 13 (+1).
    expect(sheet.otherSpells).toEqual([
      { source: "Linaje élfico", ability: "wis", saveDc: 11, attackBonus: 3, spells: [spellName("druidcraft")] },
    ]);
  });

  it("gives each spell source its own ability, save DC and attack bonus", () => {
    // Tiefling sorcerer 3, sage: Cha 15 (+2), Int 12 + 1 = 13 (+1), Wis 10 (+0); proficiency +2.
    const base = greedyChoices("tiefling", "sorcerer", "sage", 3);
    const choices: CharacterChoices = {
      ...base,
      baseScores: { str: 8, dex: 14, con: 13, int: 12, wis: 10, cha: 15 },
      backgroundBonus: { con: 2, int: 1 },
      picks: { ...base.picks, "species.tiefling.spell_ability": ["int"], "feat.magic_initiate_wizard.ability": ["wis"] },
    };
    const sheet = sheetOf(choices);
    expect(sheet.spellcasting).toMatchObject({ ability: "cha", saveDc: 12, attackBonus: 4 });
    const group = (source: string) => sheet.otherSpells.find((g) => g.source === source);
    expect(group("Legado infernal")).toMatchObject({ ability: "int", saveDc: 11, attackBonus: 3 });
    expect(group("Legado infernal")!.spells).toEqual(expect.arrayContaining(["thaumaturgy", "poison_spray", "ray_of_sickness"].map(spellName)));
    expect(group("Iniciado en la magia (mago)")).toMatchObject({ ability: "wis", saveDc: 10, attackBonus: 2 });
    expect(group("Hechicero")).toMatchObject({ ability: "cha", saveDc: 12, attackBonus: 4 });
    expect(group("Hechicero")!.spells).toContain(spellName("command"));
    expect(sheet.otherSpells.map((g) => g.source)).toEqual(["Legado infernal", "Iniciado en la magia (mago)", "Hechicero"]);
  });

  it("adds lineage spells only from their level, and the tiefling's Thaumaturgy", () => {
    const tiefling = (level: number) => otherSpells(sheetOf(greedyChoices("tiefling", "fighter", "soldier", level)));
    expect(greedyChoices("tiefling", "fighter", "soldier", 1).picks["species.tiefling.legacy"]).toEqual(["abyssal"]);
    expect(tiefling(1)).toEqual(expect.arrayContaining([spellName("thaumaturgy"), spellName("poison_spray")]));
    expect(tiefling(1)).not.toContain(spellName("ray_of_sickness"));
    expect(tiefling(3)).toContain(spellName("ray_of_sickness"));
  });

  it("lists always-prepared class and subclass spells", () => {
    expect(otherSpells(sheetOf(greedyChoices("human", "druid", "sage", 1)))).toContain(spellName("speak_with_animals"));
    expect(otherSpells(sheetOf(greedyChoices("human", "ranger", "sage", 1)))).toContain(spellName("hunters_mark"));
    expect(otherSpells(sheetOf(greedyChoices("human", "sorcerer", "sage", 3)))).toEqual(
      expect.arrayContaining(["alter_self", "chromatic_orb", "command", "dragons_breath"].map(spellName)),
    );
    expect(otherSpells(sheetOf(greedyChoices("human", "sorcerer", "sage", 2)))).not.toContain(spellName("command"));
    const land = greedyChoices("human", "druid", "sage", 3);
    expect(land.picks["subclass.land.land_type"]).toEqual(["arid"]);
    expect(otherSpells(sheetOf(land))).toEqual(expect.arrayContaining(["blur", "burning_hands"].map(spellName)));
  });

  it("lists the invocation and Pact of the Tome spells", () => {
    const tome = withPicks(
      {
        "class.warlock.invocation": ["pact_of_the_tome"],
        "class.warlock.invocation_2": ["armor_of_shadows", "devils_sight"],
        "invocation.pact_of_the_tome.cantrips": ["guidance", "light", "thaumaturgy"],
        "invocation.pact_of_the_tome.rituals": ["alarm", "find_familiar"],
      },
      warlockChoices(),
    );
    delete tome.picks["invocation.agonizing_blast.cantrip"];
    expect(validateChoices(tome)).toEqual([]);
    const tomeSheet = sheetOf(tome);
    expect(tomeSheet.otherSpells.map((g) => g.source)).toEqual(["Brujo"]);
    expect(otherSpells(tomeSheet)).toEqual(expect.arrayContaining(
      ["mage_armor", "guidance", "light", "thaumaturgy", "alarm", "find_familiar"].map(spellName),
    ));
  });
});

describe("buildSheet: features from picked options", () => {
  it("lists invocations and metamagic with their choice as source", () => {
    const warlock = sheetOf(warlockChoices());
    expect(warlock.features).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "Invocación sobrenatural", name: "Mente sobrenatural" }),
      expect.objectContaining({ source: "Invocaciones sobrenaturales (nivel 2)", name: "Descarga agónica" }),
    ]));
    const sorcerer = sheetOf(greedyChoices("human", "sorcerer", "sage", 2));
    expect(sorcerer.features.filter((f) => f.source === "Metamagia")).toHaveLength(2);
  });

  it("lists the Hunter's Prey option and the cantrip an invocation improves", () => {
    const hunter = greedyChoices("human", "ranger", "sage", 3);
    expect(hunter.picks["subclass.hunter.hunters_prey"]).toEqual(["colossus_slayer"]);
    expect(sheetOf(hunter).features).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "El cazador y la presa", name: "Azote de colosos" }),
    ]));
    expect(sheetOf(warlockChoices()).features).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "Truco de brujo para Descarga agónica", name: spellName("eldritch_blast") }),
    ]));
  });
});

describe("validateChoices: always-prepared spells", () => {
  const paladinL2 = (prepared: string[]) => withPicks(
    { "class.paladin.fighting_style": ["defense"], "class.paladin.prepared": prepared },
    { ...paladinChoices(), level: 2 },
  );
  const others = spellIds("paladin", 1).filter((id) => id !== "divine_smite");

  it("rejects preparing a spell a class feature already keeps prepared", () => {
    const errors = validateChoices(paladinL2(["divine_smite", ...others.slice(0, 2)]));
    expect(fields(errors)).toEqual(["picks.class.paladin.prepared"]);
    expect(errors[0]!.message).toContain("Castigo divino");
  });

  it("allows it before the feature is gained", () => {
    expect(validateChoices(withPicks({ "class.paladin.prepared": ["divine_smite", others[0]!] }, paladinChoices()))).toEqual([]);
    expect(validateChoices(paladinL2(others.slice(0, 3)))).toEqual([]);
  });
});

describe("buildSheet: invalid choices", () => {
  it("returns the validation errors", () => {
    const bad = withPicks({ "class.fighter.fighting_style": ["nope"] });
    expect(buildSheet(bad)).toEqual({ ok: false, errors: validateChoices(bad) });
    expect(buildSheet({ ...fighterChoices(), classId: "bogus" })).toMatchObject({ ok: false });
  });
});

describe("replaceRepeatedSpells", () => {
  const repeat = (c: CharacterChoices, picks: Record<string, string[]>): CharacterChoices => ({ ...c, picks: { ...c.picks, ...picks } });

  it("swaps a class cantrip that a feat already gives for a free one", () => {
    const c = repeat(greedyChoices("human", "cleric", "acolyte", 1), { "class.cleric.cantrips": ["guidance", "light", "mending"] });
    expect(buildSheet(c).ok).toBe(false);
    const fixed = replaceRepeatedSpells(c);
    const cantrips = fixed.picks["class.cleric.cantrips"]!;
    expect(cantrips).not.toContain("guidance");
    expect(cantrips).toEqual(expect.arrayContaining(["light", "mending"]));
    expect(cantrips).toHaveLength(3);
    expect(buildSheet(fixed).ok).toBe(true);
  });

  it("swaps a cantrip that the species lineage already gives", () => {
    const c = repeat(greedyChoices("elf", "wizard", "sage", 1), {
      "species.elf.lineage": ["high_elf"], "class.wizard.cantrips": ["prestidigitation", "minor_illusion", "true_strike"],
    });
    expect(buildSheet(c).ok).toBe(false);
    const fixed = replaceRepeatedSpells(c);
    expect(fixed.picks["class.wizard.cantrips"]).not.toContain("prestidigitation");
    expect(buildSheet(fixed).ok).toBe(true);
  });

  it("replaces a wizard's repeated prepared spell with another one from the spellbook", () => {
    const base = greedyChoices("elf", "wizard", "sage", 1);
    const c = repeat(base, {
      "feat.magic_initiate_wizard.spell": ["mage_armor"],
      "class.wizard.prepared": ["mage_armor", "feather_fall", "ice_knife", "detect_magic"],
    });
    expect(buildSheet(c).ok).toBe(false);
    const fixed = replaceRepeatedSpells(c);
    const prepared = fixed.picks["class.wizard.prepared"]!;
    expect(prepared).not.toContain("mage_armor");
    expect(base.picks["class.wizard.spellbook"]).toEqual(expect.arrayContaining(prepared));
    expect(buildSheet(fixed).ok).toBe(true);
  });

  it("leaves legal choices untouched", () => {
    const c = greedyChoices("elf", "wizard", "sage", 1);
    expect(replaceRepeatedSpells(c)).toEqual(c);
  });
});
