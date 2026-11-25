import { CLASSES_DATA, FEATS, SPECIES, SPELLS, findBackground, findFeat } from "./index";
import type { SpellData } from "./index";
import { STANDARD_LANGUAGES, skillOptions } from "./data/classes/common";
import { spellOptions } from "./data/spells";
import { requirementsOf } from "./types";
import type { ChoiceSpec, ClassData, LevelRow, Option, Requirement } from "./types";

export interface Concept {
  speciesId: string; classId: string; backgroundId: string; level: number;
  /** false: the player's subclass is outside the SRD, so the SRD subclass doesn't apply. */
  srdSubclass?: false;
}

/** Choices whose option ids are feat ids (fighting styles may also offer non-feat options). */
export function isFeatChoice(id: string): boolean {
  return id === "species.human.versatile" || /^class\.\w+\.(level\d+_feat|fighting_style|additional_fighting_style|lessons_feat)$/.test(id);
}

/** Choices whose picks each raise that ability score by 1 (capped at 20). */
export const ABILITY_INCREASE_CHOICES = new Set(["feat.asi.abilities", "feat.grappler.ability"]);

/** Choices that point at cantrips the character already knows (e.g. the cantrip Agonizing Blast improves). */
export const isInvocationCantripChoice = (id: string) => /^invocation\.\w+\.cantrip$/.test(id);

export const isInvocationChoice = (id: string) => /^class\.warlock\.invocation/.test(id);

/** Expertise-like choices: their picks must be skills the character is already proficient in. */
export const isExpertise = (id: string) => id.endsWith(".expertise") || id === "class.wizard.scholar";

/** Choices whose picks are spells the character learns or prepares (not the wizard's spellbook, which
    holds the prepared spells by design, nor the invocation choices that point at known cantrips). */
export const isSpellChoice = (id: string) => /(\.cantrips|_cantrips|_cantrip|\.spell|\.prepared|\.rituals)$/.test(id);

/** Choices whose picks each grant a weapon's mastery property. */
export const isWeaponMasteryChoice = (id: string) => /^class\.\w+\.weapon_mastery/.test(id);

const ORIGIN_LANGUAGES: ChoiceSpec = {
  id: "origin.languages", label: "Idiomas de origen (además del común)", count: 2, options: STANDARD_LANGUAGES,
};

const toOptions = (spells: SpellData[]): Option[] => spells.map((sp) => ({ id: sp.id, name: sp.name, summary: sp.summary }));

const damageCantrips = (eligible: (d: NonNullable<SpellData["damage"]>) => boolean): Option[] =>
  toOptions(SPELLS.filter((sp) => sp.level === 0 && sp.damage && eligible(sp.damage)));

const cantripTarget = (invocationId: string, name: string, eligible: (d: NonNullable<SpellData["damage"]>) => boolean) => ({
  id: `invocation.${invocationId}.cantrip`, label: `Truco de brujo para ${name}`, count: 1, options: damageCantrips(eligible),
});

/** Choices an invocation pick brings, keyed by invocation id. The `requires` is added from the invocation specs. */
const INVOCATION_GRANTS: Record<string, () => Omit<ChoiceSpec, "requires">[]> = {
  pact_of_the_tome: () => [
    { id: "invocation.pact_of_the_tome.cantrips", label: "Trucos del Libro de las sombras", count: 3, options: toOptions(SPELLS.filter((sp) => sp.level === 0)) },
    {
      id: "invocation.pact_of_the_tome.rituals", label: "Rituales del Libro de las sombras", count: 2,
      options: toOptions(SPELLS.filter((sp) => sp.level === 1 && sp.ritual)),
    },
  ],
  agonizing_blast: () => [cantripTarget("agonizing_blast", "Descarga agónica", () => true)],
  eldritch_spear: () => [cantripTarget("eldritch_spear", "Lanza sobrenatural", (d) => d.rangeFt >= 10)],
  repelling_blast: () => [cantripTarget("repelling_blast", "Descarga ahuyentadora", (d) => d.attackRoll)],
  lessons_of_the_first_ones: () => [{
    id: "class.warlock.lessons_feat", label: "Dote de origen (Lecciones de los primeros)", count: 1,
    options: FEATS.filter((f) => f.category === "origin").map((f) => ({ id: f.id, name: f.name, summary: f.summary })),
  }],
};

/** Highest spell level the class can prepare: its highest slot (pact slot level for the warlock). */
function highestSpellLevel(row: LevelRow): number {
  return row.pactSlots?.slotLevel ?? row.slots?.length ?? 0;
}

const uniqueOptions = (options: Option[]): Option[] => [...new Map(options.map((o) => [o.id, o])).values()];

function leveledSpellOptions(list: string, maxLevel: number): Option[] {
  return Array.from({ length: maxLevel }, (_, i) => spellOptions(list, i + 1)).flat();
}

/** Bard 10, Magical Secrets: prepared spells may come from the bard, cleric, druid and wizard lists. */
const MAGICAL_SECRETS = { classId: "bard", level: 10, lists: ["bard", "cleric", "druid", "wizard"] };

