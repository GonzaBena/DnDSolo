import { BACKGROUNDS_DATA } from "./data/backgrounds";
import { CLASSES_DATA as CLASSES_DATA_LIST } from "./data/classes";
import { ARMOR as ARMOR_DATA, WEAPONS as WEAPONS_DATA, findItem } from "./data/equipment";
import type { ArmorData, WeaponData } from "./data/equipment";
import { FEATS_DATA } from "./data/feats";
import { SPECIES_DATA } from "./data/species";
import { SPELLS as SPELLS_DATA, findSpell, spellsFor } from "./data/spells";
import type { SpellData } from "./data/spells";
import type { BackgroundData, ClassData, FeatData, SpeciesData } from "./types";

export * from "./types";
export { findItem, findSpell, spellsFor };
export type { ArmorData, SpellData, WeaponData };

export const SPECIES: SpeciesData[] = SPECIES_DATA;
export const BACKGROUNDS: BackgroundData[] = BACKGROUNDS_DATA;
export const FEATS: FeatData[] = FEATS_DATA;
export const CLASSES_DATA: ClassData[] = CLASSES_DATA_LIST;
export const WEAPONS: WeaponData[] = WEAPONS_DATA;
export const ARMOR: ArmorData[] = ARMOR_DATA;
export const SPELLS: SpellData[] = SPELLS_DATA;

/** Class data is only loaded up to this level (see the phase 1 design). */
export const LOADED_MAX_LEVEL = 10;

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

/** Accepts the id ("elf") or the Spanish name ("Elfo"), ignoring case, because
    the LLM and the player write species by name. */
export function findSpecies(idOrName: string): SpeciesData | undefined {
  const key = idOrName.trim().toLowerCase();
  return SPECIES.find((s) => s.id === key || s.name.toLowerCase() === key);
}

/** Accepts the id ("rogue") or the Spanish name ("Pícaro"), ignoring case. */
export function findClass(idOrName: string): ClassData | undefined {
  const key = idOrName.trim().toLowerCase();
  return CLASSES_DATA.find((c) => c.id === key || c.name.toLowerCase() === key);
}

export function findBackground(id: string): BackgroundData | undefined {
  return BACKGROUNDS.find((b) => b.id === id);
}

export function findFeat(id: string): FeatData | undefined {
  return FEATS.find((f) => f.id === id);
}
