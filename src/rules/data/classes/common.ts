import { SKILLS } from "../../types";
import type { ChoiceSpec, Option, SkillId, Trait } from "../../types";
import { WEAPONS } from "../equipment";
import type { WeaponData } from "../equipment";
import { FEATS_DATA } from "../feats";

export const SOURCE = "SRD 5.2" as const;

/** The "Mejora de característica" class feature (levels 4, 8, 12, 16...). */
export const ASI_TRAIT: Trait = {
  name: "Mejora de característica",
  summary: "Obtenés la dote Mejora de característica u otra dote general para la que cumplas las condiciones.",
};

export const subclassTrait = (className: string, subclassName: string): Trait => ({
  name: `Subclase de ${className}`,
  summary: `Elegís una subclase de ${className} (en el SRD: ${subclassName}) y recibís sus rasgos al alcanzar los niveles indicados.`,
});

export const weaponMasteryTrait = (count: number, scope: string): Trait => ({
  name: "Maestría con armas",
  summary: `Podés usar las propiedades de maestría de ${count} tipos de ${scope}. Tras un descanso largo podés cambiar una de esas elecciones.`,
});

export const skillOptions = (ids: SkillId[]): Option[] =>
  ids.map((id) => {
    const s = SKILLS.find((x) => x.id === id)!;
    return { id, name: s.name, summary: `Competencia en ${s.name}.`, skill: id };
  });

const weaponOptions = (weapons: WeaponData[]): Option[] =>
  weapons.map((w) => ({ id: w.id, name: w.name, summary: `${w.damage} ${w.damageType}; maestría: ${w.mastery}.` }));

/** Weapons a class can pick for Weapon Mastery, from the SRD weapon table. */
export const masteryWeapons = {
  /** Barbarian: simple or martial melee weapons. */
  melee: (): Option[] => weaponOptions(WEAPONS.filter((w) => !w.ranged)),
  /** Fighter, paladin, ranger: any simple or martial weapon. */
  any: (): Option[] => weaponOptions(WEAPONS),
  /** Rogue: simple weapons plus martial ones with Light or Finesse. */
  rogue: (): Option[] =>
    weaponOptions(WEAPONS.filter((w) => w.category === "simple" || w.finesse || w.properties.includes("Ligera"))),
};

export const weaponMasteryChoice = (classId: string, count: number, options: Option[], suffix = ""): ChoiceSpec => ({
  id: `class.${classId}.weapon_mastery${suffix}`,
  label: "Maestría con armas",
  count,
  options,
});

/** Fighting style feats; paladin and ranger add their own alternative option. */
export const fightingStyleChoice = (classId: string, extra: Option[] = []): ChoiceSpec => ({
  id: `class.${classId}.fighting_style`,
  label: "Estilo de combate",
  count: 1,
  options: [
    ...FEATS_DATA.filter((f) => f.category === "fighting_style").map((f) => ({ id: f.id, name: f.name, summary: f.summary })),
    ...extra,
  ],
});

/** Level 4: Ability Score Improvement or another feat the character qualifies for (general and origin feats;
    fighting style feats only for classes with the Fighting Style feature). Prerequisites are checked on validation. */
export const level4FeatChoice = (classId: string, hasFightingStyle = false): ChoiceSpec =>
  asiFeatChoice(classId, 4, hasFightingStyle);

/** The same pick at the later Ability Score Improvement levels (8 for every class, 6 for the fighter, 10 for the
    rogue). The id keeps the level so each one is its own choice: `class.<id>.level<n>_feat`. */
export const asiFeatChoice = (classId: string, level: number, hasFightingStyle = false): ChoiceSpec => ({
  id: `class.${classId}.level${level}_feat`,
  label: `Mejora de característica (nivel ${level})`,
  count: 1,
  options: FEATS_DATA
    .filter((f) => f.category === "general" || f.category === "origin" || (hasFightingStyle && f.category === "fighting_style"))
    .map((f) => ({ id: f.id, name: f.name, summary: f.summary })),
});

/** Expertise: options are every skill; Task 5 validation restricts the picks to skills the character is proficient in. */
export const expertiseChoice = (classId: string, count: number, level?: number): ChoiceSpec => ({
  /** A later Expertise feature (bard 9, rogue 6) is its own choice: `class.<id>.level<n>.expertise`. */
  id: level === undefined ? `class.${classId}.expertise` : `class.${classId}.level${level}.expertise`,
  label: "Pericia",
  count,
  options: SKILLS.map((s) => ({ id: s.id, name: s.name, summary: `Pericia en ${s.name} (doble bonificador por competencia).` })),
});

/** Standard and unusual languages of the SRD (Common is always known). */
export const LANGUAGES: Option[] = [
  ["draconic", "Dracónico"], ["elvish", "Elfo"], ["dwarvish", "Enano"], ["giant", "Gigante"], ["gnomish", "Gnomo"],
  ["goblin", "Goblin"], ["common_sign_language", "Lengua de signos común"], ["halfling", "Mediano"], ["orc", "Orco"],
  ["abyssal", "Abisal"], ["celestial", "Celestial"], ["druidic", "Druídico"], ["deep_speech", "Habla de las profundidades"],
  ["infernal", "Infernal"], ["undercommon", "Infracomún"], ["thieves_cant", "Jerga de ladrones"],
  ["primordial", "Primordial"], ["sylvan", "Silvano"],
].map(([id, name]) => ({ id, name, summary: `Idioma: ${name}.` }));

/** The Standard Languages table without Common, which every character knows. */
export const STANDARD_LANGUAGES: Option[] = LANGUAGES.slice(0, 9);

export const languageChoice =(id: string, count: number, exclude: string[] = []): ChoiceSpec => ({
  id, label: "Idiomas", count, options: LANGUAGES.filter((l) => !exclude.includes(l.id)),
});

const tool = (id: string, name: string): Option => ({ id, name, summary: `Competencia con ${name.toLowerCase()}.` });

// Artisan's tools and musical instruments from the SRD "Herramientas" section.
export const ARTISAN_TOOLS: Option[] = [
  ["masons_tools", "Herramientas de albañil"], ["potters_tools", "Herramientas de alfarero"],
  ["carpenters_tools", "Herramientas de carpintero"], ["cartographers_tools", "Herramientas de cartógrafo"],
  ["leatherworkers_tools", "Herramientas de curtidor"], ["woodcarvers_tools", "Herramientas de ebanista"],
  ["smiths_tools", "Herramientas de herrero"], ["jewelers_tools", "Herramientas de joyero"],
  ["tinkers_tools", "Herramientas de manitas"], ["glassblowers_tools", "Herramientas de soplador de vidrio"],
  ["weavers_tools", "Herramientas de tejedor"], ["cobblers_tools", "Herramientas de zapatero"],
  ["alchemists_supplies", "Suministros de alquimista"], ["brewers_supplies", "Suministros de cervecero"],
  ["calligraphers_supplies", "Suministros de calígrafo"], ["painters_supplies", "Suministros de pintor"],
  ["cooks_utensils", "Útiles de cocinero"],
].map(([id, name]) => tool(id, name));

export const INSTRUMENTS: Option[] = [
  ["shawm", "Chirimía"], ["horn", "Cuerno"], ["dulcimer", "Dulcémele"], ["flute", "Flauta"], ["pan_flute", "Flauta de pan"],
  ["bagpipes", "Gaita"], ["lute", "Laúd"], ["lyre", "Lira"], ["drum", "Tambor"], ["viol", "Viola"],
].map(([id, name]) => tool(id, name));
