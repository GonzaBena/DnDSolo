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

/** Someone walking into the scene: the card rises in and the face pops. */
export function enterArrival(element: Element): void {
  if (!motionAllowed()) return;
  animate(element, { opacity: [0, 1], translateY: [12, 0], duration: 420, ease: "outCubic" });
  const face = element.querySelector(".avatar__face");
  if (face) animate(face, { scale: [0.6, 1], duration: 520, delay: 120, ease: "outBack" });
}

/** The player's own message. */
export function enterFromRight(element: Element): void {
  if (!motionAllowed()) return;
  animate(element, { opacity: [0, 1], translateX: [24, 0], duration: 300, ease: "outCubic" });
}

/** The scene drawer sliding in from the right edge. */
export function enterDrawer(element: Element): void {
  if (!motionAllowed()) return;
  animate(element, { translateX: ["100%", "0%"], duration: 320, ease: "outCubic" });
}

/** The scene drawer sliding back out; `onDone` runs once it has left.
    Returns a function that stops the animation. */
export function leaveDrawer(element: Element, onDone: () => void): () => void {
  if (!motionAllowed()) {
    onDone();
    return () => {};
  }
  const animation = animate(element, {
    translateX: ["0%", "100%"],
    duration: 240,
    ease: "inCubic",
    onComplete: onDone,
  });
  return () => animation.cancel();
}

/** The face of whoever is talking swinging like a pendulum (pivot on the
    element's transform-origin). Returns `stop`, which eases it back to
    upright. */
export function startSwing(element: Element): () => void {
  if (!motionAllowed()) return () => {};
  const swing = animate(element, {
    rotate: [-3, 3],
    duration: 800,
    ease: "inOutSine",
    loop: true,
    alternate: true,
  });
  return () => {
    swing.pause();
    animate(element, { rotate: 0, duration: 300, ease: "outQuad" });
  };
}

/** Subtle screen shake when damage or impact happens. */
export function shakeScreen(element: Element): void {
  if (!motionAllowed()) return;
  animate(element, {
    translateX: [0, -7, 7, -5, 5, -2, 2, 0],
    duration: 360,
    ease: "inOutQuad",
  });
}

/** Toast entrance: drops down slightly and fades in. */
export function enterToast(element: Element): void {
  if (!motionAllowed()) return;
  animate(element, {
    opacity: [0, 1],
    translateY: [-12, 0],
    scale: [0.94, 1],
    duration: 260,
    ease: "outCubic",
  });
}

/** Toast exit: fades out and slides up. Returns cancel function. */
export function leaveToast(element: Element, onDone: () => void): () => void {
  if (!motionAllowed()) {
    onDone();
    return () => {};
  }
  const animation = animate(element, {
    opacity: [1, 0],
    translateY: [0, -10],
    scale: [1, 0.94],
    duration: 180,
    ease: "inQuad",
    onComplete: onDone,
  });
  return () => animation.cancel();
}

const TUMBLE_MS = 750;
const LEAVE_MS = 160;

/** The result taking the die's place, `delay` ms after the roll started. */
function landValue(value: Element, delay: number): void {
  animate(value, { opacity: [0, 1], scale: [0.3, 1], duration: 420, delay, ease: "outBack" });
}

/** One die: tumble, then shrink away. */
function tumbleDie(die: Element): number {
  animate(die, {
    rotate: { from: 0, to: 900, duration: TUMBLE_MS, ease: "outCubic" },
    scale: [
      { from: 0.7, to: 1, duration: TUMBLE_MS, ease: "outCubic" },
      { to: 0.3, duration: LEAVE_MS, ease: "inQuad" },
    ],
    opacity: [
      { from: 1, to: 1, duration: TUMBLE_MS },
      { to: 0, duration: LEAVE_MS, ease: "inQuad" },
    ],
  });
  return TUMBLE_MS + 60;
}

// The two d10s of a d100, in px and ms. They tumble side by side, come to
// rest, hold, lean away from each other and then slam together.
const PAIR_SPREAD = 46;
const PAIR_SIZE = 0.75;
const PAIR_HOLD_MS = 280;
const PAIR_WINDUP_MS = 170;
const PAIR_SLAM_MS = 190;
const PAIR_FLASH_MS = 90;

function tumblePair(dice: Element[], burst: Element | null): number {
  const impact = TUMBLE_MS + PAIR_HOLD_MS + PAIR_WINDUP_MS + PAIR_SLAM_MS;
  dice.forEach((die, index) => {
    // The left die spins the other way, so the pair mirrors itself.
    const side = index === 0 ? -1 : 1;
    const apart = side * PAIR_SPREAD;
    animate(die, {
      translateX: [
        { from: apart, to: apart, duration: TUMBLE_MS + PAIR_HOLD_MS },
        { to: apart * 1.28, duration: PAIR_WINDUP_MS, ease: "outQuad" },
        { to: 0, duration: PAIR_SLAM_MS, ease: "inExpo" },
      ],
      rotate: [
        { from: 0, to: side * 900, duration: TUMBLE_MS, ease: "outCubic" },
        { to: side * 900, duration: PAIR_HOLD_MS },
        { to: side * 880, duration: PAIR_WINDUP_MS, ease: "outQuad" },
        { to: side * 1080, duration: PAIR_SLAM_MS, ease: "inExpo" },
      ],
      scale: [
        { from: PAIR_SIZE * 0.7, to: PAIR_SIZE, duration: TUMBLE_MS, ease: "outCubic" },
        { to: PAIR_SIZE, duration: PAIR_HOLD_MS },
        { to: PAIR_SIZE * 0.88, duration: PAIR_WINDUP_MS, ease: "outQuad" },
        { to: PAIR_SIZE * 1.1, duration: PAIR_SLAM_MS, ease: "inExpo" },
        { to: 1.4, duration: PAIR_FLASH_MS, ease: "outQuad" },
      ],
      opacity: [
        { from: 1, to: 1, duration: impact },
        { to: 0, duration: PAIR_FLASH_MS, ease: "outQuad" },
      ],
    });
  });
  // A ring thrown out by the impact.
  if (burst) {
    // Held invisible until the impact: a plain `delay` would show its
    // starting frame for the whole roll.
    animate(burst, {
      opacity: [
        { from: 0, to: 0, duration: impact - 1 },
        { to: 0.9, duration: 1 },
        { to: 0, duration: 520, ease: "outExpo" },
      ],
      scale: [
        { from: 0.3, to: 0.3, duration: impact },
        { to: 2.1, duration: 520, ease: "outExpo" },
      ],
    });
  }
  return impact;
}

/** An enemy roll: the card pops in, the die tumbles where the number will
    be, then gives way to the result. A d100 has two d10s, which get their
    own ending (see tumblePair). The dice only exist for this: they are
    hidden in CSS, so without the animation the card just shows the number. */
export function rollIn(card: Element): void {
  if (!motionAllowed()) return;
  animate(card, { opacity: [0, 1], scale: [0.6, 1], duration: 450, ease: "outBack" });

  const dice = [...card.querySelectorAll(".roll-card__die")];
  const value = card.querySelector(".roll-card__value");
  if (dice.length === 0 || !value) return;
  utils.set(value, { opacity: 0 });
  const landsAt =
    dice.length > 1
      ? tumblePair(dice, card.querySelector(".roll-card__burst"))
      : tumbleDie(dice[0]!);
  landValue(value, landsAt);
}
