import { describe, expect, it } from "vitest";
import { validateChoices } from "../src/rules/buildSheet";
import type { CharacterChoices } from "../src/rules/buildSheet";
import { activeChoices, isInvocationCantripChoice, requiredChoices } from "../src/rules/choices";
import { BACKGROUNDS, CLASSES_DATA, SPECIES, STANDARD_ARRAY, findBackground } from "../src/rules";
import { ABILITIES } from "../src/rules/types";
import type { Ability } from "../src/rules/types";

/** Builds a legal character with a deterministic greedy picker: for each active choice, the first options
    that do not repeat anything already taken (skills, spells, feats, languages, weapons...). */
function build(speciesId: string, classId: string, backgroundId: string, level: number): CharacterChoices {
  const cls = CLASSES_DATA.find((c) => c.id === classId)!;
  const background = findBackground(backgroundId)!;
  const species = SPECIES.find((s) => s.id === speciesId)!;
  const order: Ability[] = [cls.primaryAbility[0]!, ...ABILITIES.filter((a) => a !== cls.primaryAbility[0])];
  const baseScores = Object.fromEntries(order.map((a, i) => [a, STANDARD_ARRAY[i]])) as Record<Ability, number>;
  const backgroundBonus = { [background.abilities[0]]: 2, [background.abilities[1]]: 1 };

  const picks: Record<string, string[]> = {};
  const used = new Set<string>([background.featId, ...background.skills, ...species.fixedSkills]);
  const proficient = new Set<string>([...background.skills, ...species.fixedSkills]);
  for (let round = 0; round < 20; round++) {
    const todo = activeChoices(requiredChoices({ speciesId, classId, backgroundId, level }), picks).filter((s) => !picks[s.id]);
    if (todo.length === 0) break;
    for (const spec of todo) {
      let options = spec.options;
      if (spec.id.endsWith(".expertise") || spec.id === "class.wizard.scholar") {
        options = options.filter((o) => proficient.has(o.id));
      } else if (spec.id === "class.wizard.prepared") {
        options = options.filter((o) => picks["class.wizard.spellbook"]!.includes(o.id));
      } else if (isInvocationCantripChoice(spec.id)) {
        options = options.filter((o) => picks["class.warlock.cantrips"]!.includes(o.id));
      } else if (/\.abilit(y|ies)$/.test(spec.id)) {
        options = options.some((o) => o.id === "con") ? options.filter((o) => o.id === "con") : options;
      } else {
        options = options.filter((o) => !used.has(o.id) && !(o.skill && used.has(o.skill)));
      }
      const chosen = spec.allowRepeat
        ? Array.from({ length: spec.count }, () => options[0]!.id)
        : options.slice(0, spec.count).map((o) => o.id);
      picks[spec.id] = chosen;
      for (const id of chosen) {
        const option = spec.options.find((o) => o.id === id)!;
        if (spec.id !== "class.wizard.spellbook" && !/\.abilit(y|ies)$/.test(spec.id)) used.add(id);
        for (const g of option.spells ?? []) used.add(g.spellId);
        if (option.skill) {
          used.add(option.skill);
          proficient.add(option.skill);
        }
      }
    }
  }
  return {
    speciesId, classId, backgroundId, level, baseScores, backgroundBonus, classEquipment: "A", backgroundEquipment: "A", picks,
  };
}

describe("every class validates at levels 1 and 4", () => {
  const cases = CLASSES_DATA.flatMap((cls, i) =>
    [1, 4].map((level) => {
      const species = SPECIES[(i + level) % SPECIES.length]!;
      const background = BACKGROUNDS[(i + level) % BACKGROUNDS.length]!;
      return [cls.id, level, species.id, background.id] as const;
    }),
  );

  it.each(cases)("%s level %i (%s, %s)", (classId, level, speciesId, backgroundId) => {
    expect(validateChoices(build(speciesId, classId, backgroundId, level))).toEqual([]);
  });

  it("holds for every species and background combination too", () => {
    const failures: string[] = [];
    for (const cls of CLASSES_DATA) for (const level of [1, 4]) for (const sp of SPECIES) for (const bg of BACKGROUNDS) {
      const errors = validateChoices(build(sp.id, cls.id, bg.id, level));
      if (errors.length > 0) failures.push(`${sp.id}/${cls.id}/${level}/${bg.id}: ${JSON.stringify(errors)}`);
    }
    expect(failures).toEqual([]);
  });
});
