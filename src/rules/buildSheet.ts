import {
  ABILITY_INCREASE_CHOICES, activeChoices, isExpertise, isFeatChoice, isInvocationCantripChoice, isInvocationChoice,
  isSpellChoice, isWeaponMasteryChoice, requiredChoices,
} from "./choices";
import type { Concept } from "./choices";
import { CLASSES_DATA, LOADED_MAX_LEVEL, SPECIES, STANDARD_ARRAY, findBackground, findFeat } from "./index";
import { ABILITIES, ABILITY_NAMES, SKILLS } from "./types";
import type { Ability, BackgroundData, CharacterSheet, ChoiceSpec, Option, SkillId } from "./types";
import { alwaysPreparedSpells, computeSheet } from "./sheet";

export interface CharacterChoices extends Concept {
  baseScores: Record<Ability, number>;
  backgroundBonus: Partial<Record<Ability, number>>;
  classEquipment: "A" | "B" | "C";
  backgroundEquipment: "A" | "B";
  picks: Record<string, string[]>;
}

/** `message` is in Spanish: it is sent back to the model when it retries. */
export interface ChoiceError { field: string; message: string }

type Picks = Record<string, string[]>;

const skillName = (id: SkillId) => SKILLS.find((s) => s.id === id)!.name;
const field = (spec: ChoiceSpec) => `picks.${spec.id}`;

/** Choices of the same kind whose picks cannot repeat across choices (unless the option is repeatable). */
function relatedGroup(id: string): string | null {
  if (isWeaponMasteryChoice(id)) return "weapon_mastery";
  if (isInvocationChoice(id)) return "invocation";
  if (/\.languages?$/.test(id)) return "language";
  if (isExpertise(id)) return "expertise";
  return null;
}

function validateConcept(c: CharacterChoices): ChoiceError[] {
  const errors: ChoiceError[] = [];
  if (!Number.isInteger(c.level) || c.level < 1 || c.level > LOADED_MAX_LEVEL) {
    errors.push({ field: "level", message: `El nivel debe ser un entero entre 1 y ${LOADED_MAX_LEVEL}.` });
  }
  if (!SPECIES.some((s) => s.id === c.speciesId)) {
    errors.push({ field: "speciesId", message: `Especie desconocida "${c.speciesId}". Opciones: ${SPECIES.map((s) => s.id).join(", ")}.` });
  }
  if (!CLASSES_DATA.some((cl) => cl.id === c.classId)) {
    errors.push({ field: "classId", message: `Clase desconocida "${c.classId}". Opciones: ${CLASSES_DATA.map((cl) => cl.id).join(", ")}.` });
  }
  if (!findBackground(c.backgroundId)) {
    errors.push({ field: "backgroundId", message: `Trasfondo desconocido "${c.backgroundId}".` });
  }
  return errors;
}

function validateBaseScores(scores: Record<Ability, number>): ChoiceError[] {
  const values = ABILITIES.map((a) => scores[a]).sort((x, y) => y - x);
  const ok = Object.keys(scores).length === ABILITIES.length && values.every((v, i) => v === STANDARD_ARRAY[i]);
  return ok ? [] : [{
    field: "baseScores",
    message: `Las puntuaciones base deben ser la matriz estándar (${STANDARD_ARRAY.join(", ")}), un valor por característica.`,
  }];
}

function backgroundBonusProblem(bonus: Partial<Record<Ability, number>>, background: BackgroundData): string | null {
  const allowed = background.abilities.map((a) => ABILITY_NAMES[a]).join(", ");
  const entries = Object.entries(bonus).filter(([, v]) => v !== 0) as [string, number][];
  const foreign = entries.find(([a]) => !background.abilities.includes(a as Ability));
  if (foreign) {
    const name = ABILITY_NAMES[foreign[0] as Ability] ?? foreign[0];
    return `${background.name} solo permite aumentar ${allowed}; no ${name}.`;
  }
  const values = entries.map(([, v]) => v).sort((x, y) => y - x).join(",");
  if (values !== "2,1" && values !== "1,1,1") {
    return `El bonus de trasfondo debe ser +2 a una y +1 a otra, o +1 a las tres (${allowed}).`;
  }
  return null;
}

