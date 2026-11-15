export type Ability = "str" | "dex" | "con" | "int" | "wis" | "cha";
export const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

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

export interface Trait { name: string; summary: string }

export interface Option {
  id: string; name: string; summary: string;
  /** Spells this option grants, from the character level given. */
  spells?: { fromLevel: number; spellId: string }[];
  /** Skill proficiency it grants (e.g. Keen Senses). */
  skill?: SkillId;
}

export interface ChoiceSpec {
  /** Namespaced: "species.elf.lineage", "class.fighter.fighting_style", "feat.skilled.skills" */
  id: string; label: string; count: number; options: Option[];
  allowRepeat?: boolean;
  /** Only active when that pick was made. */
  requires?: { choiceId: string; optionId: string };
}

export interface SpeciesData {
  id: string; name: string; source: "SRD 5.2";
  speed: number; size: string; traits: Trait[];
  hpBonusPerLevel: number;          // 1 for dwarf, 0 otherwise
  fixedSkills: SkillId[];
  choices: ChoiceSpec[];            // lineage/legacy/ancestry, human skill & origin feat
}

export interface BackgroundData {
  id: string; name: string; source: "SRD 5.2";
  abilities: [Ability, Ability, Ability];
  featId: string; skills: [SkillId, SkillId]; tool: string;
  equipment: { A: string[]; B: string[] };  // B is the gold option
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
}
