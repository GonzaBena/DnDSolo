import type { Chapter } from "../domain/types";
import { chapterTitle } from "./ChapterSeparator";
import { TopBanner } from "./TopBanner";

const SHOWN_MS = 3000;

/** The banner's content. Hidden from screen readers: the turn's
    announcement already names the place. */
export function ChapterStrip({ chapter }: { chapter: Chapter }) {
  const description = chapter.description.trim();
  return (
    <div className="chapter-banner__inner" aria-hidden="true">
      <strong className="chapter__title">{chapterTitle(chapter.name)}</strong>
      {description !== "" && <p className="chapter__description">{description}</p>}
    </div>
  );
}

/** The party reached a place for the first time: its name drops from the
    top like a film's chapter card. */
export function ChapterBanner({ chapter, onDone }: { chapter: Chapter; onDone: () => void }) {
  return (
    <TopBanner className="chapter-banner" shownMs={SHOWN_MS} sound="chapter" onDone={onDone}>
      <ChapterStrip chapter={chapter} />
    </TopBanner>
  );
}
