import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { enterBanner, leaveBanner } from "../animations/motion";
import { groupArrivals, type ArrivalGroup } from "../domain/arrivals";
import type { Arrival } from "../domain/types";
import { NpcAvatar } from "./NpcAvatar";

const SHOWN_MS = 2500;

/** At most `max` places in the row: past that, the last place becomes a
    "+N" chip for the rest, so the banner stays one line on a phone. */
export function bannerSlots(
  groups: readonly ArrivalGroup[],
  max = 4,
): { shown: ArrivalGroup[]; hidden: number } {
  if (groups.length <= max) return { shown: [...groups], hidden: 0 };
  return { shown: groups.slice(0, max - 1), hidden: groups.length - (max - 1) };
}

/** The banner state once the banner with `key` has left: cleared, unless a
    newer ambush has replaced it meanwhile (its exit must not close that one). */
export function dismissAmbush<T extends { key: number }>(current: T | null, key: number): T | null {
  return current?.key === key ? null : current;
}

/** The banner's content: the title and a row of faces. Hidden from screen
    readers: the turn's announcement already names who arrived. */
export function AmbushStrip({ arrivals }: { arrivals: readonly Arrival[] }) {
  const { shown, hidden } = bannerSlots(groupArrivals(arrivals));
  return (
    <div className="ambush__inner" aria-hidden="true">
      <strong className="ambush__title">⚔ ¡Emboscada! ⚔</strong>
      <ul className="ambush__row">
        {shown.map((group, index) => (
          <li key={index} className="ambush__member">
            <span className="ambush__face">
              <NpcAvatar
                name={group.lead.name}
                npc={{
                  name: group.lead.name,
                  description: "",
                  attitude: group.lead.attitude,
                  present: true,
                  voice: "",
                  portrait: group.lead.portrait,
                  hp: null,
                  maxHp: null,
                }}
                size="lg"
              />
              {group.count > 1 && <span className="ambush__count">×{group.count}</span>}
            </span>
            <span className="ambush__name">{group.name}</span>
          </li>
        ))}
        {hidden > 0 && (
          <li className="ambush__more" aria-label={`y ${hidden} más`}>
            +{hidden}
          </li>
        )}
      </ul>
    </div>
  );
}

/** Hostiles burst in as combat starts: a strip drops from the top for a
    moment, then leaves on its own (or on a tap). Only for live turns. */
export function AmbushBanner({ arrivals, onDone }: { arrivals: readonly Arrival[]; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const leavingRef = useRef(false);
  const cancelLeaveRef = useRef<(() => void) | null>(null);

  const leave = () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    if (ref.current) cancelLeaveRef.current = leaveBanner(ref.current, onDone);
    else onDone();
  };

  useEffect(() => {
    if (ref.current) {
      enterBanner(ref.current);
      // The toasts move below the banner while it is up (arrivals.css).
      document.documentElement.style.setProperty("--ambush-height", `${ref.current.offsetHeight}px`);
    }
    const timer = setTimeout(leave, SHOWN_MS);
    return () => {
      clearTimeout(timer);
      cancelLeaveRef.current?.();
      document.documentElement.style.removeProperty("--ambush-height");
    };
    // Mount-only: each ambush mounts a fresh banner (keyed by the caller).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (typeof document === "undefined") return null;
  // On <body>, like the toasts, so the sticky header can't cover it.
  return createPortal(
    <div ref={ref} className="ambush" onClick={leave}>
      <AmbushStrip arrivals={arrivals} />
    </div>,
    document.body,
  );
}
