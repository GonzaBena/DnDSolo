import { useLayoutEffect, useRef } from "react";

/** Runs an entrance animation once, when the element mounts. Layout effect
    so the first frame is already the animation's start, with no flash. */
export function useEnter<T extends Element>(play: ((element: T) => void) | null) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    if (play && ref.current) play(ref.current);
    // Mount-only on purpose: re-renders (e.g. streaming text) must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}
