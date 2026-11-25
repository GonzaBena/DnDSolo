import { LOADED_MAX_LEVEL, findBackground, findClass, findSpecies } from "../rules";
import { buildSheet, type BuildResult, type CharacterChoices, type ChoiceError } from "../rules/buildSheet";
import { activeChoices, requiredChoices } from "../rules/choices";
import type { CharacterSheet, ChoiceSpec } from "../rules/types";
import { statsFromSheet } from "./stats";
import type { Character } from "./types";

type Picks = Record<string, string[]>;

/** The DM raised the level and the player still has to make that level's choices.
    Only for characters with stored choices and levels the rules data covers. */
export function pendingLevelUp(player: Character): boolean {
  return player.choices !== null && player.level > player.choices.level && player.level <= LOADED_MAX_LEVEL;
}

/** The choices already made, shown fixed in the picker. */
export function lockedPicks(player: Character): Picks {
  return player.choices?.picks ?? {};
}

/** Active choices at the player's level that `picks` doesn't fill yet: new ones, and the ones that keep their id
    and grow with the level (cantrips, prepared spells, the spellbook). */
export function pendingSpecs(player: Character, picks: Picks): ChoiceSpec[] {
  const c = player.choices;
  if (!c) return [];
  const specs = activeChoices(requiredChoices({ ...c, level: player.level }), picks);
  return specs.filter((spec) => (picks[spec.id]?.length ?? 0) < spec.count);
}

export function previewLevelUp(player: Character, picks: Picks): BuildResult {
  if (!player.choices) return { ok: false, errors: [{ field: "choices", message: "Sin elecciones guardadas." }] };
  return buildSheet({ ...player.choices, level: player.level, picks });
}

/** Rebuilds the sheet at the new level. Current HP rises as much as the maximum (it stays at 0 while down). */
export function applyLevelUp(
  player: Character,
  picks: Picks,
): { ok: true; player: Character } | { ok: false; errors: ChoiceError[] } {
  const built = previewLevelUp(player, picks);
  if (!built.ok) return built;
  const stats = statsFromSheet(built.sheet);
  const oldMax = player.stats?.maxHp ?? stats.maxHp;
  const current = player.currentHp ?? stats.maxHp;
  const currentHp = current > 0 ? Math.min(stats.maxHp, current + (stats.maxHp - oldMax)) : current;
  return {
    ok: true,
    player: { ...player, stats, currentHp, choices: { ...player.choices!, level: player.level, picks } },
  };
}

/** An old save (no choices) whose species, class and background the rules data knows, at a level it covers. */
export function canUpgradeSheet(player: Character): boolean {
  const { speciesId, classId, srdBackgroundId } = player;
  return (
    player.choices === null &&
    speciesId !== null && findSpecies(speciesId) !== undefined &&
    classId !== null && findClass(classId) !== undefined &&
    srdBackgroundId !== null && findBackground(srdBackgroundId) !== undefined &&
    player.level <= LOADED_MAX_LEVEL
  );
}

/** The new sheet replaces the old numbers; life keeps its proportion (0 stays 0, alive stays at least 1). */
export function upgradeSheet(player: Character, choices: CharacterChoices, sheet: CharacterSheet): Character {
  const stats = statsFromSheet(sheet);
  const oldMax = player.stats?.maxHp ?? null;
  const current = player.currentHp;
  const currentHp =
    oldMax === null || current === null
      ? stats.maxHp
      : current === 0
        ? 0
        : Math.min(stats.maxHp, Math.max(1, Math.round((current / oldMax) * stats.maxHp)));
  return { ...player, stats, currentHp, choices };
}
