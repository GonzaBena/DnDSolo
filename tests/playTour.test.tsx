// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePlayTourSteps, START_TOUR_EVENT, TOUR_STORAGE_KEY } from "../src/game/tour/steps";

const driveMock = vi.fn();
const destroyMock = vi.fn();
let lastConfig: { onDestroyed?: () => void; steps?: unknown[]; nextBtnText?: string } | undefined;

vi.mock("driver.js", () => ({
  driver: vi.fn((config) => {
    lastConfig = config;
    return {
      drive: driveMock,
      destroy: destroyMock,
    };
  }),
}));

import { usePlayTour } from "../src/game/tour/usePlayTour";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mountPlayDom({ withSuggestions = false, desktopScene = true } = {}) {
  document.body.innerHTML = `
    <div data-tour="log"></div>
    <textarea data-tour="composer"></textarea>
    <div data-tour="suggestions" class="suggestions-slot${withSuggestions ? " suggestions-slot--open" : ""}"></div>
    <button data-tour="roll"></button>
    <div data-tour="hp"></div>
    <aside data-tour="scene-panel" data-visible="${desktopScene ? "1" : "0"}"></aside>
    <button data-tour="scene-button" data-visible="${desktopScene ? "0" : "1"}"></button>
    <button data-tour="info"></button>
  `;
}

function Harness({ ready, onBeforeStart }: { ready: boolean; onBeforeStart?: () => void }) {
  usePlayTour({ ready, onBeforeStart });
  return null;
}

describe("resolvePlayTourSteps", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("includes suggestions only when open and picks the visible scene element", () => {
    mountPlayDom({ withSuggestions: false, desktopScene: true });
    const desktopSteps = resolvePlayTourSteps(
      document,
      (el) => el.getAttribute("data-visible") !== "0",
    );
    expect(desktopSteps.map((s) => s.element)).toEqual([
      '[data-tour="log"]',
      '[data-tour="composer"]',
      '[data-tour="roll"]',
      '[data-tour="hp"]',
      '[data-tour="scene-panel"]',
      '[data-tour="info"]',
    ]);

    mountPlayDom({ withSuggestions: true, desktopScene: false });
    const mobileSteps = resolvePlayTourSteps(
      document,
      (el) => el.getAttribute("data-visible") !== "0",
    );
    expect(mobileSteps.map((s) => s.element)).toEqual([
      '[data-tour="log"]',
      '[data-tour="composer"]',
      '[data-tour="suggestions"].suggestions-slot--open',
      '[data-tour="roll"]',
      '[data-tour="hp"]',
      '[data-tour="scene-button"]',
      '[data-tour="info"]',
    ]);
  });
});

describe("usePlayTour", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    driveMock.mockClear();
    destroyMock.mockClear();
    lastConfig = undefined;
    mountPlayDom({ withSuggestions: false, desktopScene: true });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const visible = this.getAttribute("data-visible") !== "0";
      return {
        width: visible ? 100 : 0,
        height: visible ? 40 : 0,
        top: 0,
        left: 0,
        right: visible ? 100 : 0,
        bottom: visible ? 40 : 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    });
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("auto-starts once when ready and persists completion on destroy", () => {
    const onBeforeStart = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    act(() => root.render(<Harness ready={false} onBeforeStart={onBeforeStart} />));
    act(() => vi.advanceTimersByTime(500));
    expect(driveMock).not.toHaveBeenCalled();

    act(() => root.render(<Harness ready={true} onBeforeStart={onBeforeStart} />));
    act(() => vi.advanceTimersByTime(400));
    expect(onBeforeStart).toHaveBeenCalledTimes(1);
    expect(driveMock).toHaveBeenCalledTimes(1);
    expect(lastConfig?.nextBtnText).toBe("Siguiente");
    expect(lastConfig?.steps).toHaveLength(6);

    lastConfig?.onDestroyed?.();
    expect(localStorage.getItem(TOUR_STORAGE_KEY)).toBe("done");

    act(() => root.unmount());
  });

  it("skips auto-start if already seen, but replays on START_TOUR_EVENT", () => {
    localStorage.setItem(TOUR_STORAGE_KEY, "done");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    act(() => root.render(<Harness ready={true} />));
    act(() => vi.advanceTimersByTime(500));
    expect(driveMock).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new CustomEvent(START_TOUR_EVENT));
    });
    expect(driveMock).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    expect(destroyMock).toHaveBeenCalledTimes(1);
  });
});
