import { armorClass } from "./armorClass";
import type { CharacterChoices } from "./buildSheet";
import {
  ABILITY_INCREASE_CHOICES, activeChoices, isExpertise, isFeatChoice, isInvocationCantripChoice, isInvocationChoice, isSpellChoice,
  isWeaponMasteryChoice, requiredChoices,
} from "./choices";
import { LANGUAGES } from "./data/classes/common";
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
// Names the sheet looks up in the class data (resources of the class tables and a feature name).
// A data test checks they exist, so a rename cannot silently turn an effect off.
const MARTIAL_ARTS_DIE = "Dado de artes marciales";
const UNARMORED_MOVEMENT_M = "Movimiento sin armadura (m)";
const JACK_OF_ALL_TRADES = "Aprendiz de mucho";
/** Languages a class feature teaches at level 1 (Thieves' Cant, Druidic), by language id. */
const CLASS_LANGUAGES: Record<string, { feature: string; language: string }> = {
  rogue: { feature: "Jerga de ladrones", language: "thieves_cant" },
  druid: { feature: "Druídico", language: "druidic" },
};
/** Equipment text that stands for the pick of a choice (the soldier's gaming set, the monk's tool). */
const ITEM_FROM_PICK: Record<string, string> = {
  "text:Juego (el mismo de la competencia)": "background.soldier.tool",
  "text:Herramientas de artesano o instrumento musical elegido": "class.monk.tool",
};
export const SHEET_HOOKS = {
  resources: { monk: [MARTIAL_ARTS_DIE, UNARMORED_MOVEMENT_M] },
  features: {
    bard: [JACK_OF_ALL_TRADES],
    ...Object.fromEntries(Object.entries(CLASS_LANGUAGES).map(([classId, l]) => [classId, [l.feature]])),
  } as Record<string, string[]>,
  /** Equipment texts the sheet replaces with a pick, and the choice whose pick replaces them. */
  itemsFromPicks: ITEM_FROM_PICK,
  /** Option ids of the cleric and druid orders whose effects the sheet applies. */
  options: {
    "class.cleric.divine_order": ["protector", "thaumaturge"],
    "class.druid.primal_order": ["magician", "warden"],
  },
} as const;

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

/** Spell ids a class (and its subclass, once gained) always has prepared at a level, from Trait.spells. */
export function alwaysPreparedSpells(cls: ClassData, level: number): string[] {
  const traits = [
    ...cls.levels.filter((r) => r.level <= level).flatMap((r) => r.features),
    ...(level >= cls.subclass.level ? cls.subclass.features.filter((f) => f.level <= level).map((f) => f.feature) : []),
  ];
  return traits.flatMap((t) => t.spells ?? []);
}

const classFeatures = (ctx: Context): { row: LevelRow; feature: Trait }[] =>
  ctx.cls.levels.filter((r) => r.level <= ctx.c.level).flatMap((row) => row.features.map((feature) => ({ row, feature })));

const subclassFeatures = (ctx: Context): Trait[] =>
  ctx.hasSubclass ? ctx.cls.subclass.features.filter((f) => f.level <= ctx.c.level).map((f) => f.feature) : [];

