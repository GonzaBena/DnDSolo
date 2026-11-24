import { useEffect } from "react";

/** How much of the page's bottom the on-screen keyboard covers. iOS doesn't
    shrink the page for the keyboard, so the composer, pinned to the page's
    bottom, would sit behind it. */
export function keyboardInset(innerHeight: number, viewport: { height: number; offsetTop: number }): number {
  return Math.max(0, Math.round(innerHeight - viewport.height - viewport.offsetTop));
}

/** Keeps `--keyboard-inset` on <html> up to date while the game is open. */
export function useKeyboardInset(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty("--keyboard-inset", `${keyboardInset(window.innerHeight, viewport)}px`);
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      root.style.removeProperty("--keyboard-inset");
    };
  }, []);
}
