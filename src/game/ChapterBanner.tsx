import type { Chapter } from "../domain/types";
import { TopBanner } from "./TopBanner";

const SHOWN_MS = 3000;

/** The banner's content. Hidden from screen readers: the turn's
    announcement already names the place. */
export function ChapterStrip({ chapter }: { chapter: Chapter }) {
  const description = chapter.description.trim();
  return (
    <div className="chapter-banner__inner" aria-hidden="true">
      <strong className="chapter-banner__title">— {chapter.name} —</strong>
      {description !== "" && <p className="chapter-banner__description">{description}</p>}
    </div>
  );
}

/** The party reached a place for the first time: its name drops from the
    top like a film's chapter card. */
export function ChapterBanner({ chapter, onDone }: { chapter: Chapter; onDone: () => void }) {
  return (
    <TopBanner className="chapter-banner" shownMs={SHOWN_MS} onDone={onDone}>
      <ChapterStrip chapter={chapter} />
    </TopBanner>
  );
}
