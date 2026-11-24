import { enterChapter } from "../animations/motion";
import type { Chapter } from "../domain/types";
import { useEnter } from "./useEnter";

/** "— Name —", with non-breaking spaces so a dash never wraps alone onto
    its own line. Shared with the chapter banner. */
export const chapterTitle = (name: string): string => `—\u00a0${name}\u00a0—`;

/** Where a chapter of the story began, inside the turn that got there:
    large with its description the first time, a small line on a revisit.
    Hidden from screen readers: the turn's announcement names the place. */
export function ChapterSeparator({ chapter, animated }: { chapter: Chapter; animated?: boolean }) {
  const ref = useEnter<HTMLDivElement>(animated ? enterChapter : null);
  const description = chapter.description.trim();
  return (
    <div ref={ref} className="chapter" data-visit={chapter.firstVisit ? "first" : "again"} aria-hidden="true">
      <strong className="chapter__title">
        {chapter.firstVisit ? chapterTitle(chapter.name) : chapter.name}
      </strong>
      {chapter.firstVisit && description !== "" && <p className="chapter__description">{description}</p>}
    </div>
  );
}
