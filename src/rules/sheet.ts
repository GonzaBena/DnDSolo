import { armorClass } from "./armorClass";
import type { CharacterChoices } from "./buildSheet";
import {
  ABILITY_INCREASE_CHOICES, activeChoices, isExpertise, isFeatChoice, isInvocationChoice, isSpellChoice,
  isWeaponMasteryChoice, requiredChoices,
} from "./choices";
import { CLASSES_DATA, SPECIES, findBackground, findFeat, findItem, findSpell } from "./index";
import type { ArmorData, WeaponData } from "./index";
import { ABILITIES, SKILLS } from "./types";
import type {
  Ability, BackgroundData, CharacterSheet, ChoiceSpec, ClassData, FeatData, LevelRow, Option, SkillId, SpeciesData, Trait,
} from "./types";

type Sheet = CharacterSheet;

/** Everything the calculations share, resolved once from valid choices. */
interface Context {
  c: CharacterChoices;
  species: SpeciesData; cls: ClassData; background: BackgroundData; row: LevelRow;
  /** Active choice specs (conditional ones only when unlocked). */
  specs: ChoiceSpec[];
  hasSubclass: boolean;
  scores: Record<Ability, number>; mods: Record<Ability, number>; prof: number;
  /** Equipment ids and "text:" items from the class and background options, in order. */
  items: string[];
  armor: ArmorData | undefined; shield: boolean;
  feats: FeatData[];
}

const MAX_SCORE = 20;
// Resource names as they appear in the class tables (data/classes).
const MARTIAL_ARTS_DIE = "Dado de artes marciales";
const UNARMORED_MOVEMENT_M = "Movimiento sin armadura (m)";
const JACK_OF_ALL_TRADES = "Aprendiz de mucho";

const modifier = (score: number) => Math.floor((score - 10) / 2);

function armorOf(id: string): ArmorData | undefined {
  const item = findItem(id);
  return item && "baseAc" in item ? item : undefined;
}

function weaponOf(id: string): WeaponData | undefined {
  const item = findItem(id);
  return item && !("baseAc" in item) ? item : undefined;
}

/** Valid, distinct picks of a spec, as options. */
const picked = (spec: ChoiceSpec, picks: Record<string, string[]>): Option[] =>
  [...new Set(picks[spec.id] ?? [])].flatMap((id) => spec.options.find((o) => o.id === id) ?? []);

const pickIds = (ctx: Context, choiceId: string): string[] => ctx.c.picks[choiceId] ?? [];

/** SRD "Ability Scores": background bonus, then feat increases (ASI, Grappler); never above 20. */
function abilityScores(c: CharacterChoices, specs: ChoiceSpec[]): Record<Ability, number> {
  const scores = Object.fromEntries(ABILITIES.map((a) => [a, c.baseScores[a] + (c.backgroundBonus[a] ?? 0)])) as Record<Ability, number>;
  for (const spec of specs.filter((s) => ABILITY_INCREASE_CHOICES.has(s.id))) {
    for (const p of c.picks[spec.id] ?? []) if (ABILITIES.includes(p as Ability)) scores[p as Ability] += 1;
  }
  for (const a of ABILITIES) scores[a] = Math.min(scores[a], MAX_SCORE);
  return scores;
}

/** Feats owned: the background's plus every feat pick (Versatile, fighting style, level 4, Lessons of the First Ones). */
function ownedFeats(background: BackgroundData, specs: ChoiceSpec[], picks: Record<string, string[]>): FeatData[] {
  const ids = [background.featId, ...specs.filter((s) => isFeatChoice(s.id)).flatMap((s) => picks[s.id] ?? [])];
  return ids.flatMap((id) => findFeat(id) ?? []);
}

