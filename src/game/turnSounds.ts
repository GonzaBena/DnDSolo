import type { SoundId } from "../audio/sound";
import type { GameState } from "../domain/types";
import { tookDamage } from "./turnToasts";

/** What a committed turn sounds like for the hero: the end of the game, a
    heartbeat while dying (dropping to 0 or a death save), or a hit. Only
    for live turns, so loading a saved game plays nothing. */
export function turnSounds(prev: GameState, next: GameState, events: readonly string[]): SoundId[] {
  const before = prev.players[0]?.condition;
  const after = next.players[0]?.condition;
  if (after === "dead") return before === "dead" ? [] : ["gameOver"];
  if (after === "dying") return ["heartbeat"];
  return tookDamage(events, prev, next) ? ["hit"] : [];
}
