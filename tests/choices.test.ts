import { describe, expect, it } from "vitest";
import { activeChoices, requiredChoices } from "../src/rules/choices";
import type { Concept } from "../src/rules/choices";
import { findSpell, spellsFor } from "../src/rules";
import type { ChoiceSpec } from "../src/rules/types";

const human = (classId: string, level: number, backgroundId = "soldier"): Concept => ({
  speciesId: "human", classId, backgroundId, level,
});
const ids = (specs: ChoiceSpec[]) => specs.map((s) => s.id);
const spec = (specs: ChoiceSpec[], id: string) => specs.find((s) => s.id === id);

describe("requiredChoices", () => {
  it("lists the choices of a level 1 human fighter", () => {
    const specs = requiredChoices(human("fighter", 1));
    expect(ids(specs)).toEqual(expect.arrayContaining([
      "species.human.skillful", "species.human.versatile", "background.soldier.tool",
      "class.fighter.skills", "class.fighter.fighting_style", "class.fighter.weapon_mastery",
    ]));
    expect(spec(specs, "class.fighter.weapon_mastery")?.count).toBe(3);
    expect(ids(specs)).not.toContain("class.fighter.level4_feat");
    expect(ids(specs)).not.toContain("class.fighter.cantrips");
  });

  it("derives the class skill choice from the class data", () => {
    const skills = spec(requiredChoices(human("fighter", 1)), "class.fighter.skills")!;
    expect(skills.count).toBe(2);
    expect(skills.options.map((o) => o.skill)).toContain("athletics");
    expect(skills.options).toHaveLength(9);
  });

  it("adds the level 4 feat and its conditional choices at level 4", () => {
    const specs = requiredChoices(human("fighter", 4));
    expect(ids(specs)).toContain("class.fighter.level4_feat");
    expect(ids(specs)).toContain("class.fighter.weapon_mastery_level4");
    expect(spec(specs, "feat.asi.abilities")?.requires)
      .toEqual({ choiceId: "class.fighter.level4_feat", optionId: "ability_score_improvement" });
  });

  it("includes the background feat choices unconditionally", () => {
    const specs = requiredChoices(human("cleric", 1, "acolyte"));
    expect(spec(specs, "feat.magic_initiate_cleric.cantrips")?.requires).toBeUndefined();
  });

  it("gives the cleric cantrips and prepared spells up to the highest slot level", () => {
    const l1 = requiredChoices(human("cleric", 1, "acolyte"));
    expect(spec(l1, "class.cleric.cantrips")?.count).toBe(3);
    const prepared = spec(l1, "class.cleric.prepared")!;
    expect(prepared.count).toBe(4);
    expect(prepared.options.length).toBeGreaterThan(0);
    expect(prepared.options.every((o) => findSpell(o.id)!.level === 1)).toBe(true);
    expect(spec(l1, "class.cleric.cantrips")!.options.every((o) => findSpell(o.id)!.level === 0)).toBe(true);

    const l3 = spec(requiredChoices(human("cleric", 3, "acolyte")), "class.cleric.prepared")!;
    expect(l3.count).toBe(6);
    expect(l3.options.some((o) => findSpell(o.id)!.level === 2)).toBe(true);
  });

  it("uses the pact slot level for the warlock", () => {
    const l2 = spec(requiredChoices(human("warlock", 2)), "class.warlock.prepared")!;
    expect(l2.options.every((o) => findSpell(o.id)!.level === 1)).toBe(true);
    const l3 = spec(requiredChoices(human("warlock", 3)), "class.warlock.prepared")!;
    expect(l3.options.some((o) => findSpell(o.id)!.level === 2)).toBe(true);
  });

  it("gives the paladin prepared spells but no cantrips", () => {
    const specs = requiredChoices(human("paladin", 1));
    expect(spec(specs, "class.paladin.prepared")?.count).toBe(2);
    expect(ids(specs)).not.toContain("class.paladin.cantrips");
  });

  it("gives the wizard a spellbook of 6 + 2 per level after 1", () => {
    const l1 = spec(requiredChoices(human("wizard", 1, "sage")), "class.wizard.spellbook")!;
    expect(l1.count).toBe(6);
    expect(l1.options).toHaveLength(spellsFor("wizard", 1).length);
    const l4 = spec(requiredChoices(human("wizard", 4, "sage")), "class.wizard.spellbook")!;
    expect(l4.count).toBe(12);
    expect(l4.options).toHaveLength(spellsFor("wizard", 1).length + spellsFor("wizard", 2).length);
  });

  it("includes subclass choices from the subclass level", () => {
    expect(ids(requiredChoices(human("ranger", 2)))).not.toContain("subclass.hunter.hunters_prey");
    expect(ids(requiredChoices(human("ranger", 3)))).toContain("subclass.hunter.hunters_prey");
  });

  it("offers an origin feat for Lessons of the First Ones", () => {
    const specs = requiredChoices(human("warlock", 2));
    expect(spec(specs, "class.warlock.lessons_feat")?.requires)
      .toEqual({ choiceId: "class.warlock.invocation_2", optionId: "lessons_of_the_first_ones" });
    expect(specs.some((s) => s.id === "feat.skilled.skills" && s.requires?.choiceId === "class.warlock.lessons_feat"))
      .toBe(true);
  });
});

describe("activeChoices", () => {
  const fighter4 = requiredChoices(human("fighter", 4));

  it("adds the ASI abilities only when that feat is picked", () => {
    expect(ids(activeChoices(fighter4, {}))).not.toContain("feat.asi.abilities");
    expect(ids(activeChoices(fighter4, { "class.fighter.level4_feat": ["grappler"] }))).not.toContain("feat.asi.abilities");
    const active = activeChoices(fighter4, { "class.fighter.level4_feat": ["ability_score_improvement"] });
    expect(ids(active)).toContain("feat.asi.abilities");
  });

  it("adds the Skilled skills when a human picks Skilled as Versatile", () => {
    expect(ids(activeChoices(fighter4, { "species.human.versatile": ["alert"] }))).not.toContain("feat.skilled.skills");
    expect(ids(activeChoices(fighter4, { "species.human.versatile": ["skilled"] }))).toContain("feat.skilled.skills");
  });

  it("keeps a spec once even when two sources can grant it", () => {
    const specs = requiredChoices(human("warlock", 2));
    const active = activeChoices(specs, {
      "species.human.versatile": ["skilled"],
      "class.warlock.invocation_2": ["lessons_of_the_first_ones", "devils_sight"],
      "class.warlock.lessons_feat": ["skilled"],
    });
    expect(ids(active).filter((id) => id === "feat.skilled.skills")).toHaveLength(1);
  });

  it("activates a chained choice only when its parent is active", () => {
    const specs = requiredChoices(human("warlock", 2));
    const active = activeChoices(specs, {
      "species.human.versatile": ["alert"],
      "class.warlock.invocation_2": ["devils_sight", "fiendish_vigor"],
      "class.warlock.lessons_feat": ["skilled"],
    });
    expect(ids(active)).not.toContain("class.warlock.lessons_feat");
    expect(ids(active)).not.toContain("feat.skilled.skills");
  });

  it("asks for one origin feat per Lessons of the First Ones taken", () => {
    const specs = requiredChoices(human("warlock", 2));
    const active = activeChoices(specs, {
      "class.warlock.invocation_2": ["lessons_of_the_first_ones", "lessons_of_the_first_ones"],
    });
    expect(spec(active, "class.warlock.lessons_feat")?.count).toBe(2);
  });
});