function context(c: CharacterChoices): Context {
  const species = SPECIES.find((s) => s.id === c.speciesId)!;
  const cls = CLASSES_DATA.find((x) => x.id === c.classId)!;
  const background = findBackground(c.backgroundId)!;
  const row = cls.levels.find((r) => r.level === c.level)!;
  const specs = activeChoices(requiredChoices(c), c.picks);
  const scores = abilityScores(c, specs);
  const items = [...(cls.equipment[c.classEquipment]?.items ?? []), ...background.equipment[c.backgroundEquipment]];
  const armors = items.flatMap((id) => armorOf(id) ?? []);
  return {
    c, species, cls, background, row, specs,
    hasSubclass: c.level >= cls.subclass.level,
    scores, mods: Object.fromEntries(ABILITIES.map((a) => [a, modifier(scores[a])])) as Record<Ability, number>,
    prof: row.proficiencyBonus,
    items,
    armor: armors.find((a) => a.type !== "shield"), // the first armor listed is the one worn
    shield: armors.some((a) => a.type === "shield"),
    feats: ownedFeats(background, specs, c.picks),
  };
}

// ── Hit points ────────────────────────────────────────────────────────────

/** SRD "Level 1 Hit Points by Class" and "Fixed Hit Points by Class": max die at level 1, then die/2 + 1 per level,
    plus the Con modifier each level (minimum 1 per level); plus Dwarven Toughness and Draconic Resilience. */
function hitPoints(ctx: Context): number {
  const { cls, c, mods, species } = ctx;
  let hp = Math.max(1, cls.hitDie + mods.con);
  for (let level = 2; level <= c.level; level++) hp += Math.max(1, cls.hitDie / 2 + 1 + mods.con);
  hp += species.hpBonusPerLevel * c.level;
  if (ctx.hasSubclass) hp += (cls.subclass.hpBonusPerLevel ?? 0) * c.level;
  return hp;
}

// ── Skills ────────────────────────────────────────────────────────────────

function skillProficiencies(ctx: Context): { proficient: Set<SkillId>; expertise: Set<SkillId> } {
  const proficient = new Set<SkillId>([...ctx.background.skills, ...ctx.species.fixedSkills]);
  const expertise = new Set<SkillId>();
  for (const spec of ctx.specs) {
    for (const option of picked(spec, ctx.c.picks)) {
      if (isExpertise(spec.id)) expertise.add(option.id as SkillId);
      else if (option.skill) proficient.add(option.skill);
    }
  }
  return { proficient, expertise };
}

/** Thaumaturge (cleric) and Magician (druid): Wisdom modifier, minimum +1, to two Intelligence skills. */
function orderSkillBonus(ctx: Context, skill: SkillId): number {
  const bonus = Math.max(1, ctx.mods.wis);
  if (pickIds(ctx, "class.cleric.divine_order").includes("thaumaturge") && (skill === "arcana" || skill === "religion")) return bonus;
  if (pickIds(ctx, "class.druid.primal_order").includes("magician") && (skill === "arcana" || skill === "nature")) return bonus;
  return 0;
}

const classFeatures = (ctx: Context): { row: LevelRow; feature: Trait }[] =>
  ctx.cls.levels.filter((r) => r.level <= ctx.c.level).flatMap((row) => row.features.map((feature) => ({ row, feature })));

const subclassFeatures = (ctx: Context): Trait[] =>
  ctx.hasSubclass ? ctx.cls.subclass.features.filter((f) => f.level <= ctx.c.level).map((f) => f.feature) : [];

function skills(ctx: Context): Sheet["skills"] {
  const { proficient, expertise } = skillProficiencies(ctx);
  const jackOfAllTrades = classFeatures(ctx).some(({ feature }) => feature.name === JACK_OF_ALL_TRADES);
  return SKILLS.map((s) => {
    const isProficient = proficient.has(s.id);
    const isExpert = isProficient && expertise.has(s.id);
    const profPart = isExpert ? 2 * ctx.prof : isProficient ? ctx.prof : jackOfAllTrades ? Math.floor(ctx.prof / 2) : 0;
    return {
      id: s.id, name: s.name, proficient: isProficient, expertise: isExpert,
      bonus: ctx.mods[s.ability] + profPart + orderSkillBonus(ctx, s.id),
    };
  });
}

// ── Proficiencies ─────────────────────────────────────────────────────────

const MARTIAL_WEAPONS = "Armas marciales";

