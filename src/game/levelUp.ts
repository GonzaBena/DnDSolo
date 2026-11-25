import type { Character, GameState } from "../domain/types";
import { findClass } from "../rules";

/** What the hero gained on reaching a new level, for the level-up screen.
    Only what the rules data knows. The new hit points come from the sheet
    the screen rebuilds with the level's choices, not from here. */
export interface LevelUp {
  playerId: string;
  name: string;
  level: number;
  /** The class row's features, then the subclass's features of that level. */
  features: { name: string; summary: string }[];
  /** The new proficiency bonus, only when it went up. */
  proficiencyBonus: number | null;
  /** The SRD subclass name, only on the level that grants it. */
  subclass: string | null;
  /** A subclass from the player's manual: the screen points there instead of listing SRD features. */
  customSubclass: string | null;
}

/** The first player's level up between two states, or null without one. */
export function levelUpOf(prev: GameState, next: GameState): LevelUp | null {
  const before = prev.players[0];
  const player = next.players[0];
  if (!before || !player || player.level <= before.level) return null;
  return levelUpFromPlayer(player);
}

/** What the player's current level brought (also for a level up left unfinished when the game was closed). */
export function levelUpFromPlayer(player: Character): LevelUp {
  const level = player.level;
  const data = findClass(player.classId ?? player.characterClass);
  const row = data?.levels.find((r) => r.level === level);
  const previousRow = data?.levels.find((r) => r.level === level - 1);
  const customSubclass = player.outsideSrd.subclass;
  const subclass = customSubclass === null ? data?.subclass : undefined;
  // With a subclass from the manual, the class's "pick a subclass (SRD: X)" feature would point at the SRD one.
  const classFeatures = (row?.features ?? []).filter((f) => customSubclass === null || !f.name.startsWith("Subclase de "));
  const subclassFeatures =
    subclass && level >= subclass.level
      ? subclass.features.filter((f) => f.level === level).map((f) => f.feature)
      : [];
  return {
    playerId: player.id,
    name: player.name,
    level,
    features: [...classFeatures, ...subclassFeatures].map(({ name, summary }) => ({ name, summary })),
    proficiencyBonus:
      row && previousRow && row.proficiencyBonus > previousRow.proficiencyBonus ? row.proficiencyBonus : null,
    subclass: subclass && subclass.level === level ? subclass.name : null,
    customSubclass,
  };
}

/** Queues a level up. Two of the same player before the screen opens (the DM raised the level twice) become one
    screen at the latest level, with every level's features, so the picks and the features shown agree. */
export function enqueueLevelUp(queue: LevelUp[], next: LevelUp): LevelUp[] {
  const index = queue.findIndex((q) => q.playerId === next.playerId);
  if (index < 0) return [...queue, next];
  const prev = queue[index]!;
  const merged: LevelUp = {
    ...next,
    features: [...prev.features, ...next.features],
    proficiencyBonus: next.proficiencyBonus ?? prev.proficiencyBonus,
    subclass: next.subclass ?? prev.subclass,
  };
  return queue.map((q, i) => (i === index ? merged : q));
}

/** The queued level up as the screen shows it while the subclass is being chosen: undecided, no "Subclase: X"
    yet; with a subclass from the manual, nothing of the SRD one (its features and the class's generic trait). */
export function viewForSubclass(
  levelUp: LevelUp,
  classId: string,
  subclass: "undecided" | "srd" | { custom: string },
): LevelUp {
  if (subclass === "srd") return levelUp;
  if (subclass === "undecided") return { ...levelUp, subclass: null };
  const srdNames = new Set(findClass(classId)?.subclass.features.map((f) => f.feature.name) ?? []);
  return {
    ...levelUp,
    subclass: null,
    customSubclass: subclass.custom,
    features: levelUp.features.filter((f) => !srdNames.has(f.name) && !f.name.startsWith("Subclase de ")),
  };
}
