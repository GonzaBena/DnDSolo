import { useCallback, useEffect, useRef, useState } from "react";

/** The DM's suggested next moves as chips. Picking one only fills the
    composer: the player still reads, edits and sends it.
    It lives at the top of the composer and stays mounted: when the
    narration ends it drops open from the composer's top border like a
    curtain, instead of popping in. One row that scrolls sideways, so it
    never takes more than a line of height: touch swipes it; with a mouse,
    the wheel and the arrows at its edges move it. */
export function Suggestions({
  actions,
  visible,
  onPick,
}: {
  actions: string[];
  /** Whether it is the player's moment to pick (no turn running, no roll asked). */
  visible: boolean;
  onPick: (action: string) => void;
}) {
  const open = visible && actions.length > 0;
  const rowRef = useRef<HTMLDivElement>(null);
  // Whether there are chips hidden past each edge.
  const [more, setMore] = useState({ before: false, after: false });

  const measure = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    const before = row.scrollLeft > 1;
    const after = row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
    setMore((prev) => (prev.before === before && prev.after === after ? prev : { before, after }));
  }, []);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(row);
    // A vertical wheel moves the row sideways instead of the story behind it.
    // Not passive, so the page doesn't scroll too.
    const onWheel = (event: WheelEvent) => {
      if (row.scrollWidth <= row.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      event.preventDefault();
      row.scrollLeft += event.deltaY;
    };
    row.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      observer?.disconnect();
      row.removeEventListener("wheel", onWheel);
    };
  }, [measure, actions]);

  const page = (direction: 1 | -1) => {
    const row = rowRef.current;
    row?.scrollBy({ left: direction * row.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className={`suggestions-slot${open ? " suggestions-slot--open" : ""}`} inert={!open}>
      <div
        className="suggestions-curtain"
        data-more-before={more.before || undefined}
        data-more-after={more.after || undefined}
      >
        <div ref={rowRef} className="suggestions" role="group" aria-label="Sugerencias del DM" onScroll={measure}>
          {actions.map((action) => (
            <button key={action} type="button" className="suggestion" title={action} onClick={() => onPick(action)}>
              {action}
            </button>
          ))}
        </div>
        {/* For the mouse only: keyboard users tab through the chips, which scrolls them into view. */}
        <button
          type="button"
          className="suggestions-arrow suggestions-arrow--before"
          tabIndex={-1}
          aria-hidden="true"
          hidden={!more.before}
          onClick={() => page(-1)}
        >
          ‹
        </button>
        <button
          type="button"
          className="suggestions-arrow suggestions-arrow--after"
          tabIndex={-1}
          aria-hidden="true"
          hidden={!more.after}
          onClick={() => page(1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}
