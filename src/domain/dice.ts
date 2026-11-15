import type { Die, RollRequest, RollResult } from "./types";

const SIDES: Record<Die, number> = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 };

/** Pure given `random` (a function returning [0, 1)), which is what makes
    rolls testable. The UI never computes a roll; it only shows this result. */
export function rollDie(die: Die, random: () => number = Math.random): number {
  return Math.floor(random() * SIDES[die]) + 1;
}

/** Success is decided here so the model can't argue with the dice. */
export function resolveRoll(request: RollRequest, value: number): RollResult {
  return {
    ...request,
    value,
    success: request.difficulty === null ? null : value >= request.difficulty,
  };
}
