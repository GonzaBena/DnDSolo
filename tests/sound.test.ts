// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { play, primeSounds, resetSoundsForTests, setSoundEnabled, soundEnabled } from "../src/audio/sound";

/** A stand-in AudioContext that records each sound started and its volume. */
function fakeAudio() {
  const started: { gain: number }[] = [];
  class FakeContext {
    state = "running";
    destination = {};
    resume = () => Promise.resolve();
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
  return started;
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

  it("never throws without Web Audio or files", async () => {
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    await unlock();
    expect(() => play("hit")).not.toThrow();
  });
});
