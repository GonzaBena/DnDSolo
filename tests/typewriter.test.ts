import { afterEach, describe, expect, it, vi } from "vitest";
import { createTypewriter } from "../src/game/typewriter";

function fakeDoc(state: "visible" | "hidden") {
  const listeners = new Set<() => void>();
  return {
    visibilityState: state as DocumentVisibilityState,
    addEventListener: (_: string, fn: () => void) => void listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => void listeners.delete(fn),
    listeners,
    hide() {
      this.visibilityState = "hidden";
      for (const fn of [...listeners]) fn();
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("typewriter in a hidden tab", () => {
  it("finish reveals everything at once when already hidden", async () => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const doc = fakeDoc("hidden");
    const shown: string[] = [];
    const tw = createTypewriter((text) => shown.push(text), doc as never);
    tw.setTarget("hola mundo");
    await tw.finish();
    expect(shown.at(-1)).toBe("hola mundo");
  });

  it("finish resolves when the tab becomes hidden mid-reveal and drops its listener", async () => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const doc = fakeDoc("visible");
    const shown: string[] = [];
    const tw = createTypewriter((text) => shown.push(text), doc as never);
    tw.setTarget("hola mundo");
    const done = tw.finish();
    expect(doc.listeners.size).toBe(1);
    doc.hide();
    await done;
    expect(shown.at(-1)).toBe("hola mundo");
    expect(doc.listeners.size).toBe(0);
  });

  it("cancel removes the listener", async () => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const doc = fakeDoc("visible");
    const tw = createTypewriter(() => {}, doc as never);
    tw.setTarget("hola");
    const done = tw.finish();
    tw.cancel();
    await done;
    expect(doc.listeners.size).toBe(0);
  });

  it("flush reveals the buffered text at once and settles finish", async () => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const doc = fakeDoc("visible");
    const shown: string[] = [];
    const tw = createTypewriter((text) => shown.push(text), doc as never);
    tw.setTarget("hola mundo");
    const done = tw.finish();
    tw.flush();
    await done;
    expect(shown.at(-1)).toBe("hola mundo");
    expect(doc.listeners.size).toBe(0);
  });
});