/** Protector (cleric) and Warden (druid) add martial weapons and heavier armor. */
function armorAndWeapons(ctx: Context): { armor: string[]; weapons: string[] } {
  const armor = [...ctx.cls.armor];
  const weapons = [...ctx.cls.weapons];
  const add = (list: string[], item: string) => { if (!list.includes(item)) list.push(item); };
  if (pickIds(ctx, "class.cleric.divine_order").includes("protector")) {
    add(armor, "Armaduras pesadas");
    add(weapons, MARTIAL_WEAPONS);
  }
  if (pickIds(ctx, "class.druid.primal_order").includes("warden")) {
    add(armor, "Armaduras medias");
    add(weapons, MARTIAL_WEAPONS);
  }
  return { armor, weapons };
}

/** Tool proficiencies: fixed ones, and the picks of tool choices in place of the "a elección" text. */
function tools(ctx: Context): string[] {
  const fixed = [...ctx.cls.tools, ctx.background.tool].filter((t) => !t.includes("a elección"));
  const chosen = ctx.specs.filter((s) => /\.(tool|instruments)$/.test(s.id)).flatMap((s) => picked(s, ctx.c.picks).map((o) => o.name));
  return [...new Set([...fixed, ...chosen])];
}

const isLight = (w: WeaponData) => w.properties.some((p) => /^Liger[ao]$/.test(p));

/** Weapon proficiency entries of the class data, as rules. */
const WEAPON_PROFICIENCY_RULES: Record<string, (w: WeaponData) => boolean> = {
  "Armas sencillas": (w) => w.category === "simple",
  [MARTIAL_WEAPONS]: (w) => w.category === "martial",
  "Armas marciales con la propiedad ligera": (w) => w.category === "martial" && isLight(w),
  "Armas marciales con las propiedades ligera o sutil": (w) => w.category === "martial" && (isLight(w) || w.finesse),
};

/** Whether a list of weapon proficiencies (as in ClassData.weapons) covers the weapon. Throws on unknown entries. */
export function isWeaponProficient(weapon: WeaponData, proficiencies: string[]): boolean {
  return proficiencies.some((p) => {
    const rule = WEAPON_PROFICIENCY_RULES[p];
    if (!rule) throw new Error(`Competencia con armas desconocida: "${p}"`);
    return rule(weapon);
  });
}

// ── Equipment, armor class, speed ─────────────────────────────────────────

const itemName = (item: string) => (item.startsWith("text:") ? item.slice(5) : findItem(item)?.name ?? item);

/** Item names in order, repeated items once with their count: "Jabalina (8)". */
function equipment(ctx: Context): string[] {
  const counts = new Map<string, number>();
  for (const item of ctx.items) counts.set(itemName(item), (counts.get(itemName(item)) ?? 0) + 1);
  return [...counts].map(([name, n]) => (n > 1 ? `${name} (${n})` : name));
}

const unarmored = (ctx: Context) => !ctx.armor && !ctx.shield;

function computeArmorClass(ctx: Context): number {
  const subclassDefense = ctx.hasSubclass ? ctx.cls.subclass.unarmoredDefense ?? null : null;
  return armorClass({
    mods: ctx.mods,
    armorId: ctx.armor?.id ?? null,
    shield: ctx.shield,
    unarmoredDefense: ctx.cls.unarmoredDefense ?? subclassDefense,
    defenseStyle: ctx.feats.some((f) => f.id === "defense"),
  });
}

/** Species speed (or the lineage's, e.g. Wood Elf 35 ft) plus the monk's Unarmored Movement, in feet. */
function speed(ctx: Context): number {
  const lineage = ctx.specs.filter((s) => s.id.startsWith("species.")).flatMap((s) => picked(s, ctx.c.picks));
  const base = lineage.find((o) => o.speed !== undefined)?.speed ?? ctx.species.speed;
  const metres = ctx.row.resources[UNARMORED_MOVEMENT_M] ?? 0;
  // The class table gives metres (3 m = 10 ft, as the Spanish SRD converts 1.5 m per 5 ft).
  return base + (unarmored(ctx) ? Math.round((metres * 10) / 3) : 0);
}

// ── Attacks ───────────────────────────────────────────────────────────────

const formatDamage = (dice: string, mod: number) => (mod === 0 ? dice : `${dice}${mod > 0 ? "+" : ""}${mod}`);

