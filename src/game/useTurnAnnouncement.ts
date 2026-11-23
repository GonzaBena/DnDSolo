import { useEffect, useRef, useState } from "react";
import { castOf } from "../domain/dialogue";
import { announcementOf } from "./announcement";
import type { Screen } from "./useGameSession";

/** Screen readers hear each finished turn once, as plain text (see
    announcementOf): the log itself streams letter by letter, so it is not a
    live region. Opening a game announces nothing. */
export function useTurnAnnouncement(screen: Screen): string {
  const [announcement, setAnnouncement] = useState("");
  const announcedCount = useRef<number | null>(null);
  useEffect(() => {
    if (screen.status !== "playing") {
      announcedCount.current = null;
      return;
    }
    const { turns } = screen.state;
    const last = turns.at(-1);
    if (announcedCount.current !== null && turns.length > announcedCount.current && last) {
      setAnnouncement(announcementOf(last.narration, castOf(screen.state)));
    }
    announcedCount.current = turns.length;
  }, [screen]);
  return announcement;
}
