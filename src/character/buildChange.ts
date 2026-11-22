import type { CharacterInput } from "../domain/character";
import { inventoryFromSheet, statsFromSheet } from "../domain/stats";
import { buildSheet } from "../rules/buildSheet";

export interface BuildChangeResult {
  values: CharacterInput;
  /** True when the generated stats no longer match the species and the player must review PG and CA. */
  review: boolean;
}

/** Applies a change to species, class, level or SRD background on the form.
    Class, level and background make a generated sheet stale, so it is dropped.
    A species change tries to rebuild the sheet from the original choices; when that
    cannot be done the previous stats are kept and flagged for review. */
export function applyBuildChange(values: CharacterInput, patch: Partial<CharacterInput>): BuildChangeResult {
  const next = { ...values, ...patch };
  const hasSheet = values.stats != null;
  if (!hasSheet) return { values: next, review: false };

  const buildChanged =
    next.classId !== values.classId || next.level !== values.level || next.srdBackgroundId !== values.srdBackgroundId;
  if (buildChanged) {
    return { values: { ...next, stats: null, startingInventory: undefined, choices: undefined }, review: false };
  }
  if (next.speciesId === values.speciesId) return { values: next, review: false };

  const original = values.choices;
  if (original) {
    const prefix = `species.${original.speciesId}.`;
    const picks =
      next.speciesId === original.speciesId
        ? original.picks
        : Object.fromEntries(Object.entries(original.picks).filter(([id]) => !id.startsWith(prefix)));
    const built = buildSheet({ ...original, speciesId: next.speciesId, picks });
    if (built.ok) {
      return {
        values: { ...next, stats: statsFromSheet(built.sheet), startingInventory: inventoryFromSheet(built.sheet) },
        review: false,
      };
    }
  }
  return { values: next, review: true };
}
