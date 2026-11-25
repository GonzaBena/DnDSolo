import type {
  Die,
  EnemyRollRequest,
  EnemyRollResult,
  PlayerRoll,
  RollMode,
} from "./types";

const SIDES: Record<Die, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100,
};

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
  if (request.mode !== "normal") {
    const values: [number, number] = [
      rollDie(request.die, random),
      rollDie(request.die, random),
    ];
    return {
      ...request,
      values,
      total: resolveRollMode(values, request.mode) + request.modifier,
    };
  }
  const values = Array.from({ length: request.count }, () =>
    rollDie(request.die, random),
  );
  const total =
    values.reduce((sum, value) => sum + value, 0) + request.modifier;
  return { ...request, values, total };
}

/** How many dice a request physically rolls: two for advantage or
    disadvantage, `count` otherwise. */
export function diceRolled(request: { count: number; mode: RollMode }): number {
  return request.mode === "normal" ? request.count : 2;
}

/** "ventaja" or "desventaja", for texts like "con ventaja". */
export function rollModeLabel(mode: Exclude<RollMode, "normal">): string {
  return mode === "advantage" ? "ventaja" : "desventaja";
}

/** "2d6+3", "1d20", "1d8-1". */
export function formatDice(roll: {
  die: Die;
  count: number;
  modifier?: number;
}): string {
  const modifier = roll.modifier ?? 0;
  const sign =
    modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : "";
  return `${roll.count}${roll.die}${sign}`;
}

/** The die that counts out of the two d20 of an advantage or disadvantage
    roll. */
export function resolveRollMode(
  rolls: readonly [number, number],
  mode: Exclude<RollMode, "normal">,
): number {
  return mode === "advantage" ? Math.max(...rolls) : Math.min(...rolls);
}

/** "1d20: 14 + 3 = 17", "1d8: 8 - 1 = 7", "1d20: 20",
    "1d20 con ventaja (12 y 17, queda 17): 17 + 3 = 20". */
export function describePlayerRoll(
  roll: Pick<PlayerRoll, "die" | "count" | "value" | "modifier" | "mode" | "rolls">,
): string {
  const { die, value, modifier } = roll;
  const math =
    modifier === 0
      ? `${value}`
      : `${value} ${modifier > 0 ? "+" : "-"} ${Math.abs(modifier)} = ${value + modifier}`;
  const natural = naturalResult(roll);
  const note =
    natural === "critical"
      ? " (20 natural: crítico)"
      : natural === "fumble"
        ? " (1 natural: pifia)"
        : "";
  const dice = formatDice({ die, count: roll.count ?? 1 });
  if (roll.rolls && roll.mode && roll.mode !== "normal") {
    const label = rollModeLabel(roll.mode);
    const [a, b] = roll.rolls;
    return `${dice} con ${label} (${a} y ${b}, queda ${value}): ${math}${note}`;
  }
  return `${dice}: ${math}${note}`;
}

/** A natural 20 or 1 only means something on a single d20; with several
    dice the value is a sum and says nothing about any one of them. With
    advantage or disadvantage `value` is already the die that was kept. */
export function naturalResult(
  roll: Pick<PlayerRoll, "die" | "count" | "value" | "mode" | "rolls">,
): "critical" | "fumble" | null {
  if (roll.die !== "d20" || (roll.count ?? 1) !== 1) return null;
  if (roll.value === 20) return "critical";
  if (roll.value === 1) return "fumble";
  return null;
}

/** The same for an enemy's roll: the kept d20 is the total without the modifier. */
export function enemyNaturalResult(result: EnemyRollResult): "critical" | "fumble" | null {
  return naturalResult({ die: result.die, count: result.count, value: result.total - result.modifier });
}

/** Highest total a die can show, for validating what the player types. */
export function dieSides(die: Die): number {
  return SIDES[die];
}
