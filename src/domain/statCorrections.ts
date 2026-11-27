import { buildSheet } from "../rules/buildSheet";
import { statsFromSheet } from "./stats";
import type { SheetOverrides } from "../rules/buildSheet";
import { ABILITIES, type Ability, type CharacterSheet, type SkillId } from "../rules/types";
import type { Character, CharacterStats, SkillTier, StatAdjustments } from "./types";


export type { StatAdjustments };

type Attack = CharacterStats["attacks"][number];

/** The numbers the DM uses, as the player sees them on their sheet. */
export interface StatValues {
  maxHp: number;
  armorClass: number;
  initiative: number;
  speed: number;
  spellSaveDc: number | null;
  spellAttackBonus: number | null;
  attacks: Attack[];
}

export const STAT_VALUE_MIN = { maxHp: 1, armorClass: 1, speed: 0 } as const;

const nonZero = (n: number) => (n !== 0 ? n : undefined);

function optional(base: number | null, adjustment: number | undefined): number | null {
  if (adjustment === undefined) return base;
  return base === null ? adjustment : base + adjustment;
}

/** The built stats with the player's corrections on top. */
export function applyAdjustments(base: CharacterStats, adj: StatAdjustments | undefined): CharacterStats {
  if (!adj) return base;
  const removed = new Set(adj.removedAttacks ?? []);
  const attacks = base.attacks
    .filter((a) => !removed.has(a.name))
    .map((a) => {
      const fix = adj.attacks?.[a.name];
      return fix ? { ...a, attackBonus: a.attackBonus + (fix.bonus ?? 0), damage: fix.damage ?? a.damage } : a;
    });
  return {
    ...base,
    maxHp: base.maxHp + (adj.maxHp ?? 0),
    armorClass: base.armorClass + (adj.armorClass ?? 0),
    initiative: base.initiative + (adj.initiative ?? 0),
    speed: base.speed + (adj.speed ?? 0),
    spellSaveDc: optional(base.spellSaveDc, adj.spellSaveDc),
    spellAttackBonus: optional(base.spellAttackBonus, adj.spellAttackBonus),
    attacks: [...attacks, ...(adj.extraAttacks ?? [])],
  };
}

function optionalDiff(base: number | null, value: number | null): number | undefined {
  if (value === null) return undefined;
  return base === null ? value : nonZero(value - base);
}

/** The corrections that turn the built stats into the player's values. */
export function diffAdjustments(base: CharacterStats, values: StatValues): StatAdjustments {
  const adj: StatAdjustments = {};
  const set = <K extends keyof StatAdjustments>(key: K, value: StatAdjustments[K] | undefined) => {
    if (value !== undefined) adj[key] = value;
  };
  set("maxHp", nonZero(values.maxHp - base.maxHp));
  set("armorClass", nonZero(values.armorClass - base.armorClass));
  set("initiative", nonZero(values.initiative - base.initiative));
  set("speed", nonZero(values.speed - base.speed));
  set("spellSaveDc", optionalDiff(base.spellSaveDc, values.spellSaveDc));
  set("spellAttackBonus", optionalDiff(base.spellAttackBonus, values.spellAttackBonus));

  const byName = new Map(values.attacks.map((a) => [a.name, a]));
  const builtNames = new Set(base.attacks.map((a) => a.name));
  const attacks: NonNullable<StatAdjustments["attacks"]> = {};
  const removed: string[] = [];
  for (const a of base.attacks) {
    const mine = byName.get(a.name);
    if (!mine) {
      removed.push(a.name);
      continue;
    }
    const bonus = nonZero(mine.attackBonus - a.attackBonus);
    const damage = mine.damage !== a.damage ? mine.damage : undefined;
    if (bonus !== undefined || damage !== undefined) {
      attacks[a.name] = { ...(bonus !== undefined ? { bonus } : {}), ...(damage !== undefined ? { damage } : {}) };
    }
  }
  const extra = values.attacks.filter((a) => !builtNames.has(a.name));
  if (Object.keys(attacks).length > 0) adj.attacks = attacks;
  if (extra.length > 0) adj.extraAttacks = extra;
  if (removed.length > 0) adj.removedAttacks = removed;
  return adj;
}

/** The character's sheet: built by the rules from their choices, with
    their own scores, saves and skill training. Null without choices. */
export function playerSheet(player: Character): CharacterSheet | null {
  return sheetWith(player, sheetOverridesOf(player.statAdjustments));
}

