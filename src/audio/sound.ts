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
const UNLOCK_EVENTS = ["pointerdown", "keydown"] as const;

async function load(audio: AudioContext, id: SoundId): Promise<void> {
  try {
    const response = await fetch(`/sounds/${id}.mp3`);
    if (!response.ok) return;
    buffers.set(id, await audio.decodeAudioData(await response.arrayBuffer()));
  } catch {
    // A missing or broken file only silences that one sound.
  }
}

function unlock(): void {
  for (const type of UNLOCK_EVENTS) document.removeEventListener(type, unlock, true);
  try {
    if (typeof AudioContext === "undefined") return;
    context = new AudioContext();
    const audio = context;
    void audio.resume().catch(() => {});
    for (const id of SOUND_IDS) void load(audio, id);
  } catch {
    context = null;
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
  for (const type of UNLOCK_EVENTS) document.removeEventListener(type, unlock, true);
  context = null;
  primed = false;
  buffers.clear();
}
