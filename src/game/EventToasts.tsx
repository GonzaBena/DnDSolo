import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { enterToast, flyToTarget, leaveToast } from "../animations/motion";

export interface ToastItem {
  id: string;
  kind: "item" | "loot" | "quest" | "combat" | "level" | "info" | "damage" | "healing";
  title: string;
  detail?: string;
  /** How long it stays before leaving on its own; 4800 ms if unset. */
  holdMs?: number;
}

interface ToastCardProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

function ToastCard({ toast, onDismiss }: ToastCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const leavingRef = useRef(false);

  useEffect(() => {
    if (ref.current) {
      enterToast(ref.current);
    }
  }, []);

  const handleDismiss = () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    if (ref.current) {
      leaveToast(ref.current, () => onDismiss(toast.id));
    } else {
      onDismiss(toast.id);
    }
  };

  // A loot card leaves on its own by flying to the inventory (the Info
  // button); closing it by hand is a plain exit.
  const leaveOnTime = () => {
    if (toast.kind !== "loot") return handleDismiss();
    if (leavingRef.current) return;
    leavingRef.current = true;
    if (ref.current) {
      flyToTarget(ref.current, document.querySelector("[data-inventory-target]"), () => onDismiss(toast.id));
    } else {
      onDismiss(toast.id);
    }
  };

  useEffect(() => {
    const timer = setTimeout(leaveOnTime, toast.holdMs ?? 4800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  const ICONS: Record<ToastItem["kind"], string> = {
    item: "🎒",
    loot: "🎒",
    quest: "📜",
    combat: "⚔️",
    level: "⭐",
    damage: "💥",
    healing: "🌿",
    info: "💡",
  };

  return (
    <div ref={ref} className="toast" data-kind={toast.kind} role="status">
      <span className="toast__icon" aria-hidden="true">
        {ICONS[toast.kind]}
      </span>
      <div className="toast__content">
        <strong className="toast__title">{toast.title}</strong>
        {toast.detail && <span className="toast__detail">{toast.detail}</span>}
      </div>
      <button
        type="button"
        className="toast__close"
        aria-label="Cerrar notificación"
        onClick={handleDismiss}
      >
        ×
      </button>
    </div>
  );
}

export function EventToasts({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0 || typeof document === "undefined") return null;

  // Rendered on <body>: inside the page they would share its stacking
  // context (the view transition gives it one) and slide under the sticky
  // header whatever their z-index.
  return createPortal(
    <aside className="toasts-container" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </aside>,
    document.body,
  );
}