/** Average of "XdY" (or a flat number such as the blowgun's "1"). */
function average(dice: string): number {
  const m = /^(\d+)d(\d+)$/.exec(dice);
  return m ? (Number(m[1]) * (Number(m[2]) + 1)) / 2 : Number(dice);
}

/** SRD "Character Creation" (Attacks): Str for melee, Dex for ranged, the better one with Finesse; proficiency only
    with proficient weapons. Monks use Dex and the Martial Arts die with Monk weapons while unarmored; Archery adds 2. */
function attacks(ctx: Context, weaponProficiencies: string[]): Sheet["attacks"] {
  const { mods, prof } = ctx;
  const masteries = new Set(ctx.specs.filter((s) => isWeaponMasteryChoice(s.id)).flatMap((s) => ctx.c.picks[s.id] ?? []));
  const archery = ctx.feats.some((f) => f.id === "archery");
  const martialDie = ctx.row.resources[MARTIAL_ARTS_DIE];
  const martialArts = martialDie !== undefined && unarmored(ctx);
  const isMonkWeapon = (w: WeaponData) => !w.ranged && (w.category === "simple" || isLight(w));

  const weapons = [...new Set(ctx.items)].flatMap((id) => weaponOf(id) ?? []);
  const result: Sheet["attacks"] = weapons.map((w) => {
    const monk = martialArts && isMonkWeapon(w);
    const mod = w.ranged ? mods.dex : w.finesse || monk ? Math.max(mods.str, mods.dex) : mods.str;
    const proficient = isWeaponProficient(w, weaponProficiencies);
    const dice = monk && average(`1d${martialDie}`) > average(w.damage) ? `1d${martialDie}` : w.damage;
    return {
      name: w.name,
      attackBonus: mod + (proficient ? prof : 0) + (archery && w.ranged ? 2 : 0),
      damage: formatDamage(dice, mod),
      mastery: masteries.has(w.id) ? w.mastery : null,
    };
  });
  if (martialArts) {
    const mod = Math.max(mods.str, mods.dex);
    result.push({ name: "Ataque sin armas", attackBonus: mod + prof, damage: formatDamage(`1d${martialDie}`, mod), mastery: null });
  }
  return result;
}

// ── Features ──────────────────────────────────────────────────────────────

/** Choices whose picks are features in their own right (beyond feats). */
const isFeatureChoice = (id: string) =>
  isInvocationChoice(id) || /\.(metamagic|divine_order|primal_order|lineage|legacy|ancestry|giant_ancestry|land_type)$/.test(id);

function features(ctx: Context): Sheet["features"] {
  const { species, cls, background } = ctx;
  const out: Sheet["features"] = [
    ...species.traits.map((t) => ({ source: species.name, name: t.name, summary: t.summary })),
    ...classFeatures(ctx).map(({ row, feature }) => ({ source: `${cls.name} ${row.level}`, name: feature.name, summary: feature.summary })),
    ...subclassFeatures(ctx).map((t) => ({ source: cls.subclass.name, name: t.name, summary: t.summary })),
  ];
  const backgroundFeat = findFeat(background.featId);
  if (backgroundFeat) out.push({ source: `Trasfondo ${background.name}`, name: backgroundFeat.name, summary: backgroundFeat.summary });
  for (const spec of ctx.specs.filter((s) => isFeatChoice(s.id) || isFeatureChoice(s.id))) {
    for (const option of picked(spec, ctx.c.picks)) {
      const feat = isFeatChoice(spec.id) ? findFeat(option.id) : undefined;
      out.push({ source: spec.label, name: feat?.name ?? option.name, summary: feat?.summary ?? option.summary });
    }
  }
  return out;
}

// ── Spellcasting ──────────────────────────────────────────────────────────

const spellName = (id: string) => findSpell(id)?.name ?? id;

