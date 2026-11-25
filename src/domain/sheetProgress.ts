import { LOADED_MAX_LEVEL, findBackground, findClass, findSpecies } from "../rules";
import {
  buildSheet, replaceRepeatedSpells, type BuildResult, type CharacterChoices, type ChoiceError,
} from "../rules/buildSheet";
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

/** The choices already made, shown fixed in the picker. A pick the new level makes illegal (a spell a class or
    species feature now always grants, like a cleric's Cure Wounds at 3) is left out, so the picker asks again. */
export function lockedPicks(player: Character): Picks {
  const c = player.choices;
  if (!c) return {};
  if (player.level <= c.level || player.level > LOADED_MAX_LEVEL) return c.picks;
  const repaired = replaceRepeatedSpells({ ...c, level: player.level }).picks;
  return Object.fromEntries(
    Object.entries(c.picks).map(([id, ids]) => [id, ids.filter((pick) => repaired[id]?.includes(pick) ?? true)]),
  );
}

/** Active choices at the player's level that `picks` doesn't fill yet: new ones, and the ones that keep their id
    and grow with the level (cantrips, prepared spells, the spellbook). */
export function pendingSpecs(player: Character, picks: Picks): ChoiceSpec[] {
  const c = player.choices;
  if (!c) return [];
  const specs = activeChoices(requiredChoices({ ...c, level: player.level }), picks);
  return specs.filter((spec) => (picks[spec.id]?.length ?? 0) < spec.count);
}

/** What the level-up picker shows: the choices this level brings, filled or not, so a pick can still be changed.
    Choices made at earlier levels that are complete stay out. */
export function levelSpecs(player: Character, picks: Picks): ChoiceSpec[] {
  const c = player.choices;
  if (!c) return [];
  const locked = lockedPicks(player);
  return activeChoices(requiredChoices({ ...c, level: player.level }), picks).filter(
    (spec) => (locked[spec.id]?.length ?? 0) < spec.count,
  );
}

/** Drops picks of choices the other picks no longer open (a feat swapped for another). */
function activePicks(player: Character, picks: Picks): Picks {
  const active = new Set(activeChoices(requiredChoices({ ...player.choices!, level: player.level }), picks).map((s) => s.id));
  return Object.fromEntries(Object.entries(picks).filter(([id]) => active.has(id)));
}

export function previewLevelUp(player: Character, picks: Picks): BuildResult {
  if (!player.choices) return { ok: false, errors: [{ field: "choices", message: "Sin elecciones guardadas." }] };
  return buildSheet({ ...player.choices, level: player.level, picks: activePicks(player, picks) });
}

/** Once every pick is made, the sheet's errors on choices the picker doesn't show: the player can't fix them there,
    so the screen lists them and lets the player leave (the level up waits for the next time the game opens). */
export function hiddenErrors(player: Character, picks: Picks): ChoiceError[] {
  if (!pendingLevelUp(player) || pendingSpecs(player, picks).length > 0) return [];
  const built = previewLevelUp(player, picks);
  if (built.ok) return [];
  const shown = new Set(levelSpecs(player, picks).map((s) => `picks.${s.id}`));
  return built.errors.filter((e) => !shown.has(e.field));
}

/** The player with a sheet built from `sheet` and `choices`. Current HP moves as much as the maximum (0 stays 0). */
function withSheet(player: Character, choices: CharacterChoices, sheet: CharacterSheet): Character {
  const stats = statsFromSheet(sheet);
  const oldMax = player.stats?.maxHp ?? stats.maxHp;
  const current = player.currentHp ?? stats.maxHp;
  const currentHp = current > 0 ? Math.max(1, Math.min(stats.maxHp, current + (stats.maxHp - oldMax))) : current;
  return { ...player, stats, currentHp, choices };
}

/** Rebuilds the sheet from `choices` (e.g. the subclass changed). When they don't build, the player stays as is. */
export function rebuildSheet(player: Character, choices: CharacterChoices): Character {
  const built = buildSheet(choices);
  return built.ok ? withSheet(player, choices, built.sheet) : player;
}

/** Rebuilds the sheet at the new level. Current HP rises as much as the maximum (it stays at 0 while down). */
export function applyLevelUp(
  player: Character,
  picks: Picks,
): { ok: true; player: Character } | { ok: false; errors: ChoiceError[] } {
  const built = previewLevelUp(player, picks);
  if (!built.ok) return built;
  const choices = { ...player.choices!, level: player.level, picks: activePicks(player, picks) };
  return { ok: true, player: withSheet(player, choices, built.sheet) };
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