function sheetWith(player: Character, overrides: SheetOverrides): CharacterSheet | null {
  if (!player.choices) return null;
  const built = buildSheet(player.choices, overrides);
  return built.ok ? built.sheet : null;
}

/** The combat numbers of that sheet, before the combat corrections. */
export function builtStats(player: Character): CharacterStats | null {
  const sheet = playerSheet(player);
  return sheet ? statsFromSheet(sheet) : null;
}

export const hasAdjustments = (adj: StatAdjustments | undefined): boolean =>
  adj !== undefined && Object.keys(adj).length > 0;

/** Current HP follows the maximum (as on a level up): it moves as much, stays
    at 0 while down and at 1 or more while up. */
function followMax(current: number | null, oldMax: number | null, newMax: number): number {
  if (current === null || oldMax === null) return newMax;
  if (current <= 0) return current;
  return Math.max(1, Math.min(newMax, current + (newMax - oldMax)));
}

export type CorrectResult = { ok: true; player: Character } | { ok: false; message: string };

function validate(values: StatValues): string | null {
  const ints = [values.maxHp, values.armorClass, values.initiative, values.speed];
  if (ints.some((n) => !Number.isInteger(n))) return "Usá números enteros.";
  if (values.maxHp < STAT_VALUE_MIN.maxHp) return "Los PG máximos tienen que ser al menos 1.";
  if (values.armorClass < STAT_VALUE_MIN.armorClass) return "La CA tiene que ser al menos 1.";
  if (values.speed < STAT_VALUE_MIN.speed) return "La velocidad no puede ser negativa.";
  for (const n of [values.spellSaveDc, values.spellAttackBonus]) {
    if (n !== null && !Number.isInteger(n)) return "Usá números enteros.";
  }
  const names = new Set<string>();
  for (const a of values.attacks) {
    const name = a.name.trim();
    if (name === "") return "Cada ataque necesita un nombre.";
    if (!Number.isInteger(a.attackBonus)) return `El bonificador de ${name} tiene que ser un número entero.`;
    if (names.has(name.toLowerCase())) return `Hay dos ataques llamados ${name}.`;
    names.add(name.toLowerCase());
  }
  return null;
}

/** The player copies their own sheet's numbers into the game: from now on
    the DM uses these. With rules choices they are kept as corrections of the
    built sheet; on a manual sheet they simply replace the stats. */
export function correctStats(player: Character, input: StatValues): CorrectResult {
  const values: StatValues = {
    ...input,
    attacks: input.attacks.map((a) => ({ name: a.name.trim(), attackBonus: a.attackBonus, damage: a.damage.trim() })),
  };
  const problem = validate(values);
  if (problem) return { ok: false, message: problem };
  const oldMax = player.stats?.maxHp ?? null;
  const base = builtStats(player);
  const adjustments = base ? diffAdjustments(base, values) : undefined;
  const stats: CharacterStats = base
    ? applyAdjustments(base, adjustments)
    : { hitDice: player.stats?.hitDice ?? "", ...values };
  return {
    ok: true,
    player: {
      ...withAdjustments(player, { ...sheetPart(player.statAdjustments), ...(adjustments ?? {}) }),
      stats,
      currentHp: followMax(player.currentHp, oldMax, stats.maxHp),
    },
  };
}

/** Drops the combat corrections (the ability and skill ones stay): back to
    the numbers built from the rules choices. */
export function resetStats(player: Character): CorrectResult {
  const base = builtStats(player);
  if (!base) return { ok: false, message: "Esta ficha no tiene valores calculados a los que volver." };
  return {
    ok: true,
    player: {
      ...withAdjustments(player, sheetPart(player.statAdjustments)),
      stats: base,
      currentHp: followMax(player.currentHp, player.stats?.maxHp ?? null, base.maxHp),
    },
  };
}

/** The player with these corrections, or none when they are empty. */
function withAdjustments(player: Character, adj: StatAdjustments): Character {
  const { statAdjustments: _old, ...rest } = player;
  return hasAdjustments(adj) ? { ...rest, statAdjustments: adj } : rest;
}

/** Only the ability, save and skill corrections. */
function sheetPart(adj: StatAdjustments | undefined): StatAdjustments {
  if (!adj) return {};
  const { abilities, saves, skills } = adj;
  return {
    ...(abilities ? { abilities } : {}),
    ...(saves ? { saves } : {}),
    ...(skills ? { skills } : {}),
  };
}

