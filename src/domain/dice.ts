import type { Die, EnemyRollRequest, EnemyRollResult, PlayerRoll } from "./types";

const SIDES: Record<Die, number> = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 };

/** Pure given `random` (a function returning [0, 1)), which is what makes
    rolls testable. */
export function rollDie(die: Die, random: () => number = Math.random): number {
  return Math.floor(random() * SIDES[die]) + 1;
}

/** Rolls for an enemy. The app only ever rolls for enemies and NPCs: the
    player rolls their own dice and reports the result (see PlayerRoll). */
export function rollForEnemy(
  request: EnemyRollRequest,
  random: () => number = Math.random,
): EnemyRollResult {
  const values = Array.from({ length: request.count }, () => rollDie(request.die, random));
  const total = values.reduce((sum, value) => sum + value, 0) + request.modifier;
  return { ...request, values, total };
}

/** "2d6+3", "1d20", "1d8-1". */
export function formatDice(roll: { die: Die; count: number; modifier?: number }): string {
  const modifier = roll.modifier ?? 0;
  const sign = modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : "";
  return `${roll.count}${roll.die}${sign}`;
}

/** "1d20: 14 + 3 = 17", "1d8: 8 - 1 = 7", "1d20: 20". */
export function describePlayerRoll(
  roll: Pick<PlayerRoll, "die" | "count" | "value" | "modifier">,
): string {
  const { die, value, modifier } = roll;
  const math =
    modifier === 0
      ? `${value}`
      : `${value} ${modifier > 0 ? "+" : "-"} ${Math.abs(modifier)} = ${value + modifier}`;
  return `${formatDice({ die, count: roll.count ?? 1 })}: ${math}`;
}

/** Highest total a die can show, for validating what the player types. */
export function dieSides(die: Die): number {
  return SIDES[die];
}