function validateEquipment(c: CharacterChoices): ChoiceError[] {
  const errors: ChoiceError[] = [];
  const cls = CLASSES_DATA.find((cl) => cl.id === c.classId)!;
  if (!["A", "B", "C"].includes(c.classEquipment) || !cls.equipment[c.classEquipment]) {
    const options = (["A", "B", "C"] as const).filter((k) => cls.equipment[k]).join(" o ");
    errors.push({ field: "classEquipment", message: `${cls.name} no tiene la opción de equipo "${c.classEquipment}"; elegí ${options}.` });
  }
  if (!["A", "B"].includes(c.backgroundEquipment)) {
    errors.push({ field: "backgroundEquipment", message: `El equipo de trasfondo debe ser A o B.` });
  }
  return errors;
}

/** Count, existence and repetition of each active spec; unknown pick keys. */
function validatePickShape(specs: ChoiceSpec[], picks: Picks): ChoiceError[] {
  const errors: ChoiceError[] = [];
  for (const spec of specs) {
    const chosen = picks[spec.id];
    if (!chosen || chosen.length === 0) {
      errors.push({ field: field(spec), message: `Falta elegir "${spec.label}" (${spec.count}).` });
      continue;
    }
    const problems: string[] = [];
    if (chosen.length !== spec.count) problems.push(`hay que elegir ${spec.count} y se eligieron ${chosen.length}`);
    const unknown = chosen.filter((p) => !spec.options.some((o) => o.id === p));
    if (unknown.length > 0) problems.push(`${unknown.map((u) => `"${u}"`).join(", ")} no es una opción válida`);
    const repeated = chosen.filter((p, i) => chosen.indexOf(p) !== i);
    const badRepeats = [...new Set(repeated)].filter((p) => !spec.allowRepeat && !optionOf(spec, p)?.repeatable);
    if (badRepeats.length > 0) problems.push(`${badRepeats.map((p) => optionOf(spec, p)?.name ?? p).join(", ")} está repetida`);
    if (problems.length > 0) errors.push({ field: field(spec), message: `"${spec.label}": ${problems.join("; ")}.` });
  }
  for (const key of Object.keys(picks)) {
    if (!specs.some((s) => s.id === key)) {
      errors.push({
        field: `picks.${key}`,
        message: "Esta elección no corresponde a este personaje (revisá especie, clase, nivel y las elecciones de las que depende).",
      });
    }
  }
  return errors;
}

const optionOf = (spec: ChoiceSpec, id: string): Option | undefined => spec.options.find((o) => o.id === id);

/** Valid, distinct picks of a spec, as options. */
function pickedOptions(spec: ChoiceSpec, picks: Picks): Option[] {
  return [...new Set(picks[spec.id] ?? [])].flatMap((p) => optionOf(spec, p) ?? []);
}

/** No skill twice across sources; expertise only in proficient skills. */
function validateSkills(c: CharacterChoices, specs: ChoiceSpec[]): ChoiceError[] {
  const errors: ChoiceError[] = [];
  const background = findBackground(c.backgroundId)!;
  const species = SPECIES.find((s) => s.id === c.speciesId)!;
  const owned = new Map<SkillId, string>();
  for (const s of background.skills) owned.set(s, `el trasfondo ${background.name}`);
  for (const s of species.fixedSkills) owned.set(s, `la especie ${species.name}`);

  for (const spec of specs.filter((s) => !isExpertise(s.id))) {
    const repeats: string[] = [];
    for (const option of pickedOptions(spec, c.picks)) {
      if (!option.skill) continue;
      const source = owned.get(option.skill);
      if (source) repeats.push(`${skillName(option.skill)} ya la tenés por ${source}`);
      else owned.set(option.skill, `"${spec.label}"`);
    }
    if (repeats.length > 0) errors.push({ field: field(spec), message: `${repeats.join("; ")}. Elegí otra habilidad.` });
  }

  for (const spec of specs.filter((s) => isExpertise(s.id))) {
    const missing = pickedOptions(spec, c.picks).filter((o) => !owned.has(o.id as SkillId));
    if (missing.length > 0) {
      const names = missing.map((o) => skillName(o.id as SkillId)).join(", ");
      errors.push({
        field: field(spec),
        message: `"${spec.label}": no sos competente en ${names}; la pericia solo puede ir en habilidades en las que seas competente.`,
      });
    }
  }
  return errors;
}

