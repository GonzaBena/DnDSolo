import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { enterBanner, leaveBanner } from "../animations/motion";

/** A strip that drops from the top for a moment, then leaves on its own
    (or on a tap). Only for live turns; each one mounts fresh (keyed by the
    caller), so it runs its timer once. */
export function TopBanner({
  className,
  shownMs,
  onDone,
  children,
}: {
  className: string;
  shownMs: number;
  onDone: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const leavingRef = useRef(false);
  const cancelLeaveRef = useRef<(() => void) | null>(null);

  const leave = () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    if (ref.current) cancelLeaveRef.current = leaveBanner(ref.current, onDone);
    else onDone();
  };

  useEffect(() => {
    if (ref.current) {
      enterBanner(ref.current);
      // The toasts move below the banner while it is up (arrivals.css).
      document.documentElement.style.setProperty("--banner-height", `${ref.current.offsetHeight}px`);
    }
    const timer = setTimeout(leave, shownMs);
    return () => {
      clearTimeout(timer);
      cancelLeaveRef.current?.();
      document.documentElement.style.removeProperty("--banner-height");
    };
    // Mount-only: see the doc comment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (typeof document === "undefined") return null;
  // On <body>, like the toasts, so the sticky header can't cover it.
  return createPortal(
    <div ref={ref} className={`top-banner ${className}`} onClick={leave}>
      {children}
    </div>,
    document.body,
  );
}
