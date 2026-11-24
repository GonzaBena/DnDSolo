import { useEffect, useRef, useState } from "react";
import { castOf } from "../domain/dialogue";
import type { GameState } from "../domain/types";
import { milestoneAnnouncement, turnAnnouncement } from "./announcement";
import type { Screen } from "./useGameSession";

/** Screen readers hear each finished turn once, as plain text (see
    announcementOf): the log itself streams letter by letter, so it is not a
    live region. Opening a game announces nothing. */
export function useTurnAnnouncement(screen: Screen): string {
  const [announcement, setAnnouncement] = useState("");
  const announcedCount = useRef<number | null>(null);
  const previousState = useRef<GameState | null>(null);
  useEffect(() => {
    if (screen.status !== "playing") {
      announcedCount.current = null;
      previousState.current = null;
      return;
    }
    const { turns } = screen.state;
    const last = turns.at(-1);
    if (announcedCount.current !== null && turns.length > announcedCount.current && last) {
      const prev = previousState.current;
      const milestones = prev ? milestoneAnnouncement(prev, screen.state) : "";
      setAnnouncement([turnAnnouncement(last, castOf(screen.state)), milestones].filter(Boolean).join(" "));
    }
    announcedCount.current = turns.length;
    previousState.current = screen.state;
  }, [screen]);
  return announcement;
}
