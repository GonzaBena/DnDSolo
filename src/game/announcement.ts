import { arrivalsAnnouncement } from "../domain/arrivals";
import { splitDialogue, type Cast } from "../domain/dialogue";
import type { Chapter, Turn } from "../domain/types";

/** A finished turn's narration as one plain sentence run for screen readers:
    the visible log streams in letter by letter, so it is not a live region;
    this text is announced once, when the turn is complete. */
export function announcementOf(narration: string, cast: Cast): string {
  return splitDialogue(narration, cast)
    .map((segment) => {
      const text = segment.paragraphs.map((p) => p.trim()).filter(Boolean).join(" ");
      if (text === "") return "";
      return segment.speaker === null ? text : `${segment.speaker} dice: ${text}`;
    })
    .filter(Boolean)
    .join(" ");
}

export function chapterAnnouncement(chapter: Chapter): string {
  return `Capítulo: ${chapter.name}.`;
}

/** A finished turn for screen readers: the place it reached, its narration,
    then who arrived (the chapter and the arrival cards themselves are
    hidden from assistive tech). */
export function turnAnnouncement(turn: Turn, cast: Cast): string {
  return [
    turn.chapter ? chapterAnnouncement(turn.chapter) : "",
    announcementOf(turn.narration, cast),
    arrivalsAnnouncement(turn.arrivals ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}
