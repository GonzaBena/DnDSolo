import { MAX_LEVEL, MIN_LEVEL, type CharacterInput } from "../domain/character";
import type { CharacterStats } from "../domain/types";
import { baseSpeed, inventoryFromSheet, statsFromSheet } from "../domain/stats";
import { buildSheet, withSpecies } from "../rules/buildSheet";

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
    const built = buildSheet(withSpecies(original, next.speciesId));
    if (built.ok) {
      return {
        values: { ...next, stats: statsFromSheet(built.sheet), startingInventory: inventoryFromSheet(built.sheet) },
        review: false,
      };
    }
  }
  // Kept stats: the old species' speed no longer applies; the lineage is unknown, so use the base.
  return { values: { ...next, stats: { ...values.stats!, speed: baseSpeed(next.speciesId) } }, review: true };
}

/** Text of a number field -> whole number, or null when empty or not a number. */
export function parseWholeNumber(text: string): number | null {
  return text.trim() === "" || !Number.isFinite(Number(text)) ? null : Math.trunc(Number(text));
}

/** Level field text -> a level from 1 to 20, or null for the empty or invalid
    values that pass through while the player is typing. */
export function parseLevel(text: string): number | null {
  if (text.trim() === "") return null;
  const level = Number(text);
  return Number.isInteger(level) && level >= MIN_LEVEL && level <= MAX_LEVEL ? level : null;
}

/** Text for the level field after `level` changed. Keeps what the player typed
    when it already means that level ("03"), otherwise shows the new level. */
export function levelTextFor(text: string, level: number): string {
  return parseLevel(text) === level ? text : String(level);
}

/** Review mode: the player's edited PG and CA over the kept stats. A field
    that is empty, invalid or below 1 keeps the previous number. */
export function mergeReviewedStats(kept: CharacterStats, hpText: string, acText: string): CharacterStats {
  const positive = (text: string, fallback: number) => {
    const value = parseWholeNumber(text);
    return value !== null && value >= 1 ? value : fallback;
  };
  return { ...kept, maxHp: positive(hpText, kept.maxHp), armorClass: positive(acText, kept.armorClass) };
}
