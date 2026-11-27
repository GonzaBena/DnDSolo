import { useRef, useState } from "react";
import { useAnimatedDialog } from "../animations/useAnimatedDialog";
import { heroPortraitUrl, heroPortraitsFor } from "../domain/heroPortraits";
import { initials } from "../game/NpcAvatar";
import "./portrait-picker.css";

/** A round face: the portrait, or the initials when there is none. */
export function PortraitFace({ portrait, name, size = "md" }: { portrait: string | null; name: string; size?: "md" | "lg" }) {
  const url = heroPortraitUrl(portrait);
  return (
    <span className={`portrait-face portrait-face--${size}`} aria-hidden="true">
      {url ? <img src={url} alt="" decoding="async" /> : initials(name.trim() || "?")}
    </span>
  );
}

/**
 * The player's face and a button to change it: a modal with the class's
 * portraits and, always, the initials. Nothing to show for a class without
 * portraits. `badge` shows a large face with a small pencil on it instead
 * of the face and a labelled button.
 */
export function PortraitChooser({
  classId,
  name,
  value,
  onPick,
  disabled = false,
  variant = "button",
}: {
  classId: string | null;
  name: string;
  value: string | null;
  onPick: (portrait: string | null) => void;
  disabled?: boolean;
  variant?: "button" | "badge";
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const dialogProps = useAnimatedDialog(open, () => setOpen(false), triggerRef);
  const options = heroPortraitsFor(classId);

  if (options.length === 0) return null;
  const pick = (portrait: string | null) => {
    onPick(portrait);
    setOpen(false);
  };
  const tiles: (string | null)[] = [...options, null];
  const label = value ? "Cambiar retrato" : "Elegir retrato";

  return (
    <div className={`portrait-chooser portrait-chooser--${variant}`}>
      <PortraitFace portrait={value} name={name} size={variant === "badge" ? "lg" : "md"} />
      {variant === "badge" ? (
        <button
          ref={triggerRef}
          type="button"
          className="portrait-chooser__pencil"
          aria-label={label}
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20h4L19 9l-4-4L4 16z" />
          </svg>
        </button>
      ) : (
        <button ref={triggerRef} type="button" className="button button--small" disabled={disabled} onClick={() => setOpen(true)}>
          {label}
        </button>
      )}
      <dialog {...dialogProps} className="portrait-picker" aria-labelledby="portrait-picker-title">
        <div className="portrait-picker__panel">
          <header className="portrait-picker__header">
            <h2 id="portrait-picker-title">Tu retrato</h2>
            <button type="button" className="portrait-picker__close" aria-label="Cerrar" onClick={() => setOpen(false)}>
              ×
            </button>
          </header>
          <ul className="portrait-picker__grid">
            {tiles.map((portrait) => (
              <li key={portrait ?? "initials"}>
                <button
                  type="button"
                  className="portrait-picker__tile"
                  aria-pressed={portrait === value}
                  onClick={() => pick(portrait)}
                >
                  <PortraitFace portrait={portrait} name={name} size="lg" />
                  <span>{portrait === null ? "Iniciales" : portrait.endsWith("-female") ? "Ella" : "Él"}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </div>
  );
}
