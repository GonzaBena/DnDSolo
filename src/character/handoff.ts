import { findCampaign } from "../campaigns";
import { z } from "../domain/zod";
import type { CharacterInput } from "../domain/character";
import { findBackground, findClass, findSpecies } from "../rules";

/**
 * Carries a generated character from /generator to the form on /character.
 * It lives in sessionStorage so it survives the page change but not the tab.
 */
export const HANDOFF_KEY = "dnsolo.generatedCharacter";
export const CAMPAIGN_HANDOFF_KEY = "dnsolo.selectedCampaign";

const statsSchema = z.object({
  maxHp: z.number().int().min(1),
  armorClass: z.number().int(),
  initiative: z.number().int(),
  speed: z.number().int(),
  hitDice: z.string(),
  attacks: z.array(z.object({ name: z.string(), attackBonus: z.number().int(), damage: z.string() })),
  spellSaveDc: z.number().int().nullable(),
  spellAttackBonus: z.number().int().nullable(),
});

const abilityScores = z.object({
  str: z.number(), dex: z.number(), con: z.number(), int: z.number(), wis: z.number(), cha: z.number(),
});

const choicesSchema = z.object({
  speciesId: z.string(),
  classId: z.string(),
  backgroundId: z.string(),
  level: z.number().int(),
  baseScores: abilityScores,
  backgroundBonus: abilityScores.partial(),
  classEquipment: z.enum(["A", "B", "C"]),
  backgroundEquipment: z.enum(["A", "B"]),
  picks: z.record(z.string(), z.array(z.string())),
});

const handoffSchema = z.object({
  name: z.string(),
  speciesId: z.string().refine((id) => findSpecies(id) !== undefined),
  classId: z.string().refine((id) => findClass(id) !== undefined),
  subclassId: z.string().nullable(),
  srdBackgroundId: z
    .string()
    .refine((id) => findBackground(id) !== undefined)
    .nullable(),
  level: z.number().int().min(1).max(20),
  background: z.string(),
  stats: statsSchema.nullable().optional(),
  choices: choicesSchema.optional(),
  startingInventory: z.array(z.object({ name: z.string().min(1), quantity: z.number().int().min(1) })).optional(),
  campaignId: z
    .string()
    .refine((id) => findCampaign(id) !== undefined)
    .nullable()
    .optional(),
});

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Remembers which official campaign (if any) was picked when moving between /character and /generator. */
export function stashCampaignId(storage: StorageLike, campaignId: string | null): boolean {
  try {
    if (campaignId && findCampaign(campaignId)) {
      storage.setItem(CAMPAIGN_HANDOFF_KEY, campaignId);
    } else {
      storage.removeItem(CAMPAIGN_HANDOFF_KEY);
    }
    return true;
  } catch {
    return false;
  }
}

/** Reads the selected official campaign id from storage; null when none or unknown. */
export function readCampaignId(storage: StorageLike): string | null {
  try {
    const raw = storage.getItem(CAMPAIGN_HANDOFF_KEY);
    if (!raw) return null;
    if (!findCampaign(raw)) {
      storage.removeItem(CAMPAIGN_HANDOFF_KEY);
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

/** Saves the values for the form. Returns false when storage is blocked. */
export function stashCharacter(storage: StorageLike, values: CharacterInput): boolean {
  try {
    storage.setItem(HANDOFF_KEY, JSON.stringify(values));
    return true;
  } catch {
    return false;
  }
}

/** Reads and clears the stashed values; null when there are none or they are not valid. */
export function takeCharacter(storage: StorageLike): CharacterInput | null {
  try {
    const raw = storage.getItem(HANDOFF_KEY);
    storage.removeItem(HANDOFF_KEY);
    if (raw === null) return null;
    const parsed = handoffSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
