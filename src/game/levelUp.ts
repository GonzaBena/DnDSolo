import type { GameState } from "../domain/types";
import { findClass } from "../rules";

/** What the hero gained on reaching a new level, for the level-up screen.
    Only what the rules data knows: hit points are not recalculated on a
    level up, so they never show here. */
export interface LevelUp {
  name: string;
  level: number;
  /** The class row's features, then the subclass's features of that level. */
  features: { name: string; summary: string }[];
  /** The new proficiency bonus, only when it went up. */
  proficiencyBonus: number | null;
  /** The subclass name, only on the level that grants it. */
  subclass: string | null;
}

/** The first player's level up between two states, or null without one. */
export function levelUpOf(prev: GameState, next: GameState): LevelUp | null {
  const before = prev.players[0];
  const player = next.players[0];
  if (!before || !player || player.level <= before.level) return null;
  const level = player.level;
  const data = findClass(player.classId ?? player.characterClass);
  const row = data?.levels.find((r) => r.level === level);
  const previousRow = data?.levels.find((r) => r.level === level - 1);
  const subclass = data?.subclass;
  const subclassFeatures =
    subclass && level >= subclass.level
      ? subclass.features.filter((f) => f.level === level).map((f) => f.feature)
      : [];
  return {
    name: player.name,
    level,
    features: [...(row?.features ?? []), ...subclassFeatures].map(({ name, summary }) => ({ name, summary })),
    proficiencyBonus:
      row && previousRow && row.proficiencyBonus > previousRow.proficiencyBonus ? row.proficiencyBonus : null,
    subclass: subclass && subclass.level === level ? subclass.name : null,
  };
}
