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

/** A chapter separator: the title settles in, a touch larger at first. */
export function enterChapter(element: Element): void {
  if (!motionAllowed()) return;
  // It lands mid-log when the turn commits: open its space gradually so
  // the text being read is eased down instead of jumping, and slide (not
  // scale) so it never grows wider than the column on a phone.
  const el = element as HTMLElement;
  const { height, marginTop, marginBottom } = getComputedStyle(el);
  el.style.overflow = "hidden";
  animate(el, {
    height: ["0px", height],
    marginTop: ["0px", marginTop],
    marginBottom: ["0px", marginBottom],
    duration: 320,
    ease: "outCubic",
    onComplete: () => {
      for (const property of ["height", "margin-top", "margin-bottom", "overflow"]) el.style.removeProperty(property);
    },
  });
  animate(el, { opacity: [0, 1], translateY: [-8, 0], duration: 600, delay: 120, ease: "outCubic" });
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

/** A loot card flying into `target` (the inventory button), shrinking as
    it goes; the target then gives a small pulse. Without motion or without
    a visible target it leaves like any toast. Returns a cancel function. */
export function flyToTarget(element: Element, target: Element | null, onDone: () => void): () => void {
  const to = target?.getBoundingClientRect();
  if (!motionAllowed() || !target || !to || to.width === 0 || to.height === 0) {
    return leaveToast(element, onDone);
  }
  const from = element.getBoundingClientRect();
  const animation = animate(element, {
    translateX: to.left + to.width / 2 - (from.left + from.width / 2),
    translateY: to.top + to.height / 2 - (from.top + from.height / 2),
    scale: 0.2,
    opacity: [1, 0.2],
    duration: 550,
    ease: "inQuad",
    onComplete: () => {
      animate(target, { scale: [1, 1.15, 1], duration: 300, ease: "outQuad" });
      onDone();
    },
  });
  return () => animation.cancel();
}

/** The level-up screen: its content rises in and the star pops. */
export function enterLevelUp(element: Element): void {
  if (!motionAllowed()) return;
  const items = element.querySelectorAll(".level-up__content > *, .level-up__features li, .level-up > .button");
  animate(items, { opacity: [0, 1], translateY: [16, 0], duration: 420, delay: stagger(70), ease: "outCubic" });
  const star = element.querySelector(".level-up__star");
  if (star) animate(star, { scale: [0.2, 1.25, 1], rotate: [-30, 0], duration: 700, ease: "outBack" });
}

/** The ambush banner dropping in from above the screen. */
export function enterBanner(element: Element): void {
  if (!motionAllowed()) return;
  animate(element, { translateY: ["-120%", "0%"], duration: 360, ease: "outBack" });
}

/** The ambush banner going back up; `onDone` runs once it has left.
    Returns a function that stops the animation. */
export function leaveBanner(element: Element, onDone: () => void): () => void {
  if (!motionAllowed()) {
    onDone();
    return () => {};
  }
  const animation = animate(element, {
    translateY: ["0%", "-120%"],
    opacity: [1, 0],
    duration: 260,
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

/** How a roll card comes to rest. `quick` is the plain tumble; `slowdown`
    tumbles twice as long with the faces flickering ever slower and a held
    beat (enemy rolls); `lastTip` nearly stops, rocks and tips one more face
    (a natural 1). */
export type RollStyle = "quick" | "slowdown" | "lastTip";

const SLOWDOWN_SPIN_MS = 1500;
const SLOWDOWN_HOLD_MS = 380;
const TIP_SPIN_MS = 900;
const TIP_ROCK_MS = 520;
const TIP_FALL_MS = 260;
const TIP_HOLD_MS = 260;

/** Faces flashing on the die while it slows down, each one held longer, ending on `final`. */
function flickerFaces(face: Element, sides: number, final: number, total: number): void {
  const randomFace = () => String(1 + Math.floor(Math.random() * sides));
  let at = 0;
  let step = 45;
  while (at + step < total) {
    at += step;
    setTimeout(() => { face.textContent = randomFace(); }, at);
    step *= 1.18;
  }
  setTimeout(() => { face.textContent = String(final); }, total);
}

/** The face and the die fading out together, `at` ms in. */
function hideFaceAt(face: Element, at: number): void {
  animate(face, { opacity: [{ from: 1, to: 1, duration: at }, { to: 0, duration: LEAVE_MS }] });
}

function slowdownDie(die: Element, face: Element | null, sides: number, natural: number): number {
  const leaveAt = SLOWDOWN_SPIN_MS + SLOWDOWN_HOLD_MS / 2;
  animate(die, {
    rotate: { from: 0, to: 1260, duration: SLOWDOWN_SPIN_MS, ease: "outQuart" },
    scale: [
      { from: 0.7, to: 1, duration: SLOWDOWN_SPIN_MS, ease: "outCubic" },
      { to: 1.08, duration: SLOWDOWN_HOLD_MS / 2, ease: "outQuad" },
      { to: 0.3, duration: LEAVE_MS, ease: "inQuad" },
    ],
    opacity: [
      { from: 1, to: 1, duration: leaveAt },
      { to: 0, duration: LEAVE_MS, ease: "inQuad" },
    ],
  });
  if (face) {
    flickerFaces(face, sides, natural, SLOWDOWN_SPIN_MS);
    hideFaceAt(face, leaveAt);
  }
  return SLOWDOWN_SPIN_MS + SLOWDOWN_HOLD_MS;
}

function lastTipDie(die: Element, face: Element | null, sides: number, natural: number): number {
  const settled = TIP_SPIN_MS + TIP_ROCK_MS + TIP_FALL_MS;
  const leaveAt = settled + TIP_HOLD_MS / 2;
  animate(die, {
    rotate: [
      { from: 0, to: 900, duration: TIP_SPIN_MS, ease: "outCubic" },
      { to: 922, duration: TIP_ROCK_MS / 3, ease: "inOutSine" },
      { to: 908, duration: TIP_ROCK_MS / 3, ease: "inOutSine" },
      { to: 918, duration: TIP_ROCK_MS / 3, ease: "inOutSine" },
      { to: 972, duration: TIP_FALL_MS, ease: "inBack" },
    ],
    translateY: [
      { from: 0, to: 0, duration: TIP_SPIN_MS + TIP_ROCK_MS },
      { to: -10, duration: TIP_FALL_MS / 2, ease: "outQuad" },
      { to: 0, duration: TIP_FALL_MS / 2, ease: "outBounce" },
    ],
    scale: [
      { from: 0.7, to: 1, duration: TIP_SPIN_MS, ease: "outCubic" },
      { to: 1, duration: TIP_ROCK_MS + TIP_FALL_MS + TIP_HOLD_MS / 2 },
      { to: 0.3, duration: LEAVE_MS, ease: "inQuad" },
    ],
    opacity: [
      { from: 1, to: 1, duration: leaveAt },
      { to: 0, duration: LEAVE_MS, ease: "inQuad" },
    ],
  });
  if (face) {
    // While it rocks it shows the face next to the result; the last tip turns it over.
    const decoy = natural < sides ? natural + 1 : natural - 1;
    face.textContent = String(1 + Math.floor(Math.random() * sides));
    setTimeout(() => { face.textContent = String(decoy); }, TIP_SPIN_MS - 80);
    setTimeout(() => { face.textContent = String(natural); }, TIP_SPIN_MS + TIP_ROCK_MS + TIP_FALL_MS / 2);
    hideFaceAt(face, leaveAt);
  }
  return settled + TIP_HOLD_MS;
}

/** A natural 20: the card turns gold and glows, the number swells, two rings and a spray of sparks. */
function criticalBurst(card: Element, at: number): void {
  setTimeout(() => card.classList.add("roll-card--critical", "roll-card--glow"), at);
  const value = card.querySelector(".roll-card__value");
  if (value) {
    animate(value, {
      scale: [{ from: 1, to: 1.7, duration: 220, ease: "outQuad" }, { to: 1, duration: 700, ease: "outElastic(1, .45)" }],
      delay: at + 120,
    });
  }
  card.querySelectorAll(".roll-card__ring").forEach((ring, i) => {
    animate(ring, {
      opacity: [{ from: 0, to: 0, duration: 1 }, { to: 0.9, duration: 1 }, { to: 0, duration: 700, ease: "outExpo" }],
      scale: [{ from: 0.4, to: 0.4, duration: 2 }, { to: 3 + i, duration: 700, ease: "outExpo" }],
      delay: at + i * 140,
    });
  });
  const sparks = [...card.querySelectorAll(".roll-card__spark")];
  sparks.forEach((spark, i) => {
    const angle = (i / sparks.length) * Math.PI * 2;
    const distance = 70 + (i % 3) * 18;
    animate(spark, {
      translateX: [0, Math.cos(angle) * distance],
      translateY: [0, Math.sin(angle) * distance],
      scale: [1.2, 0],
      opacity: [{ from: 0, to: 1, duration: 1 }, { to: 0, duration: 650, ease: "inQuad" }],
      duration: 650,
      delay: at + 60,
      ease: "outCubic",
    });
  });
}

const FUMBLE_DROP_MS = 380;

/** A natural 1: the number falls in heavy, the card shudders, cracks and goes red. */
function fumbleCrack(card: Element, at: number): void {
  const hit = at + FUMBLE_DROP_MS;
  setTimeout(() => card.classList.add("roll-card--fumble"), hit);
  const value = card.querySelector(".roll-card__value");
  if (value) {
    animate(value, {
      translateY: [
        { from: -70, to: 0, duration: FUMBLE_DROP_MS, ease: "inQuad" },
        { to: -8, duration: 90, ease: "outQuad" },
        { to: 0, duration: 120, ease: "inQuad" },
      ],
      scale: { from: 1.2, to: 1, duration: FUMBLE_DROP_MS },
      delay: at,
    });
  }
  animate(card, {
    translateX: [{ from: 0, to: -9, duration: 50 }, { to: 8, duration: 60 }, { to: -6, duration: 60 }, { to: 4, duration: 60 }, { to: 0, duration: 70 }],
    rotate: [{ from: 0, to: -1.5, duration: 120 }, { to: 0, duration: 180 }],
    delay: hit,
  });
  const crack = card.querySelector(".roll-card__crack path");
  if (crack) {
    utils.set(crack, { opacity: 0 });
    animate(crack, {
      strokeDashoffset: [{ from: 120, to: 120, duration: 1 }, { to: 0, duration: 260, ease: "outQuad" }],
      opacity: [{ from: 0, to: 0, duration: 1 }, { to: 1, duration: 1 }],
      delay: hit + 20,
    });
  }
}

/** A roll arriving: the card pops in, the die tumbles where the number will
    be, then gives way to the result. A d100 has two d10s, which get their
    own ending (see tumblePair). The dice only exist for this: they are
    hidden in CSS, so without the animation the card just shows the number.
    What would give the result away (a natural's label and colour, the dice
    line) waits for the die to land. Returns when the result lands, in ms. */
export function rollIn(
  card: HTMLElement,
  { style = "quick", sides = 20, natural = null, kept = 0 }: {
    style?: RollStyle; sides?: number; natural?: "critical" | "fumble" | null; kept?: number;
  } = {},
): number {
  if (!motionAllowed()) return 0;
  animate(card, { opacity: [0, 1], scale: [0.6, 1], duration: 450, ease: "outBack" });

  const dice = [...card.querySelectorAll(".roll-card__die")];
  const value = card.querySelector(".roll-card__value");
  if (dice.length === 0 || !value) return 0;
  utils.set(value, { opacity: 0 });
  const face = card.querySelector(".roll-card__face");
  const landsAt =
    dice.length > 1
      ? tumblePair(dice, card.querySelector(".roll-card__burst"))
      : style === "slowdown"
        ? slowdownDie(dice[0]!, face, sides, kept)
        : style === "lastTip"
          ? lastTipDie(dice[0]!, face, sides, kept)
          : tumbleDie(dice[0]!);
  if (natural !== "fumble") landValue(value, landsAt);

  // The label says what kind of roll it is until it lands; the colour of a natural waits too.
  const label = card.querySelector<HTMLElement>(".roll-card__label");
  const plain = label?.dataset.plain;
  if (natural && label && plain) {
    const final = label.textContent;
    label.textContent = plain;
    setTimeout(() => { label.textContent = final; }, landsAt);
  }
  card.classList.remove("roll-card--critical", "roll-card--fumble");
  const meta = card.querySelector(".roll-card__meta");
  if (meta && style !== "quick") {
    utils.set(meta, { opacity: 0 });
    animate(meta, { opacity: [0, 1], duration: 300, delay: landsAt + 200, ease: "outQuad" });
  }
  const verdict = card.querySelector(".roll-card__verdict");
  if (verdict) {
    utils.set(verdict, { opacity: 0 });
    animate(verdict, { opacity: [0, 1], translateY: [6, 0], duration: 320, delay: landsAt + 300, ease: "outCubic" });
  }
  if (natural === "critical") criticalBurst(card, landsAt);
  if (natural === "fumble") {
    // The fumble's number drops in from above instead of popping.
    utils.set(value, { opacity: 0 });
    animate(value, { opacity: [{ from: 0, to: 0, duration: landsAt }, { to: 1, duration: 1 }] });
    fumbleCrack(card, landsAt);
  }
  return natural === "fumble" ? landsAt + FUMBLE_DROP_MS : landsAt;
}

/** Where `origin` sits relative to the centre of the screen, which is where
    a modal dialog is drawn: the offset that puts the dialog over it. */
function offsetFromCenter(origin: Element | null): { x: number; y: number } {
  const box = origin?.getBoundingClientRect();
  if (!box || box.width === 0 || box.height === 0) return { x: 0, y: 24 };
  return {
    x: box.left + box.width / 2 - innerWidth / 2,
    y: box.top + box.height / 2 - innerHeight / 2,
  };
}

/** The roll dialog growing out of the die button. The inline transform
    is cleared at the end. */
export function enterRollDialog(dialog: HTMLElement, origin: Element | null): void {
  if (!motionAllowed()) return;
  const { x, y } = offsetFromCenter(origin);
  animate(dialog, {
    translateX: [x, 0],
    translateY: [y, 0],
    scale: [0.15, 1],
    rotate: [-10, 0],
    opacity: { from: 0, to: 1, duration: 240, ease: "outQuad" },
    duration: 440,
    ease: "outBack",
    onComplete: () => {
      dialog.style.removeProperty("transform");
      dialog.style.removeProperty("opacity");
    },
  });
}

/** The roll dialog leaving: sent, it shrinks back into the die button;
    cancelled, it drops a little and fades. Returns a cancel function. */
export function leaveRollDialog(
  dialog: HTMLElement,
  how: "sent" | "cancelled",
  origin: Element | null,
  onDone: () => void,
): () => void {
  if (!motionAllowed()) {
    onDone();
    return () => {};
  }
  const done = () => {
    dialog.style.removeProperty("transform");
    dialog.style.removeProperty("opacity");
    onDone();
  };
  if (how === "cancelled") {
    const animation = animate(dialog, {
      translateY: [0, 14],
      scale: [1, 0.97],
      opacity: [1, 0],
      duration: 180,
      ease: "inQuad",
      onComplete: done,
    });
    return () => animation.cancel();
  }
  const { x, y } = offsetFromCenter(origin);
  const animation = animate(dialog, {
    translateX: [0, x],
    translateY: [0, y],
    scale: [1, 0.15],
    rotate: [0, 10],
    opacity: [1, 0],
    duration: 300,
    ease: "inCubic",
    onComplete: done,
  });
  return () => animation.cancel();
}

/** A page inside a drawer (the full sheet) sliding in from the right. */
export function enterSubpage(element: Element): void {
  if (!motionAllowed()) return;
  animate(element, { opacity: [0, 1], translateX: [32, 0], duration: 300, ease: "outCubic" });
}

/** That page sliding back out to the right; `onDone` runs once it has left.
    Returns a function that stops the animation. */
export function leaveSubpage(element: Element, onDone: () => void): () => void {
  if (!motionAllowed()) {
    onDone();
    return () => {};
  }
  const animation = animate(element, {
    opacity: [1, 0],
    translateX: [0, 32],
    duration: 200,
    ease: "inCubic",
    onComplete: onDone,
  });
  return () => animation.cancel();
}

/** A small menu popping out of the button that opened it (transform-origin
    in CSS points at the button). */
export function enterMenu(element: Element): void {
  if (!motionAllowed()) return;
  animate(element, { opacity: [0, 1], scale: [0.85, 1], translateY: [8, 0], duration: 220, ease: "outBack" });
}

/** That menu folding back into its button. Returns a cancel function. */
export function leaveMenu(element: Element, onDone: () => void): () => void {
  if (!motionAllowed()) {
    onDone();
    return () => {};
  }
  const animation = animate(element, {
    opacity: [1, 0],
    scale: [1, 0.85],
    translateY: [0, 8],
    duration: 150,
    ease: "inQuad",
    onComplete: onDone,
  });
  return () => animation.cancel();
}
