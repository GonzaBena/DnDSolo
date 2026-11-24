import { arrivalsAnnouncement } from "../domain/arrivals";
import { splitDialogue, type Cast } from "../domain/dialogue";
import type { Chapter, GameState, Turn } from "../domain/types";
import { questBanners } from "./bannerQueue";

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

/** What closed or grew this turn, for screen readers: the quest banners
    and the level-up screen show it, but the banners are hidden from them. */
export function milestoneAnnouncement(prev: GameState, next: GameState): string {
  const parts = questBanners(prev, next).map((banner) =>
    banner.kind === "quest" ? `Misión ${banner.outcome === "completed" ? "cumplida" : "fallida"}: ${banner.title}.` : "",
  );
  const before = prev.players[0]?.level ?? 0;
  const after = next.players[0]?.level ?? 0;
  if (after > before) parts.push(`¡Subiste al nivel ${after}!`);
  return parts.filter(Boolean).join(" ");
}
