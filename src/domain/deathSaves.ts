import type { Character } from "./types";

const CLEAR = { successes: 0, failures: 0 };

/** Resolves a death save from the natural d20 the player rolled. Only a
    dying character rolls them; anyone else comes back unchanged. */
export function applyDeathSave(player: Character, natural: number): Character {
  if (player.condition !== "dying") return player;
  if (natural >= 20) return { ...player, currentHp: 1, condition: "ok", deathSaves: CLEAR };
  const { successes, failures } = player.deathSaves;
  if (natural >= 10) {
    if (successes + 1 >= 3) return { ...player, condition: "stable", deathSaves: CLEAR };
    return { ...player, deathSaves: { successes: successes + 1, failures } };
  }
  return addFailures(player, natural <= 1 ? 2 : 1);
}

/** Failed saves (from a bad roll or from damage taken at 0 HP); three kill. */
export function addFailures(player: Character, count: number): Character {
  const failures = Math.min(3, player.deathSaves.failures + count);
  return {
    ...player,
    condition: failures >= 3 ? "dead" : "dying",
    deathSaves: { ...player.deathSaves, failures },
  };
}
