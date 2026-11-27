import { useCallback, useEffect, useRef } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./play-tour.css";
import { resolvePlayTourSteps, START_TOUR_EVENT, TOUR_STORAGE_KEY } from "./steps";

const AUTO_START_DELAY_MS = 350;

export function markTourDone(): void {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, "done");
  } catch {
    // Blocked storage: the tour still closes cleanly for this visit.
  }
}

export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === "done";
  } catch {
    return false;
  }
}

interface Options {
  /** True once the game is on screen without a blocking modal (level-up, recap, upgrade). */
  ready: boolean;
  /** Runs right before measuring targets (e.g. exit zen mode and close drawers). */
  onBeforeStart?: () => void;
}

export function usePlayTour({ ready, onBeforeStart }: Options) {
  const activeRef = useRef<Driver | null>(null);
  const autoCheckedRef = useRef(false);
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const onBeforeStartRef = useRef(onBeforeStart);
  onBeforeStartRef.current = onBeforeStart;

  const startTour = useCallback(() => {
    if (!readyRef.current) return;
    onBeforeStartRef.current?.();

    requestAnimationFrame(() => {
      const steps = resolvePlayTourSteps();
      if (steps.length === 0) return;

      activeRef.current?.destroy();
      const reducedMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const instance = driver({
        animate: !reducedMotion,
        smoothScroll: !reducedMotion,
        showProgress: true,
        allowClose: true,
        allowKeyboardControl: true,
        disableActiveInteraction: true,
        stagePadding: 6,
        stageRadius: 12,
        popoverOffset: 12,
        overlayColor: "#1b1512",
        overlayOpacity: 0.68,
        popoverClass: "dnsolo-tour-popover",
        nextBtnText: "Siguiente",
        prevBtnText: "Anterior",
        doneBtnText: "Listo",
        closeBtnLabel: "Cerrar recorrido",
        progressText: "{{current}} de {{total}}",
        steps,
        onDestroyed: () => {
          markTourDone();
          if (activeRef.current === instance) activeRef.current = null;
        },
      });
      activeRef.current = instance;
      instance.drive();
    });
  }, []);

  // Show once on the first visit to /play after the game finishes loading.
  useEffect(() => {
    if (!ready || autoCheckedRef.current) return;
    if (hasSeenTour()) {
      autoCheckedRef.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      autoCheckedRef.current = true;
      startTour();
    }, AUTO_START_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [ready, startTour]);

  // Allow re-launching from the settings popover in Base.astro.
  useEffect(() => {
    const onStart = () => startTour();
    window.addEventListener(START_TOUR_EVENT, onStart);
    return () => window.removeEventListener(START_TOUR_EVENT, onStart);
  }, [startTour]);

  useEffect(() => () => activeRef.current?.destroy(), []);

  return { startTour };
}