function validateRelated(specs: ChoiceSpec[], picks: Picks): ChoiceError[] {
  const errors: ChoiceError[] = [];
  const seen = new Map<string, Map<string, string>>(); // group → option id → label of the spec that took it
  for (const spec of specs) {
    const group = relatedGroup(spec.id);
    if (!group) continue;
    const taken = seen.get(group) ?? new Map<string, string>();
    seen.set(group, taken);
    const repeats = pickedOptions(spec, picks).filter((o) => !o.repeatable && taken.has(o.id));
    if (repeats.length > 0) {
      const detail = repeats.map((o) => `${o.name} ya está en "${taken.get(o.id)}"`).join("; ");
      errors.push({ field: field(spec), message: `"${spec.label}": ${detail}. Elegí otra opción.` });
    }
    for (const o of pickedOptions(spec, picks)) if (!taken.has(o.id)) taken.set(o.id, spec.label);
  }
  return errors;
}

function scoresBeforeFeats(c: CharacterChoices): Record<Ability, number> {
  return Object.fromEntries(ABILITIES.map((a) => [a, c.baseScores[a] + (c.backgroundBonus[a] ?? 0)])) as Record<Ability, number>;
}

/** Spells the species (and its lineage or legacy pick) grants at this level, with their source. */
function speciesSpells(c: CharacterChoices, specs: ChoiceSpec[]): Map<string, string> {
  const known = new Map<string, string>(); // spell id → source
  const species = SPECIES.find((s) => s.id === c.speciesId)!;
  for (const g of species.spells ?? []) {
    if (g.fromLevel <= c.level) known.set(g.spellId, `tu especie (${species.name})`);
  }
  for (const spec of specs.filter((s) => s.id.startsWith("species."))) {
    for (const option of pickedOptions(spec, c.picks)) {
      for (const g of option.spells ?? []) {
        if (g.fromLevel <= c.level && !known.has(g.spellId)) known.set(g.spellId, `tu especie (${option.name})`);
      }
    }
  }
  return known;
}

/** The generator's fix for the model's most common slip: picking again a spell that the species, a feat or an
    earlier choice already gives, even when that choice does not offer it. Each repeat becomes the first free option of the same choice (for the wizard's
    prepared spells, one from the spellbook), in the order validateSpells reads them. A repeat with no free option
    left stays, and validation reports it. */
export function replaceRepeatedSpells(c: CharacterChoices): CharacterChoices {
  const specs = activeChoices(requiredChoices(c), c.picks);
  const known = new Set(speciesSpells(c, specs).keys());
  const cls = CLASSES_DATA.find((x) => x.id === c.classId);
  const always = cls ? alwaysPreparedSpells(cls, c.level) : [];
  const picks = { ...c.picks };
  for (const spec of specs.filter((s) => isSpellChoice(s.id))) {
    const current = picks[spec.id];
    if (!current) continue;
    const blocked = new Set(known);
    if (spec.id === `class.${c.classId}.prepared`) for (const id of always) blocked.add(id);
    const book = spec.id === "class.wizard.prepared" ? new Set(picks["class.wizard.spellbook"] ?? []) : null;
    const result: string[] = [];
    for (const id of current) {
      // A spell already known is replaced even when this choice does not offer it (a wood elf wizard
      // picking druidcraft again as a class cantrip): the model meant a repeat, not some other option.
      // So is a wizard's prepared spell that is not in the spellbook.
      if (!blocked.has(id) && (!book || book.has(id))) {
        result.push(id);
        continue;
      }
      const free = spec.options.find((o) =>
        !blocked.has(o.id) && !current.includes(o.id) && !result.includes(o.id) && (!book || book.has(o.id)));
      result.push(free?.id ?? id);
    }
    picks[spec.id] = result;
    for (const id of result) if (optionOf(spec, id)) known.add(id);
  }
  return { ...c, picks };
}

/** The same fix for skills: a skill the background, the species or an earlier choice already gives, picked
    again (whether or not this choice offers it), becomes the first free option, in the order validateSkills
    reads them. Expertise is left alone: it must point at a skill the character already has. */
/** The same choices for another species: the old species' picks go (the new one may ask for its own). */
export function withSpecies(c: CharacterChoices, speciesId: string): CharacterChoices {
  if (speciesId === c.speciesId) return c;
  const prefix = `species.${c.speciesId}.`;
  return { ...c, speciesId, picks: Object.fromEntries(Object.entries(c.picks).filter(([id]) => !id.startsWith(prefix))) };
}

