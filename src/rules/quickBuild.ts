import { CLASSES_DATA, LOADED_MAX_LEVEL, SPECIES, STANDARD_ARRAY, findBackground } from "./index";
import { buildSheet, type CharacterChoices } from "./buildSheet";
import { activeChoices, isInvocationCantripChoice, requiredChoices } from "./choices";
import { alwaysPreparedSpells } from "./sheet";
import { ABILITIES, type Ability, type CharacterSheet } from "./types";

const DEFAULT_BACKGROUND_BY_CLASS: Record<string, string> = {
  barbarian: "soldier",
  bard: "criminal",
  cleric: "acolyte",
  druid: "acolyte",
  fighter: "soldier",
  monk: "soldier",
  paladin: "soldier",
  ranger: "criminal",
  rogue: "criminal",
  sorcerer: "sage",
  warlock: "sage",
  wizard: "sage",
};

/** Default SRD background for a class when the player leaves it unset during quick setup. */
export function recommendedBackgroundForClass(classId: string): string {
  return DEFAULT_BACKGROUND_BY_CLASS[classId] ?? "soldier";
}

export interface QuickBuildInput {
  speciesId: string;
  classId: string;
  backgroundId?: string | null;
  level: number;
  srdSubclass?: false;
}

/** Deterministic legal SRD character build for `CharacterForm` quick-fill (levels 1 to `LOADED_MAX_LEVEL`).
    Assigns the standard array favoring the class's primary ability and Constitution, then picks
    non-overlapping skills, spells, feats and equipment validated by `buildSheet`. */
export function buildQuickChoices(
  input: QuickBuildInput,
): { choices: CharacterChoices; sheet: CharacterSheet } | null {
  if (!Number.isInteger(input.level) || input.level < 1 || input.level > LOADED_MAX_LEVEL) return null;
  const cls = CLASSES_DATA.find((c) => c.id === input.classId);
  const species = SPECIES.find((s) => s.id === input.speciesId);
  const backgroundId = input.backgroundId || recommendedBackgroundForClass(input.classId);
  const background = findBackground(backgroundId);
  if (!cls || !species || !background) return null;

  const priority = [...new Set<Ability>([...cls.primaryAbility, "con", "dex", ...ABILITIES])];
  const baseScores = Object.fromEntries(priority.map((a, i) => [a, STANDARD_ARRAY[i]!])) as Record<Ability, number>;
  // Prefer raising the class's primary ability (+2) when the background offers it.
  const primaryInBg = background.abilities.find((a) => cls.primaryAbility.includes(a));
  const firstBonus = primaryInBg ?? background.abilities[0]!;
  const secondBonus = background.abilities.find((a) => a !== firstBonus) ?? background.abilities[1]!;
  const backgroundBonus: Partial<Record<Ability, number>> = { [firstBonus]: 2, [secondBonus]: 1 };

  const concept = {
    speciesId: species.id,
    classId: cls.id,
    backgroundId: background.id,
    level: input.level,
    ...(input.srdSubclass === false ? { srdSubclass: false as const } : {}),
  };

  const picks: Record<string, string[]> = {};
  const speciesSpells = (species.spells ?? []).map((g) => g.spellId);
  const used = new Set<string>([
    background.featId,
    ...background.skills,
    ...species.fixedSkills,
    ...speciesSpells,
    ...alwaysPreparedSpells(cls, input.level),
  ]);
  const proficient = new Set<string>([...background.skills, ...species.fixedSkills]);
  const expert = new Set<string>();

  for (let round = 0; round < 20; round++) {
    // Pick class spell lists last so high-level prepared lists do not exhaust options needed by origin feats.
    const late = (id: string) => (id.endsWith(".prepared") ? 2 : id === "class.wizard.spellbook" ? 1 : 0);
    const todo = activeChoices(requiredChoices(concept), picks)
      .filter((s) => !picks[s.id])
      .sort((a, b) => late(a.id) - late(b.id));
    if (todo.length === 0) break;

    for (const spec of todo) {
      let options = spec.options;
      if (spec.id.endsWith(".expertise") || spec.id === "class.wizard.scholar") {
        options = options.filter((o) => proficient.has(o.id) && !expert.has(o.id));
      } else if (spec.id === "class.wizard.prepared") {
        options = options.filter((o) => picks["class.wizard.spellbook"]!.includes(o.id));
      } else if (isInvocationCantripChoice(spec.id)) {
        options = options.filter((o) => picks["class.warlock.cantrips"]!.includes(o.id));
      } else if (/\.abilit(y|ies)$/.test(spec.id)) {
        const preferred = cls.primaryAbility.find((a) => options.some((o) => o.id === a));
        const fallback = options.some((o) => o.id === "con") ? "con" : null;
        const pick = preferred ?? fallback;
        if (pick) options = options.filter((o) => o.id === pick);
      } else {
        options = options.filter((o) => !used.has(o.id) && !(o.skill && used.has(o.skill)));
      }
      if (late(spec.id) > 0 && input.level >= 5) options = [...options].reverse();
      if (/\.level([6-9]|\d{2})_feat$/.test(spec.id)) {
        options = spec.options.filter((o) => o.id === "ability_score_improvement");
      }
      const chosen = spec.allowRepeat
        ? Array.from({ length: spec.count }, () => options[0]!.id)
        : options.slice(0, spec.count).map((o) => o.id);
      for (const o of spec.options) {
        if (chosen.length < spec.count && !chosen.includes(o.id)) chosen.push(o.id);
      }
      picks[spec.id] = chosen;
      if (spec.id.endsWith(".expertise") || spec.id === "class.wizard.scholar") {
        for (const id of chosen) expert.add(id);
      }
      for (const id of chosen) {
        const option = spec.options.find((o) => o.id === id);
        if (!option) continue;
        if (spec.id !== "class.wizard.spellbook" && !/\.abilit(y|ies)$/.test(spec.id)) used.add(id);
        for (const g of option.spells ?? []) used.add(g.spellId);
        if (option.skill) {
          used.add(option.skill);
          proficient.add(option.skill);
        }
      }
    }
  }

  const choices: CharacterChoices = {
    ...concept,
    baseScores,
    backgroundBonus,
    classEquipment: "A",
    backgroundEquipment: "A",
    picks,
  };
  const built = buildSheet(choices);
  return built.ok ? { choices, sheet: built.sheet } : null;
}