/** Spells from outside the class spell choices: species, feats, invocations, extra cantrips, always-prepared spells. */
function otherSpellIds(ctx: Context): string[] {
  const { c, cls, species } = ctx;
  const own = new Set([`class.${cls.id}.cantrips`, `class.${cls.id}.prepared`]);
  const ids: string[] = (species.spells ?? []).filter((g) => g.fromLevel <= c.level).map((g) => g.spellId);
  for (const spec of ctx.specs) {
    for (const option of picked(spec, c.picks)) {
      for (const g of option.spells ?? []) if (g.fromLevel <= c.level) ids.push(g.spellId);
    }
    if (isSpellChoice(spec.id) && !own.has(spec.id)) ids.push(...(c.picks[spec.id] ?? []));
  }
  const traits = [...classFeatures(ctx).map((f) => f.feature), ...subclassFeatures(ctx)];
  ids.push(...traits.flatMap((t) => t.spells ?? []));
  return [...new Set(ids)];
}

/** The ability of species or feat spells for a character without class spellcasting. */
function nonClassAbility(ctx: Context): Ability {
  const spec = ctx.specs.find((s) => /^species\.\w+\.spell_ability$|^feat\.magic_initiate_\w+\.ability$/.test(s.id));
  const pick = spec ? ctx.c.picks[spec.id]?.[0] : undefined;
  if (pick && ABILITIES.includes(pick as Ability)) return pick as Ability;
  // Unreachable with valid choices (every spell source asks for its ability); use the best mental ability.
  return (["int", "wis", "cha"] as const).reduce((best, a) => (ctx.mods[a] > ctx.mods[best] ? a : best));
}

function spellcasting(ctx: Context): Sheet["spellcasting"] {
  const { cls, row, c } = ctx;
  const names = (ids: string[]) => ids.map(spellName);
  const cantrips = c.picks[`class.${cls.id}.cantrips`] ?? [];
  const prepared = c.picks[`class.${cls.id}.prepared`] ?? [];
  const classIds = new Set([...cantrips, ...prepared]);
  const other = otherSpellIds(ctx).filter((id) => !classIds.has(id));
  if (!cls.spellcasting && other.length === 0) return null;

  const ability = cls.spellcasting?.ability ?? nonClassAbility(ctx);
  return {
    ability,
    saveDc: 8 + ctx.prof + ctx.mods[ability],
    attackBonus: ctx.prof + ctx.mods[ability],
    slots: row.slots ?? [],
    pactSlots: row.pactSlots ?? null,
    cantrips: names(cantrips),
    prepared: names(prepared),
    spellbook: cls.id === "wizard" ? names(c.picks["class.wizard.spellbook"] ?? []) : null,
    other: names(other),
  };
}

// ── Sheet ─────────────────────────────────────────────────────────────────

/** Computes every number of the sheet from choices that already passed validateChoices. */
export function computeSheet(c: CharacterChoices): CharacterSheet {
  const ctx = context(c);
  const { cls, mods, prof } = ctx;
  const sheetSkills = skills(ctx);
  const { armor, weapons } = armorAndWeapons(ctx);
  const perception = sheetSkills.find((s) => s.id === "perception")!;
  return {
    species: ctx.species.name,
    className: cls.name,
    subclass: ctx.hasSubclass ? cls.subclass.name : null,
    level: c.level,
    background: ctx.background.name,
    abilities: Object.fromEntries(ABILITIES.map((a) => {
      const proficientSave = cls.saves.includes(a);
      return [a, { score: ctx.scores[a], modifier: mods[a], save: mods[a] + (proficientSave ? prof : 0), proficientSave }];
    })) as Sheet["abilities"],
    proficiencyBonus: prof,
    hitPoints: hitPoints(ctx),
    hitDice: `${c.level}d${cls.hitDie}`,
    armorClass: computeArmorClass(ctx),
    initiative: mods.dex + (ctx.feats.some((f) => f.initiativeAddsProficiency) ? prof : 0),
    speed: speed(ctx),
    passivePerception: 10 + perception.bonus,
    skills: sheetSkills,
    proficiencies: { armor, weapons, tools: tools(ctx) },
    attacks: attacks(ctx, weapons),
    features: features(ctx),
    spellcasting: spellcasting(ctx),
    equipment: equipment(ctx),
    gold: (cls.equipment[c.classEquipment]?.gold ?? 0) + ctx.background.gold[c.backgroundEquipment],
  };
}
