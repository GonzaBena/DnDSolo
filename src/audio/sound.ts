// Short sound effects for the game's key moments, played with Web Audio so
// they land on time (an <audio> element lags on iOS) and can overlap.
// Browsers keep audio locked until the page is touched: nothing plays before
// the first tap or key, and anything that fails just stays silent.

export type SoundId =
  | "dice"
  | "chapter"
  | "ambush"
  | "hit"
  | "heartbeat"
  | "loot"
  | "questDone"
  | "questFailed"
  | "levelUp"
  | "gameOver";

export const SOUND_IDS: readonly SoundId[] = [
  "dice",
  "chapter",
  "ambush",
  "hit",
  "heartbeat",
  "loot",
  "questDone",
  "questFailed",
  "levelUp",
  "gameOver",
];

const STORAGE_KEY = "dnsolo.sound";

/** On unless the player turned it off on this device. */
export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Blocked storage: the choice can't be kept.
  }
}

let context: AudioContext | null = null;
let primed = false;
const buffers = new Map<SoundId, AudioBuffer>();
// iOS counts touchend (not touchstart's pointerdown) as the gesture that
// lets audio start, so every kind of tap is tried.
const UNLOCK_EVENTS = ["pointerdown", "touchend", "click", "keydown"] as const;

async function load(audio: AudioContext, id: SoundId): Promise<void> {
  try {
    const response = await fetch(`/sounds/${id}.mp3`);
    if (!response.ok) return;
    buffers.set(id, await audio.decodeAudioData(await response.arrayBuffer()));
  } catch {
    // A missing or broken file only silences that one sound.
  }
}

function stopListening(): void {
  for (const type of UNLOCK_EVENTS) document.removeEventListener(type, unlock, true);
}

/** Whether the current audio has played before: if it stops waking up
    after that, it is stuck (iOS after a call or an app switch). */
let hadRun = false;

/** Fresh audio in place of one that won't wake; the decoded sounds work
    with any context, so nothing is loaded again. */
function replace(stuck: AudioContext): void {
  if (stuck !== context) return;
  void stuck.close().catch(() => {});
  context = new AudioContext();
  hadRun = false;
}

/** Wakes audio up on every tap or key: browsers only let it start (and
    iOS only lets it come back after a call or an app switch) during one. */
function unlock(): void {
  try {
    if (!context) {
      if (typeof AudioContext === "undefined") return stopListening();
      context = new AudioContext();
      for (const id of SOUND_IDS) void load(context, id);
    }
    const audio = context;
    if (audio.state === "running") {
      hadRun = true;
      return;
    }
    void audio
      .resume()
      .then(() => {
        if (audio.state === "running") hadRun = true;
        else if (hadRun) replace(audio);
      })
      .catch(() => {});
  } catch {
    // Silence rather than an error on a tap.
  }
}

/** Gets the sounds ready: they unlock and load on the first tap or key. */
export function primeSounds(): void {
  if (primed) return;
  primed = true;
  for (const type of UNLOCK_EVENTS) document.addEventListener(type, unlock, true);
}

/** Plays a sound at `volume` (0 to 1), if sound is on and it is ready. */
export function play(id: SoundId, volume = 1): void {
  if (!context || !soundEnabled()) return;
  // iOS suspends audio on calls or when switching apps; a play comes
  // right after a tap, so asking again usually brings it back.
  if (context.state !== "running") void context.resume().catch(() => {});
  const buffer = buffers.get(id);
  if (!buffer) return;
  try {
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(gain).connect(context.destination);
    source.start();
  } catch {
    // Silence rather than an error in the middle of a turn.
  }
}

export function resetSoundsForTests(): void {
  stopListening();
  context = null;
  hadRun = false;
  primed = false;
  buffers.clear();
}
