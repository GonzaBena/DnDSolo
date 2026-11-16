import { describe, expect, it } from "vitest";
import { buildSheet, validateChoices } from "../src/rules/buildSheet";
import { BACKGROUNDS, CLASSES_DATA, SPECIES } from "../src/rules";
import { greedyChoices as build } from "./helpers";

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

/** Problems of a built sheet: HP and AC floors, and a spellcasting block for every caster. A non-caster only gets
    one for species or feat spells, so it has no slots and no class spells. */
function sheetProblems(speciesId: string, classId: string, backgroundId: string, level: number): string[] {
  const result = buildSheet(build(speciesId, classId, backgroundId, level));
  if (!result.ok) return [`no se pudo construir: ${JSON.stringify(result.errors)}`];
  const { sheet } = result;
  const cls = CLASSES_DATA.find((c) => c.id === classId)!;
  const problems: string[] = [];
  if (sheet.hitPoints < 1) problems.push(`HP ${sheet.hitPoints}`);
  if (sheet.armorClass < 10) problems.push(`CA ${sheet.armorClass}`);
  const sc = sheet.spellcasting;
  if (cls.spellcasting) {
    if (sc?.ability !== cls.spellcasting.ability) problems.push(`spellcasting ${JSON.stringify(sc)}`);
  } else if (sc) {
    problems.push(`spellcasting de no lanzador ${JSON.stringify(sc)}`);
  }
  for (const g of sheet.otherSpells) {
    if (g.spells.length === 0 || g.saveDc !== 8 + sheet.proficiencyBonus + sheet.abilities[g.ability].modifier) {
      problems.push(`grupo de conjuros ${JSON.stringify(g)}`);
    }
  }
  return problems;
}

describe("every class builds a sheet at levels 1 and 4", () => {
  it.each(CLASSES_DATA.flatMap((cls) => [1, 4].map((level) => [cls.id, level] as const)))("%s level %i", (classId, level) => {
    expect(sheetProblems("human", classId, "soldier", level)).toEqual([]);
  });

  it("gives non-casters without species or feat spells no spellcasting block", () => {
    for (const cls of CLASSES_DATA.filter((c) => !c.spellcasting)) {
      const result = buildSheet(build("dwarf", cls.id, "soldier", 1));
      expect(result.ok && result.sheet.spellcasting, cls.id).toBeNull();
    }
  });

  it("holds for every species and background combination too", () => {
    const failures: string[] = [];
    for (const cls of CLASSES_DATA) for (const level of [1, 4]) for (const sp of SPECIES) for (const bg of BACKGROUNDS) {
      const problems = sheetProblems(sp.id, cls.id, bg.id, level);
      if (problems.length > 0) failures.push(`${sp.id}/${cls.id}/${level}/${bg.id}: ${problems.join("; ")}`);
    }
    expect(failures).toEqual([]);
  });
});