function skills(ctx: Context): Sheet["skills"] {
  const { proficient, expertise } = skillProficiencies(ctx);
  const jackOfAllTrades = classFeatures(ctx).some(({ feature }) => feature.name === JACK_OF_ALL_TRADES);
  const byName = [...SKILLS].sort((a, b) => a.name.localeCompare(b.name, "es"));
  return byName.map((s) => {
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

const languageName = (id: string) => LANGUAGES.find((l) => l.id === id)?.name ?? id;

/** Common, the origin languages, the class's own language and the other language picks (rogue, ranger). */
function languages(ctx: Context): string[] {
  const picks = (origin: boolean) => ctx.specs
    .filter((s) => /\.languages?$/.test(s.id) && (s.id === "origin.languages") === origin)
    .flatMap((s) => picked(s, ctx.c.picks).map((o) => o.name));
  const own = CLASS_LANGUAGES[ctx.cls.id];
  return [...new Set(["Común", ...picks(true), ...(own ? [languageName(own.language)] : []), ...picks(false)])];
}

/** Each weapon mastery picked, in pick order. */
function masteries(ctx: Context): Sheet["masteries"] {
  const ids = new Set(ctx.specs.filter((s) => isWeaponMasteryChoice(s.id)).flatMap((s) => ctx.c.picks[s.id] ?? []));
  return [...ids].flatMap((id) => {
    const w = weaponOf(id);
    return w ? [{ weapon: w.name, mastery: w.mastery }] : [];
  });
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

/** The item's name, or the picked option's name when the item stands for a pick (e.g. the soldier's gaming set). */
function equipmentName(ctx: Context, item: string): string {
  const choiceId = ITEM_FROM_PICK[item];
  const spec = choiceId ? ctx.specs.find((s) => s.id === choiceId) : undefined;
  return (spec && picked(spec, ctx.c.picks)[0]?.name) ?? itemName(item);
}

/** Item names in order, repeated items once with their count: "Jabalina (8)". */
function equipment(ctx: Context): string[] {
  const counts = new Map<string, number>();
  for (const name of ctx.items.map((item) => equipmentName(ctx, item))) counts.set(name, (counts.get(name) ?? 0) + 1);
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

/** Species speed (or the lineage's, e.g. Wood Elf 35 ft) plus the monk's Unarmored Movement, minus 10 ft in armor
    whose Strength requirement the wearer does not meet (SRD "Armor" table, Strength column), in feet. */
function speed(ctx: Context): number {
  const lineage = ctx.specs.filter((s) => s.id.startsWith("species.")).flatMap((s) => picked(s, ctx.c.picks));
  const base = lineage.find((o) => o.speed !== undefined)?.speed ?? ctx.species.speed;
  const metres = ctx.row.resources[UNARMORED_MOVEMENT_M] ?? 0;
  // The class table gives metres (3 m = 10 ft, as the Spanish SRD converts 1.5 m per 5 ft).
  const heavy = ctx.armor?.strength !== undefined && ctx.scores.str < ctx.armor.strength ? 10 : 0;
  return base + (unarmored(ctx) ? Math.round((metres * 10) / 3) : 0) - heavy;
}

// ── Attacks ───────────────────────────────────────────────────────────────

const formatDamage = (dice: string, mod: number) => (mod === 0 ? dice : `${dice}${mod > 0 ? "+" : ""}${mod}`);

/** Finesse lets the wielder pick Str or Dex (even for a ranged weapon like the Dart); otherwise Dex for ranged
    weapons and Str for melee ones. */
export function weaponAbilityModifier(w: WeaponData, mods: Record<Ability, number>): number {
  if (w.finesse) return Math.max(mods.str, mods.dex);
  return w.ranged ? mods.dex : mods.str;
}

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
    const mod = monk ? Math.max(mods.str, mods.dex) : weaponAbilityModifier(w, mods);
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
  isInvocationChoice(id) || isInvocationCantripChoice(id) ||
  /\.(metamagic|divine_order|primal_order|lineage|legacy|ancestry|giant_ancestry|land_type|hunters_prey)$/.test(id);

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

const saveDc = (ctx: Context, ability: Ability) => 8 + ctx.prof + ctx.mods[ability];
const spellAttack = (ctx: Context, ability: Ability) => ctx.prof + ctx.mods[ability];

/** The ability picked in a "spellcasting ability" choice (species lineage, Magic Initiate). */
function pickedAbility(ctx: Context, choiceId: string): Ability {
  const pick = ctx.c.picks[choiceId]?.[0];
  if (pick && ABILITIES.includes(pick as Ability)) return pick as Ability;
  // Unreachable with valid choices (every spell source asks for its ability); use the best mental ability.
  return (["int", "wis", "cha"] as const).reduce((best, a) => (ctx.mods[a] > ctx.mods[best] ? a : best));
}

/** Where a spell comes from: the species, a feat (by id), or the class (extra cantrips, invocations, Book of
    Shadows, subclass options, always-prepared spells), which casts with the class ability. */
type SpellSource = { kind: "species" } | { kind: "feat"; featId: string } | { kind: "class" };

function sourceOf(choiceId: string): SpellSource {
  if (choiceId.startsWith("species.")) return { kind: "species" };
  const feat = /^feat\.(\w+)\./.exec(choiceId);
  return feat ? { kind: "feat", featId: feat[1]! } : { kind: "class" };
}

/** Spells outside the class spell choices, grouped by source; each group casts with its own ability. */
function otherSpells(ctx: Context): Sheet["otherSpells"] {
  const { c, cls, species } = ctx;
  const own = new Set([...(c.picks[`class.${cls.id}.cantrips`] ?? []), ...(c.picks[`class.${cls.id}.prepared`] ?? [])]);
  const ownSpecs = new Set([`class.${cls.id}.cantrips`, `class.${cls.id}.prepared`]);
  const groups = new Map<string, { source: string; ability: Ability; ids: string[] }>();
  const add = (key: string, source: string, ability: Ability, ids: string[]) => {
    const group = groups.get(key) ?? { source, ability, ids: [] };
    groups.set(key, group);
    group.ids.push(...ids);
  };

  const speciesAbility = () => pickedAbility(ctx, `species.${species.id}.spell_ability`);
  // The lineage choice that grants spells names the group (e.g. "Legado infernal"); else the species.
  const lineage = ctx.specs.find((s) => s.id.startsWith("species.") && picked(s, c.picks).some((o) => o.spells));
  const speciesLabel = lineage?.label ?? species.name;
  const speciesWide = (species.spells ?? []).filter((g) => g.fromLevel <= c.level).map((g) => g.spellId);
  if (speciesWide.length > 0) add("species", speciesLabel, speciesAbility(), speciesWide);

  for (const spec of ctx.specs) {
    const ids = picked(spec, c.picks).flatMap((o) => (o.spells ?? []).filter((g) => g.fromLevel <= c.level).map((g) => g.spellId));
    if (isSpellChoice(spec.id) && !ownSpecs.has(spec.id)) ids.push(...(c.picks[spec.id] ?? []));
    if (ids.length === 0) continue;
    const source = sourceOf(spec.id);
    if (source.kind === "species") add("species", speciesLabel, speciesAbility(), ids);
    else if (source.kind === "feat") {
      const featName = findFeat(source.featId)?.name ?? spec.label;
      add(`feat.${source.featId}`, featName, pickedAbility(ctx, `feat.${source.featId}.ability`), ids);
    } else if (cls.spellcasting) add("class", cls.name, cls.spellcasting.ability, ids);
  }
  const always = alwaysPreparedSpells(cls, c.level);
  if (always.length > 0 && cls.spellcasting) add("class", cls.name, cls.spellcasting.ability, always);

  const order = (key: string) => (key === "species" ? 0 : key === "class" ? 2 : 1);
  return [...groups].sort(([a], [b]) => order(a) - order(b)).flatMap(([, g]) => {
    const spells = [...new Set(g.ids)].filter((id) => !own.has(id)).map(spellName);
    return spells.length === 0 ? [] : [{
      source: g.source, ability: g.ability, saveDc: saveDc(ctx, g.ability), attackBonus: spellAttack(ctx, g.ability), spells,
    }];
  });
}

function spellcasting(ctx: Context): Sheet["spellcasting"] {
  const { cls, row, c } = ctx;
  if (!cls.spellcasting) return null;
  const names = (ids: string[]) => ids.map(spellName);
  const { ability } = cls.spellcasting;
  return {
    ability,
    saveDc: saveDc(ctx, ability),
    attackBonus: spellAttack(ctx, ability),
    slots: row.slots ?? [],
    pactSlots: row.pactSlots ?? null,
    cantrips: names(c.picks[`class.${cls.id}.cantrips`] ?? []),
    prepared: names(c.picks[`class.${cls.id}.prepared`] ?? []),
    spellbook: cls.id === "wizard" ? names(c.picks["class.wizard.spellbook"] ?? []) : null,
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
    languages: languages(ctx),
    masteries: masteries(ctx),
    attacks: attacks(ctx, weapons),
    features: features(ctx),
    spellcasting: spellcasting(ctx),
    otherSpells: otherSpells(ctx),
    equipment: equipment(ctx),
    gold: (cls.equipment[c.classEquipment]?.gold ?? 0) + ctx.background.gold[c.backgroundEquipment],
  };
}
