import { BACKGROUNDS_DATA } from "./data/backgrounds";
import { ARMOR as ARMOR_DATA, WEAPONS as WEAPONS_DATA, findItem } from "./data/equipment";
import type { ArmorData, WeaponData } from "./data/equipment";
import { FEATS_DATA } from "./data/feats";
import { SPECIES_DATA } from "./data/species";
import type { BackgroundData, FeatData, SpeciesData } from "./types";

export * from "./types";
export { findItem };
export type { ArmorData, WeaponData };

export const SPECIES: SpeciesData[] = SPECIES_DATA;
export const BACKGROUNDS: BackgroundData[] = BACKGROUNDS_DATA;
export const FEATS: FeatData[] = FEATS_DATA;
export const WEAPONS: WeaponData[] = WEAPONS_DATA;
export const ARMOR: ArmorData[] = ARMOR_DATA;

/** Class data is only loaded up to this level (see the phase 1 design). */
export const LOADED_MAX_LEVEL = 4;

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

/** Accepts the id ("elf") or the Spanish name ("Elfo"), ignoring case, because
    the LLM and the player write species by name. */
export function findSpecies(idOrName: string): SpeciesData | undefined {
  const key = idOrName.trim().toLowerCase();
  return SPECIES.find((s) => s.id === key || s.name.toLowerCase() === key);
}

export function findBackground(id: string): BackgroundData | undefined {
  return BACKGROUNDS.find((b) => b.id === id);
}

export function findFeat(id: string): FeatData | undefined {
  return FEATS.find((f) => f.id === id);
}
