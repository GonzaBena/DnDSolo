import { CLASSES_DATA, FEATS, SPECIES, findBackground, findFeat } from "./index";
import { skillOptions } from "./data/classes/common";
import { spellOptions } from "./data/spells";
import type { ChoiceSpec, ClassData, LevelRow, Option } from "./types";

export interface Concept { speciesId: string; classId: string; backgroundId: string; level: number }

/** Choices whose option ids are feat ids (fighting styles may also offer non-feat options). */
export function isFeatChoice(id: string): boolean {
  return id === "species.human.versatile" || /^class\.\w+\.(level4_feat|fighting_style|lessons_feat)$/.test(id);
}

/** Choices whose picks each raise that ability score by 1 (capped at 20). */
export const ABILITY_INCREASE_CHOICES = new Set(["feat.asi.abilities", "feat.grappler.ability"]);

const LESSONS = { choiceId: "class.warlock.invocation_2", optionId: "lessons_of_the_first_ones" };

/** Highest spell level the class can prepare: its highest slot (pact slot level for the warlock). */
function highestSpellLevel(row: LevelRow): number {
  return row.pactSlots?.slotLevel ?? row.slots?.length ?? 0;
}

function leveledSpellOptions(list: string, maxLevel: number): Option[] {
  return Array.from({ length: maxLevel }, (_, i) => spellOptions(list, i + 1)).flat();
}

function spellChoices(cls: ClassData, row: LevelRow): ChoiceSpec[] {
  if (!cls.spellcasting) return [];
  const list = cls.spellcasting.spellList;
  const leveled = leveledSpellOptions(list, highestSpellLevel(row));
  const specs: ChoiceSpec[] = [];
  if (row.cantrips) {
    specs.push({ id: `class.${cls.id}.cantrips`, label: "Trucos", count: row.cantrips, options: spellOptions(list, 0) });
  }
  if (cls.id === "wizard") {
    specs.push({ id: "class.wizard.spellbook", label: "Libro de conjuros", count: 6 + 2 * (row.level - 1), options: leveled });
  }
  if (row.preparedSpells) {
    specs.push({ id: `class.${cls.id}.prepared`, label: "Conjuros preparados", count: row.preparedSpells, options: leveled });
  }
  return specs;
}

/** The choices of each feat a feat choice can grant, active only when that feat is picked. */
function featGrantedChoices(spec: ChoiceSpec): ChoiceSpec[] {
  return spec.options.flatMap((option) =>
    (findFeat(option.id)?.choices ?? []).map((c) => ({ ...c, requires: { choiceId: spec.id, optionId: option.id } })),
  );
}

/** All specs this concept can need, conditional ones included (with `requires`), parents before children.
    A feat's choices can appear more than once with different `requires` (one per source that can grant
    the feat); activeChoices keeps one. Throws on unknown ids or levels without class data. */
export function requiredChoices(concept: Concept): ChoiceSpec[] {
  const species = SPECIES.find((s) => s.id === concept.speciesId);
  const cls = CLASSES_DATA.find((c) => c.id === concept.classId);
  const background = findBackground(concept.backgroundId);
  const row = cls?.levels.find((r) => r.level === concept.level);
  if (!species || !cls || !background || !row) throw new Error(`Concepto inválido: ${JSON.stringify(concept)}`);

  const specs: ChoiceSpec[] = [
    ...species.choices,
    ...background.choices,
    ...(findFeat(background.featId)?.choices ?? []),
    {
      id: `class.${cls.id}.skills`, label: "Habilidades de clase", count: cls.skillChoice.count,
      options: skillOptions(cls.skillChoice.options),
    },
    ...spellChoices(cls, row),
    ...cls.levels.filter((r) => r.level <= concept.level).flatMap((r) => r.choices),
    ...cls.subclass.features.filter((f) => f.level <= concept.level).flatMap((f) => f.choices ?? []),
  ];
  if (specs.some((s) => s.id === LESSONS.choiceId)) {
    specs.push({
      id: "class.warlock.lessons_feat", label: "Dote de origen (Lecciones de los primeros)", count: 1, requires: LESSONS,
      options: FEATS.filter((f) => f.category === "origin").map((f) => ({ id: f.id, name: f.name, summary: f.summary })),
    });
  }

  const unconditional = new Set(specs.filter((s) => !s.requires).map((s) => s.id));
  const granted = specs.filter((s) => isFeatChoice(s.id)).flatMap(featGrantedChoices);
  return [...specs, ...granted.filter((s) => !unconditional.has(s.id))];
}

/** Drops specs whose `requires` pick was not made (or whose parent is itself inactive), keeps one spec
    per id, and asks for one set of picks per time a repeatable parent option was taken. */
export function activeChoices(specs: ChoiceSpec[], picks: Record<string, string[]>): ChoiceSpec[] {
  const active: ChoiceSpec[] = [];
  for (const spec of specs) {
    if (active.some((a) => a.id === spec.id)) continue;
    if (!spec.requires) {
      active.push(spec);
      continue;
    }
    const { choiceId, optionId } = spec.requires;
    const parent = active.find((a) => a.id === choiceId);
    if (!parent) continue;
    const times = (picks[choiceId] ?? []).filter((p) => p === optionId).length;
    if (times === 0) continue;
    const repeatable = parent.options.find((o) => o.id === optionId)?.repeatable ?? false;
    active.push(repeatable && times > 1 ? { ...spec, count: spec.count * times } : spec);
  }
  return active;
}
