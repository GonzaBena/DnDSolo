import { z } from "zod";
import type { CharacterInput } from "../domain/character";
import { findBackground, findClass, findSpecies } from "../rules";

/**
 * Carries a generated character from /generator to the form on /character.
 * It lives in sessionStorage so it survives the page change but not the tab.
 */
export const HANDOFF_KEY = "dnsolo.generatedCharacter";

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
});

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

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
