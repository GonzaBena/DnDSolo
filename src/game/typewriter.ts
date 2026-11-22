/** Base reveal speed. The model often delivers the narration in two or
    three big fragments; pacing it makes the DM feel like they're telling
    the story instead of pasting it. */
const CHARS_PER_SECOND = 70;
/** A long backlog speeds up so the reveal never trails the model by more
    than this, which keeps very long narrations from dragging. */
const MAX_LAG_SECONDS = 8;

export interface Typewriter {
  /** The full text received so far. If it doesn't extend what was already
      set (e.g. a retry started over), the reveal restarts. */
  setTarget(text: string): void;
  /** Resolves once everything set so far is on screen. */
  finish(): Promise<void>;
  cancel(): void;
}

/** Reveals `target` gradually through `onReveal`, one animation frame at a
    time. With reduced motion the text is shown as it arrives. */
export function createTypewriter(
  onReveal: (shown: string) => void,
  doc: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener"> | undefined =
    typeof document === "undefined" ? undefined : document,
): Typewriter {
  const instant =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let target = "";
  let shown = 0;
  let frame: number | null = null;
  let lastTime = 0;
  let carry = 0;
  let waiters: (() => void)[] = [];

  const settle = () => {
    for (const resolve of waiters) resolve();
    waiters = [];
  };

  const isHidden = () => doc?.visibilityState === "hidden";

  /** Animation frames pause in a hidden tab, so a waiting turn would never
      be saved: reveal everything at once instead. */
  const revealAll = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    if (shown < target.length) {
      shown = target.length;
      onReveal(target);
    }
    settle();
  };

  const tick = (time: number) => {
    const elapsed = lastTime === 0 ? 0 : (time - lastTime) / 1000;
    lastTime = time;
    const backlog = target.length - shown;
    const speed = Math.max(CHARS_PER_SECOND, backlog / MAX_LAG_SECONDS);
    carry += elapsed * speed;
    const step = Math.floor(carry);
    if (step > 0) {
      carry -= step;
      shown = Math.min(target.length, shown + step);
      onReveal(target.slice(0, shown));
    }
    if (shown < target.length) {
      frame = requestAnimationFrame(tick);
    } else {
      frame = null;
      settle();
    }
  };

  const start = () => {
    if (frame !== null) return;
    lastTime = 0;
    carry = 0;
    frame = requestAnimationFrame(tick);
  };

  return {
    setTarget(text) {
      if (!text.startsWith(target.slice(0, shown))) {
        shown = 0;
        onReveal("");
      }
      target = text;
      if (instant) {
        shown = target.length;
        onReveal(target);
        return;
      }
      if (shown < target.length) start();
    },
    finish() {
      if (shown >= target.length) return Promise.resolve();
      if (isHidden()) {
        revealAll();
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        const onVisibility = () => {
          if (isHidden()) revealAll();
        };
        doc?.addEventListener("visibilitychange", onVisibility);
        waiters.push(() => {
          doc?.removeEventListener("visibilitychange", onVisibility);
          resolve();
        });
      });
    },
    cancel() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      settle();
    },
  };
}
