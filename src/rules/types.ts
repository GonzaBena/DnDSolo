export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
export const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

export const ABILITY_NAMES: Record<Ability, string> = {
  str: "Fuerza", dex: "Destreza", con: "Constitución", int: "Inteligencia", wis: "Sabiduría", cha: "Carisma",
};

export type SkillId =
  | "acrobatics" | "animal_handling" | "arcana" | "athletics" | "deception"
  | "history" | "insight" | "intimidation" | "investigation" | "medicine" | "nature"
  | "perception" | "performance" | "persuasion" | "religion" | "sleight_of_hand"
  | "stealth" | "survival";

/** Names follow the official Spanish SRD 5.2. */
export const SKILLS: { id: SkillId; name: string; ability: Ability }[] = [
  { id: "acrobatics", name: "Acrobacias", ability: "dex" },
  { id: "animal_handling", name: "Trato con animales", ability: "wis" },
  { id: "arcana", name: "Conocimiento arcano", ability: "int" },
  { id: "athletics", name: "Atletismo", ability: "str" },
  { id: "deception", name: "Engaño", ability: "cha" },
  { id: "history", name: "Historia", ability: "int" },
  { id: "insight", name: "Perspicacia", ability: "wis" },
  { id: "intimidation", name: "Intimidación", ability: "cha" },
  { id: "investigation", name: "Investigación", ability: "int" },
  { id: "medicine", name: "Medicina", ability: "wis" },
  { id: "nature", name: "Naturaleza", ability: "int" },
  { id: "perception", name: "Percepción", ability: "wis" },
  { id: "performance", name: "Interpretación", ability: "cha" },
  { id: "persuasion", name: "Persuasión", ability: "cha" },
  { id: "religion", name: "Religión", ability: "int" },
  { id: "sleight_of_hand", name: "Juego de manos", ability: "dex" },
  { id: "stealth", name: "Sigilo", ability: "dex" },
  { id: "survival", name: "Supervivencia", ability: "wis" },
];

export interface Trait {
  name: string; summary: string;
  /** Spell ids always prepared from when the feature is gained (e.g. Druidic: Speak with Animals). */
  spells?: string[];
}

export interface Option {
  id: string; name: string; summary: string;
  /** Spells this option grants, from the character level given. */
  spells?: { fromLevel: number; spellId: string }[];
  /** Skill proficiency it grants (e.g. Keen Senses). */
  skill?: SkillId;
  /** Walking speed in feet it sets (e.g. Wood Elf: 35). */
  speed?: number;
  /** Can be picked more than once, even across choices (SRD "Repetible", e.g. Agonizing Blast). */
  repeatable?: boolean;
}

/** A pick that unlocks a choice. A list of them means any one is enough (several sources can grant it). */
export interface Requirement { choiceId: string; optionId: string }

export const requirementsOf = (spec: ChoiceSpec): Requirement[] =>
  spec.requires === undefined ? [] : Array.isArray(spec.requires) ? spec.requires : [spec.requires];

export interface ChoiceSpec {
  /** Namespaced: "species.elf.lineage", "class.fighter.fighting_style", "feat.skilled.skills" */
  id: string; label: string; count: number; options: Option[];
  allowRepeat?: boolean;
  /** Only active when that pick was made. */
  requires?: Requirement | Requirement[];
}

export interface SpeciesData {
  id: string; name: string; source: "SRD 5.2";
  speed: number; size: string; traits: Trait[];
  hpBonusPerLevel: number;          // 1 for dwarf, 0 otherwise
  fixedSkills: SkillId[];
  /** Spells every member of the species knows, whatever the lineage (e.g. the tiefling's Thaumaturgy). */
  spells?: { fromLevel: number; spellId: string }[];
  choices: ChoiceSpec[];            // lineage/legacy/ancestry, human skill & origin feat
}

export interface BackgroundData {
  id: string; name: string; source: "SRD 5.2";
  abilities: [Ability, Ability, Ability];
  featId: string; skills: [SkillId, SkillId]; tool: string;
  /** Items are ids known to findItem, or free text prefixed with "text:" (as in ClassData). B is the gold option. */
  equipment: { A: string[]; B: string[] };
  gold: { A: number; B: number };
  choices: ChoiceSpec[];            // e.g. the soldier's gaming set
}

export interface FeatData {
  id: string; name: string; source: "SRD 5.2";
  category: "origin" | "general" | "fighting_style";
  summary: string;
  prerequisite?: { minLevel?: number; anyAbility?: { abilities: Ability[]; min: number } };
  choices: ChoiceSpec[];            // e.g. Skilled: 3 skills; Magic Initiate: cantrips + spell; ASI: 2 abilities allowRepeat
  initiativeAddsProficiency?: boolean; // Alert
  /** SRD "Repetible": can be taken more than once (feats are taken once otherwise). */
  repeatable?: boolean;
}

export interface LevelRow {
  level: number; proficiencyBonus: number; features: Trait[];
  /** Class resources by name, e.g. { "Furias": 2 } */
  resources: Record<string, number>;
  cantrips?: number; preparedSpells?: number; slots?: number[];   // slots[0] = 1st level
  pactSlots?: { count: number; slotLevel: number };
  /** Choices gained at this level, e.g. fighting style at 1, ASI feat at 4. */
  choices: ChoiceSpec[];
}

export interface ClassData {
  id: string; name: string; source: "SRD 5.2";
  hitDie: 6 | 8 | 10 | 12; primaryAbility: Ability[]; saves: [Ability, Ability];
  skillChoice: { count: number; options: SkillId[] };
  armor: string[]; weapons: string[]; tools: string[];
  weaponMasteryCount: number;              // 0 if none
  /** Items are ids known to findItem, or free text prefixed with "text:". */
  equipment: Record<"A" | "B" | "C", { items: string[]; gold: number } | undefined>;
  spellcasting: { ability: Ability; spellList: string } | null;
  unarmoredDefense: "barbarian" | "monk" | null;
  levels: LevelRow[];                      // rows 1..LOADED_MAX_LEVEL
  subclass: {
    id: string; name: string; level: number;
    features: { level: number; feature: Trait; choices?: ChoiceSpec[] }[];
    unarmoredDefense?: "draconic";
    /** Hit points per character level once the subclass is gained (Draconic Resilience: 3 at level 3, +1 per level). */
    hpBonusPerLevel?: number;
  };
}

/** The computed character sheet. Every number comes from code; names are in Spanish; speed is in feet. */
export interface CharacterSheet {
  species: string; className: string; subclass: string | null; level: number; background: string;
  abilities: Record<Ability, { score: number; modifier: number; save: number; proficientSave: boolean }>;
  proficiencyBonus: number; hitPoints: number; hitDice: string; armorClass: number;
  initiative: number; speed: number; passivePerception: number;
  skills: { id: SkillId; name: string; bonus: number; proficient: boolean; expertise: boolean }[];
  proficiencies: { armor: string[]; weapons: string[]; tools: string[] };
  /** Common first, then the picked and class languages. */
  languages: string[];
  /** Every weapon mastery picked, whether or not the weapon is in the equipment. */
  masteries: { weapon: string; mastery: string }[];
  attacks: { name: string; attackBonus: number; damage: string; mastery: string | null }[];
  features: { source: string; name: string; summary: string }[];
  spellcasting: null | {
    ability: Ability; saveDc: number; attackBonus: number; slots: number[];
    pactSlots: { count: number; slotLevel: number } | null;
    cantrips: string[]; prepared: string[]; spellbook: string[] | null; other: string[];
  };
  equipment: string[]; gold: number;
}