/** Only the combat corrections. */
function combatPart(adj: StatAdjustments | undefined): StatAdjustments {
  if (!adj) return {};
  const { abilities: _a, saves: _s, skills: _k, ...combat } = adj;
  return combat;
}

export const hasCombatAdjustments = (adj: StatAdjustments | undefined) => hasAdjustments(combatPart(adj));
export const hasSheetAdjustments = (adj: StatAdjustments | undefined) => hasAdjustments(sheetPart(adj));

/** Ability scores, save proficiencies and skill training, as on the player's sheet. */
export interface AbilityValues {
  scores: Record<Ability, number>;
  saves: Record<Ability, boolean>;
  skills: Record<SkillId, SkillTier>;
}

const tierOf = (skill: { proficient: boolean; expertise: boolean }): SkillTier =>
  skill.expertise ? "expertise" : skill.proficient ? "proficient" : "none";

/** The corrections the rules engine builds the sheet with. */
export function sheetOverridesOf(adj: StatAdjustments | undefined): SheetOverrides {
  return sheetPart(adj);
}

/** The values to start the ability form from (corrections included). */
export function abilityValuesOf(sheet: CharacterSheet): AbilityValues {
  return {
    scores: Object.fromEntries(ABILITIES.map((a) => [a, sheet.abilities[a].score])) as Record<Ability, number>,
    saves: Object.fromEntries(ABILITIES.map((a) => [a, sheet.abilities[a].proficientSave])) as Record<Ability, boolean>,
    skills: Object.fromEntries(sheet.skills.map((k) => [k.id, tierOf(k)])) as Record<SkillId, SkillTier>,
  };
}

/** The player with new ability, save and skill corrections, and everything
    that follows from them recomputed by the rules: HP, AC, initiative,
    attacks, spell DC... The combat corrections stay on top (a +1 shield
    still adds 1 to the new AC). */
function withSheetPart(player: Character, part: StatAdjustments): CorrectResult {
  const sheet = sheetWith(player, part);
  if (!sheet) return { ok: false, message: "Esta ficha no tiene atributos calculados para corregir." };
  const combat = combatPart(player.statAdjustments);
  const stats = applyAdjustments(statsFromSheet(sheet), combat);
  return {
    ok: true,
    player: {
      ...withAdjustments(player, { ...combat, ...part }),
      stats,
      currentHp: followMax(player.currentHp, player.stats?.maxHp ?? null, stats.maxHp),
    },
  };
}

/** The player copies their sheet's ability scores, saves and skill training.
    Kept as corrections of the sheet their choices build (scores as
    differences); only for characters with rules choices. */
export function correctAbilities(player: Character, values: AbilityValues): CorrectResult {
  const base = sheetWith(player, {});
  if (!base) return { ok: false, message: "Esta ficha no tiene atributos calculados para corregir." };
  for (const a of ABILITIES) {
    const score = values.scores[a];
    if (!Number.isInteger(score) || score < 1 || score > 30) {
      return { ok: false, message: "Las puntuaciones van de 1 a 30, en números enteros." };
    }
  }
  const abilities: NonNullable<StatAdjustments["abilities"]> = {};
  const saves: NonNullable<StatAdjustments["saves"]> = {};
  const skills: NonNullable<StatAdjustments["skills"]> = {};
  for (const a of ABILITIES) {
    const x = base.abilities[a];
    if (values.scores[a] !== x.score) abilities[a] = values.scores[a] - x.score;
    if (values.saves[a] !== x.proficientSave) saves[a] = values.saves[a];
  }
  for (const k of base.skills) {
    const tier = values.skills[k.id];
    if (tier !== undefined && tier !== tierOf(k)) skills[k.id] = tier;
  }
  return withSheetPart(player, {
    ...(Object.keys(abilities).length > 0 ? { abilities } : {}),
    ...(Object.keys(saves).length > 0 ? { saves } : {}),
    ...(Object.keys(skills).length > 0 ? { skills } : {}),
  });
}

/** Drops the ability, save and skill corrections (the combat ones stay). */
export function resetAbilities(player: Character): Character {
  const result = withSheetPart(player, {});
  return result.ok ? result.player : player;
}

/** The values to start the correction form from. */
export function statValuesOf(stats: CharacterStats): StatValues {
  return {
    maxHp: stats.maxHp,
    armorClass: stats.armorClass,
    initiative: stats.initiative,
    speed: stats.speed,
    spellSaveDc: stats.spellSaveDc,
    spellAttackBonus: stats.spellAttackBonus,
    attacks: stats.attacks.map((a) => ({ ...a })),
  };
}