export function replaceRepeatedSkills(c: CharacterChoices): CharacterChoices {
  const specs = activeChoices(requiredChoices(c), c.picks);
  const background = findBackground(c.backgroundId)!;
  const species = SPECIES.find((s) => s.id === c.speciesId)!;
  const owned = new Set<string>([...background.skills, ...species.fixedSkills]);
  const picks = { ...c.picks };
  for (const spec of specs.filter((s) => !isExpertise(s.id) && s.options.some((o) => o.skill))) {
    const current = picks[spec.id];
    if (!current) continue;
    const result: string[] = [];
    for (const id of current) {
      const skill = optionOf(spec, id)?.skill ?? id;
      if (!owned.has(skill)) {
        result.push(id);
        continue;
      }
      const free = spec.options.find((o) =>
        !(o.skill && owned.has(o.skill)) && !current.includes(o.id) && !result.includes(o.id));
      result.push(free?.id ?? id);
    }
    picks[spec.id] = result;
    for (const id of result) {
      const skill = optionOf(spec, id)?.skill;
      if (skill) owned.add(skill);
    }
  }
  return { ...c, picks };
}

/** A spell is learned or prepared from one source only: species spells, feats, invocations and class choices. */
function validateSpells(c: CharacterChoices, specs: ChoiceSpec[]): ChoiceError[] {
  const errors: ChoiceError[] = [];
  const known = speciesSpells(c, specs);
  for (const spec of specs.filter((s) => isSpellChoice(s.id))) {
    const options = pickedOptions(spec, c.picks);
    const repeats = options.filter((o) => known.has(o.id));
    if (repeats.length > 0) {
      const detail = repeats.map((o) => `${o.name} ya lo tenés por ${known.get(o.id)}`).join("; ");
      errors.push({ field: field(spec), message: `"${spec.label}": ${detail}. Elegí otro conjuro.` });
    }
    for (const o of options) if (!known.has(o.id)) known.set(o.id, `"${spec.label}"`);
  }
  return errors;
}

/** Agonizing Blast and co. improve cantrips the character knows as warlock spells (class or Book of Shadows). */
function validateInvocationCantrips(specs: ChoiceSpec[], picks: Picks): ChoiceError[] {
  const own = new Set([...(picks["class.warlock.cantrips"] ?? []), ...(picks["invocation.pact_of_the_tome.cantrips"] ?? [])]);
  return specs.filter((s) => isInvocationCantripChoice(s.id)).flatMap((spec) => {
    const missing = pickedOptions(spec, picks).filter((o) => !own.has(o.id));
    return missing.length === 0 ? [] : [{
      field: field(spec),
      message: `"${spec.label}": ${missing.map((o) => o.name).join(", ")} no está entre tus trucos de brujo; elegí uno que conozcas y que cumpla el requisito.`,
    }];
  });
}

/** Feats are taken once unless repeatable, and must meet their prerequisites. */
function validateFeats(c: CharacterChoices, specs: ChoiceSpec[]): ChoiceError[] {
  const errors: ChoiceError[] = [];
  const background = findBackground(c.backgroundId)!;
  const owned = new Map<string, string>([[background.featId, `el trasfondo ${background.name}`]]);
  const scores = scoresBeforeFeats(c);
  for (const spec of specs.filter((s) => isFeatChoice(s.id))) {
    const problems: string[] = [];
    for (const option of pickedOptions(spec, c.picks)) {
      const feat = findFeat(option.id);
      if (!feat) continue; // non-feat fighting style options (Blessed Warrior, Druidic Warrior)
      const source = owned.get(feat.id);
      if (source && !feat.repeatable) problems.push(`ya tenés la dote ${feat.name} por ${source} y solo se obtiene una vez`);
      else owned.set(feat.id, `"${spec.label}"`);
      const pre = feat.prerequisite;
      if (pre?.minLevel && c.level < pre.minLevel) problems.push(`${feat.name} requiere nivel ${pre.minLevel}`);
      if (pre?.anyAbility && !pre.anyAbility.abilities.some((a) => scores[a] >= pre.anyAbility!.min)) {
        const { abilities, min } = pre.anyAbility;
        const names = abilities.map((a) => ABILITY_NAMES[a]).join(" o ");
        const current = abilities.map((a) => `${ABILITY_NAMES[a]} ${scores[a]}`).join(", ");
        problems.push(`${feat.name} requiere ${names} ${min} o más (tenés ${current})`);
      }
    }
    if (problems.length > 0) errors.push({ field: field(spec), message: `"${spec.label}": ${problems.join("; ")}.` });
  }
  return errors;
}

