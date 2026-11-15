import { animate, stagger, utils } from "animejs";

// Every animation in the app goes through this file so that
// prefers-reduced-motion is honoured in exactly one place. Elements are
// visible by default in CSS; animations only ever play *from* a hidden
// state, so skipping them leaves the page correct.

export function motionAllowed(): boolean {
  return (
    typeof matchMedia === "function" && !matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Screen transition: the page's blocks rise in one after another. */
export function enterPage(elements: Element[]): void {
  if (!motionAllowed() || elements.length === 0) return;
  animate(elements, {
    opacity: [0, 1],
    translateY: [16, 0],
    duration: 420,
    delay: stagger(70),
    ease: "outCubic",
  });
}

/** A new paragraph of narration appearing. */
export function enterNarration(element: Element): void {
  if (!motionAllowed()) return;
  animate(element, { opacity: [0, 1], translateY: [8, 0], duration: 380, ease: "outQuad" });
}

/** The player's own message. */
export function enterFromRight(element: Element): void {
  if (!motionAllowed()) return;
  animate(element, { opacity: [0, 1], translateX: [24, 0], duration: 300, ease: "outCubic" });
}

const TUMBLE_MS = 750;

/** An enemy roll: the card pops in, a die tumbles where the number will be,
    then the die gives way to the result. The die only exists for this: it is
    hidden in CSS, so without the animation the card just shows the number. */
export function rollIn(card: Element): void {
  if (!motionAllowed()) return;
  animate(card, { opacity: [0, 1], scale: [0.6, 1], duration: 450, ease: "outBack" });

  const die = card.querySelector(".roll-card__die");
  const value = card.querySelector(".roll-card__value");
  if (!die || !value) return;
  utils.set(value, { opacity: 0 });
  // One animation with keyframes: the die tumbles, then shrinks away.
  animate(die, {
    rotate: { from: 0, to: 900, duration: TUMBLE_MS, ease: "outCubic" },
    scale: [
      { from: 0.7, to: 1, duration: TUMBLE_MS, ease: "outCubic" },
      { to: 0.3, duration: 160, ease: "inQuad" },
    ],
    opacity: [
      { from: 1, to: 1, duration: TUMBLE_MS },
      { to: 0, duration: 160, ease: "inQuad" },
    ],
  });
  animate(value, {
    opacity: [0, 1],
    scale: [0.3, 1],
    duration: 420,
    delay: TUMBLE_MS + 60,
    ease: "outBack",
  });
}
