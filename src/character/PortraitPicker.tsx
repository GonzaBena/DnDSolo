import { useEffect, useRef, useState } from "react";
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
 * portraits.
 */
export function PortraitChooser({
  classId,
  name,
  value,
  onPick,
  disabled = false,
}: {
  classId: string | null;
  name: string;
  value: string | null;
  onPick: (portrait: string | null) => void;
  disabled?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const options = heroPortraitsFor(classId);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  if (options.length === 0) return null;
  const pick = (portrait: string | null) => {
    onPick(portrait);
    setOpen(false);
  };
  const tiles: (string | null)[] = [...options, null];

  return (
    <div className="portrait-chooser">
      <PortraitFace portrait={value} name={name} />
      <button type="button" className="button button--small" disabled={disabled} onClick={() => setOpen(true)}>
        {value ? "Cambiar retrato" : "Elegir retrato"}
      </button>
      <dialog
        ref={dialogRef}
        className="portrait-picker"
        aria-labelledby="portrait-picker-title"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
      >
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