function validateAbilityCap(c: CharacterChoices, specs: ChoiceSpec[]): ChoiceError[] {
  const errors: ChoiceError[] = [];
  const scores = scoresBeforeFeats(c);
  for (const spec of specs.filter((s) => ABILITY_INCREASE_CHOICES.has(s.id))) {
    for (const p of c.picks[spec.id] ?? []) if (ABILITIES.includes(p as Ability)) scores[p as Ability] += 1;
    const over = ABILITIES.filter((a) => scores[a] > 20);
    if (over.length > 0) {
      const detail = over.map((a) => `${ABILITY_NAMES[a]} quedaría en ${scores[a]}`).join(", ");
      errors.push({ field: field(spec), message: `"${spec.label}": ${detail}; el máximo es 20.` });
    }
  }
  return errors;
}

function validateSpellbook(specs: ChoiceSpec[], picks: Picks): ChoiceError[] {
  const prepared = specs.find((s) => s.id === "class.wizard.prepared");
  if (!prepared || !specs.some((s) => s.id === "class.wizard.spellbook")) return [];
  const book = new Set(picks["class.wizard.spellbook"] ?? []);
  const outside = pickedOptions(prepared, picks).filter((o) => !book.has(o.id));
  return outside.length === 0 ? [] : [{
    field: field(prepared),
    message: `"${prepared.label}": ${outside.map((o) => o.name).join(", ")} no está en tu libro de conjuros; solo podés preparar conjuros de tu libro.`,
  }];
}

/** Spells a class feature always keeps prepared do not count against the prepared spells (SRD, e.g. the Paladin's
    Spellcasting), so preparing one of them again would waste a pick. */
function validateAlwaysPrepared(c: CharacterChoices, specs: ChoiceSpec[]): ChoiceError[] {
  const cls = CLASSES_DATA.find((x) => x.id === c.classId)!;
  const prepared = specs.find((s) => s.id === `class.${cls.id}.prepared`);
  if (!prepared) return [];
  const always = new Set(alwaysPreparedSpells(cls, c.level));
  const repeats = pickedOptions(prepared, c.picks).filter((o) => always.has(o.id));
  return repeats.length === 0 ? [] : [{
    field: field(prepared),
    message: `"${prepared.label}": ${repeats.map((o) => o.name).join(", ")} ya lo tenés siempre preparado por un rasgo de ${cls.name}; elegí otro conjuro.`,
  }];
}

/** Every rule a character's choices must meet; [] when they are legal. */
export function validateChoices(choices: CharacterChoices): ChoiceError[] {
  const conceptErrors = validateConcept(choices);
  if (conceptErrors.length > 0) return conceptErrors;

  const background = findBackground(choices.backgroundId)!;
  const bonusProblem = backgroundBonusProblem(choices.backgroundBonus, background);
  const specs = activeChoices(requiredChoices(choices), choices.picks);
  return [
    ...validateBaseScores(choices.baseScores),
    ...(bonusProblem ? [{ field: "backgroundBonus", message: bonusProblem }] : []),
    ...validateEquipment(choices),
    ...validatePickShape(specs, choices.picks),
    ...validateSkills(choices, specs),
    ...validateRelated(specs, choices.picks),
    ...validateSpells(choices, specs),
    ...validateInvocationCantrips(specs, choices.picks),
    ...validateFeats(choices, specs),
    ...validateAbilityCap(choices, specs),
    ...validateSpellbook(specs, choices.picks),
    ...validateAlwaysPrepared(choices, specs),
  ];
}

export type BuildResult = { ok: true; sheet: CharacterSheet } | { ok: false; errors: ChoiceError[] };

/** Validates the choices and, when they are legal, computes the whole sheet in code. */
export function buildSheet(choices: CharacterChoices): BuildResult {
  const errors = validateChoices(choices);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, sheet: computeSheet(choices) };
}
