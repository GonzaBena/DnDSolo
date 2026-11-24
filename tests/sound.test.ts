// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { play, primeSounds, resetSoundsForTests, setSoundEnabled, soundEnabled } from "../src/audio/sound";

/** A stand-in AudioContext that records each sound started and its volume. */
function fakeAudio(initialState = "running") {
  const started: { gain: number }[] = [];
  const contexts: FakeContext[] = [];
  class FakeContext {
    state = initialState;
    resumes = 0;
    destination = {};
    constructor() {
      contexts.push(this);
    }
    resume = () => {
      this.resumes += 1;
      return Promise.resolve();
    };
    close = () => Promise.resolve();
    decodeAudioData = () => Promise.resolve({});
    createGain() {
      const node = { gain: { value: 1 }, connect: () => node };
      return node;
    }
    createBufferSource() {
      let gainNode: { gain: { value: number } } | null = null;
      return {
        buffer: null,
        connect(node: { gain: { value: number } }) {
          gainNode = node;
          return node;
        },
        start() {
          started.push({ gain: gainNode?.gain.value ?? 1 });
        },
      };
    }
  }
  vi.stubGlobal("AudioContext", FakeContext);
  vi.stubGlobal("fetch", () => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }));
  // Not enumerable, so `started` still compares as a plain list.
  Object.defineProperty(started, "contexts", { value: contexts });
  return started as typeof started & { contexts: FakeContext[] };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function unlock() {
  primeSounds();
  document.dispatchEvent(new Event("pointerdown"));
  await settle();
  await settle();
}

beforeEach(() => {
  localStorage.clear();
  resetSoundsForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sound preference", () => {
  it("is on by default", () => {
    expect(soundEnabled()).toBe(true);
  });

  it("remembers being turned off", () => {
    setSoundEnabled(false);
    expect(soundEnabled()).toBe(false);
    expect(localStorage.getItem("dnsolo.sound")).toBe("off");
  });

  it("is on when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(soundEnabled()).toBe(true);
  });
});

describe("play", () => {
  it("stays silent until the page is touched", () => {
    const started = fakeAudio();
    primeSounds();
    play("dice");
    expect(started).toEqual([]);
  });

  it("plays at the given volume once unlocked", async () => {
    const started = fakeAudio();
    await unlock();
    play("dice", 0.5);
    expect(started).toEqual([{ gain: 0.5 }]);
  });

  it("checks the switch on every call", async () => {
    const started = fakeAudio();
    await unlock();
    setSoundEnabled(false);
    play("dice");
    expect(started).toEqual([]);
  });

  it("keeps trying to unlock while the browser holds audio back", async () => {
    const { contexts } = fakeAudio("suspended");
    await unlock();
    document.dispatchEvent(new Event("touchend"));
    expect(contexts).toHaveLength(1);
    expect(contexts[0]!.resumes).toBe(2);
  });

  it("a tap while audio runs leaves it alone", async () => {
    const { contexts } = fakeAudio("running");
    await unlock();
    document.dispatchEvent(new Event("pointerdown"));
    expect(contexts).toHaveLength(1);
    expect(contexts[0]!.resumes).toBe(0);
  });

  it("a tap after switching apps wakes the audio iOS paused", async () => {
    const { contexts } = fakeAudio("running");
    await unlock();
    contexts[0]!.state = "interrupted";
    contexts[0]!.resume = () => {
      contexts[0]!.resumes += 1;
      contexts[0]!.state = "running";
      return Promise.resolve();
    };
    document.dispatchEvent(new Event("touchend"));
    await settle();
    expect(contexts[0]!.resumes).toBe(1);
    expect(contexts).toHaveLength(1);
  });

  it("starts over with fresh audio when the paused one won't wake", async () => {
    const started = fakeAudio("running");
    await unlock();
    started.contexts[0]!.state = "interrupted";
    document.dispatchEvent(new Event("touchend"));
    await settle();
    await settle();
    expect(started.contexts).toHaveLength(2);
    play("dice");
    expect(started).toHaveLength(1);
  });

  it("wakes audio that was suspended after unlocking (iOS calls, app switch)", async () => {
    const started = fakeAudio("running");
    await unlock();
    const audio = started.contexts[0]!;
    audio.state = "interrupted";
    const before = audio.resumes;
    play("dice");
    expect(audio.resumes).toBe(before + 1);
  });

  it("never throws without Web Audio or files", async () => {
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    await unlock();
    expect(() => play("hit")).not.toThrow();
  });
});
