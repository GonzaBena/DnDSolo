import { enterChapter } from "../animations/motion";
import type { Chapter } from "../domain/types";
import { useEnter } from "./useEnter";

/** Where a chapter of the story began, inside the turn that got there:
    large with its description the first time, a small line on a revisit.
    Hidden from screen readers: the turn's announcement names the place. */
export function ChapterSeparator({ chapter, animated }: { chapter: Chapter; animated?: boolean }) {
  const ref = useEnter<HTMLDivElement>(animated ? enterChapter : null);
  const description = chapter.description.trim();
  return (
    <div ref={ref} className="chapter" data-visit={chapter.firstVisit ? "first" : "again"} aria-hidden="true">
      <strong className="chapter__title">
        {chapter.firstVisit ? `— ${chapter.name} —` : chapter.name}
      </strong>
      {chapter.firstVisit && description !== "" && <p className="chapter__description">{description}</p>}
    </div>
  );
}
