import type { Chapter, GameState } from "./types";

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The chapter a turn opens, as the place was when the party got there:
    one whenever the location name changes, and always on the first turn
    (official campaigns set the place before it, so it doesn't "change").
    `prev` holds the turns before this one; a place named in any of their
    chapters is a revisit. */
export function chapterOf(prev: GameState, next: GameState): Chapter | null {
  const { name, description } = next.location;
  if (name.trim() === "") return null;
  if (prev.turns.length > 0 && sameName(prev.location.name, name)) return null;
  const firstVisit = !prev.turns.some((turn) => turn.chapter && sameName(turn.chapter.name, name));
  return { name, description, firstVisit };
}
