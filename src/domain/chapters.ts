import { samePlace } from "./names";
import type { Chapter, GameState } from "./types";

/** The chapter a turn opens, as the place was when the party got there.
    Where the party is counts from the latest chapter in the log, so a turn
    where the DM left the place blank or respelled it doesn't open one when
    it comes back; saves from before chapters fall back to the location.
    The first turn always opens one (official campaigns set the place
    before it, so it doesn't "change"). A place named in any earlier
    chapter is a revisit. */
export function chapterOf(prev: GameState, next: GameState): Chapter | null {
  const { name, description } = next.location;
  if (name.trim() === "") return null;
  const here =
    prev.turns.findLast((turn) => turn.chapter)?.chapter?.name ??
    (prev.turns.length > 0 ? prev.location.name : null);
  if (here !== null && samePlace(here, name)) return null;
  const firstVisit = !prev.turns.some((turn) => turn.chapter && samePlace(turn.chapter.name, name));
  return { name, description, firstVisit };
}
