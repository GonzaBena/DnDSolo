import { useCallback, useEffect, useRef, useState } from "react";

/** How close to the bottom (px) still counts as "at the bottom". */
const THRESHOLD = 80;

function distanceToBottom(): number {
  const root = document.documentElement;
  return root.scrollHeight - (window.scrollY + window.innerHeight);
}

/**
 * Keeps the page pinned to the bottom while new content arrives, unless the
 * player scrolled up to reread. `atBottom` drives the "jump to the end" button.
 */
export function useStickToBottom() {
  const [atBottom, setAtBottom] = useState(true);
  // A ref too, so content effects read the latest value without re-running.
  const pinnedRef = useRef(true);

  useEffect(() => {
    const update = () => {
      const bottom = distanceToBottom() <= THRESHOLD;
      pinnedRef.current = bottom;
      setAtBottom(bottom);
    };
    // Content growing while pinned is followed by `follow`, which scrolls;
    // when not pinned it only moves the bottom further away, so recheck.
    const onResize = () => {
      if (pinnedRef.current) return;
      setAtBottom(distanceToBottom() <= THRESHOLD);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(document.body);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    pinnedRef.current = true;
    setAtBottom(true);
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
  }, []);

  /** Call after content changes: scrolls only if the player is following. */
  const follow = useCallback(() => {
    if (pinnedRef.current) scrollToBottom();
  }, [scrollToBottom]);

  return { atBottom, scrollToBottom, follow };
}