function spellChoices(cls: ClassData, row: LevelRow): ChoiceSpec[] {
  if (!cls.spellcasting) return [];
  const list = cls.spellcasting.spellList;
  const secrets = cls.id === MAGICAL_SECRETS.classId && row.level >= MAGICAL_SECRETS.level;
  const leveled = secrets
    ? uniqueOptions(MAGICAL_SECRETS.lists.flatMap((l) => leveledSpellOptions(l, highestSpellLevel(row))))
    : leveledSpellOptions(list, highestSpellLevel(row));
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

/** Specs granted by picking an option of `parents` (invocations or feats), one requirement per parent offering it. */
function grantedBy(parents: ChoiceSpec[], grants: (optionId: string) => Omit<ChoiceSpec, "requires">[]): ChoiceSpec[] {
  return parents.flatMap((parent) =>
    parent.options.flatMap((option) =>
      grants(option.id).map((spec) => ({ ...spec, requires: { choiceId: parent.id, optionId: option.id } })),
    ),
  );
}

/** One spec per id: an unconditional spec wins; conditional ones merge their requirements (any of them unlocks it). */
function mergeById(specs: ChoiceSpec[]): ChoiceSpec[] {
  const out: ChoiceSpec[] = [];
  for (const spec of specs) {
    const i = out.findIndex((o) => o.id === spec.id);
    if (i < 0) out.push(spec);
    else if (!spec.requires) out[i] = spec;
    else if (out[i]!.requires) out[i] = { ...out[i]!, requires: [...requirementsOf(out[i]!), ...requirementsOf(spec)] };
  }
  return out.map((s) => (Array.isArray(s.requires) && s.requires.length === 1 ? { ...s, requires: s.requires[0] } : s));
}

/** Every spec this concept can need, with unique ids. Conditional specs carry `requires`: one requirement, or a
    list when several picks can unlock the same spec (e.g. Skilled from Versatile or from Lessons of the First Ones).
    Spec order decides which spec reports a duplicate across sources (the later one). Throws on unknown ids or
    levels without class data. */
export function requiredChoices(concept: Concept): ChoiceSpec[] {
  const species = SPECIES.find((s) => s.id === concept.speciesId);
  const cls = CLASSES_DATA.find((c) => c.id === concept.classId);
  const background = findBackground(concept.backgroundId);
  const row = cls?.levels.find((r) => r.level === concept.level);
  if (!species || !cls || !background || !row) throw new Error(`Concepto inválido: ${JSON.stringify(concept)}`);

  const base: ChoiceSpec[] = [
    ORIGIN_LANGUAGES,
    ...species.choices,
    ...background.choices,
    ...(findFeat(background.featId)?.choices ?? []),
    {
      id: `class.${cls.id}.skills`, label: "Habilidades de clase", count: cls.skillChoice.count,
      options: skillOptions(cls.skillChoice.options),
    },
    ...spellChoices(cls, row),
    ...cls.levels.filter((r) => r.level <= concept.level).flatMap((r) => r.choices),
    ...(concept.srdSubclass === false ? [] : cls.subclass.features.filter((f) => f.level <= concept.level))
      .flatMap((f) => f.choices ?? []),
  ];
  const fromInvocations = grantedBy(base.filter((s) => isInvocationChoice(s.id)), (id) => INVOCATION_GRANTS[id]?.() ?? []);
  const featParents = [...base, ...fromInvocations].filter((s) => isFeatChoice(s.id));
  const fromFeats = grantedBy(featParents, (id) => findFeat(id)?.choices ?? []);
  return mergeById([...base, ...fromInvocations, ...fromFeats]);
}

function isRepeatablePick(spec: ChoiceSpec | undefined, optionId: string): boolean {
  if (!spec) return false;
  if (spec.options.find((o) => o.id === optionId)?.repeatable) return true;
  return isFeatChoice(spec.id) && (findFeat(optionId)?.repeatable ?? false);
}

/** Specs whose requirements are met by the picks (an unconditional spec always is; a conditional one needs an
    active parent spec with that pick). When the unlocking option is repeatable and was taken n times in total,
    the spec asks for n times its count (e.g. one cantrip per Agonizing Blast, three skills per Skilled). */
export function activeChoices(specs: ChoiceSpec[], picks: Record<string, string[]>): ChoiceSpec[] {
  const active = new Set<string>();
  const metBy = (spec: ChoiceSpec): Requirement[] =>
    requirementsOf(spec).filter((r) => active.has(r.choiceId) && (picks[r.choiceId] ?? []).includes(r.optionId));
  let changed = true;
  while (changed) { // parents usually come first, but do not rely on the order
    changed = false;
    for (const spec of specs) {
      if (active.has(spec.id) || (spec.requires && metBy(spec).length === 0)) continue;
      active.add(spec.id);
      changed = true;
    }
  }
  return specs.filter((s) => active.has(s.id)).map((spec) => {
    const met = metBy(spec);
    const times = met.reduce((n, r) => n + picks[r.choiceId]!.filter((p) => p === r.optionId).length, 0);
    const repeatable = met.some((r) => isRepeatablePick(specs.find((s) => s.id === r.choiceId), r.optionId));
    return repeatable && times > 1 ? { ...spec, count: spec.count * times } : spec;
  });
}
