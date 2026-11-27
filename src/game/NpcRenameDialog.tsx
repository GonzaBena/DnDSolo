import { useEffect, useState } from "react";
import { useAnimatedDialog } from "../animations/useAnimatedDialog";
import { NPC_LABEL_MAX, NPC_NAME_MAX } from "../domain/npcRename";
import type { Npc } from "../domain/types";

interface Props {
  /** The NPC being renamed; null keeps the dialog closed. */
  npc: Npc | null;
  onClose: () => void;
  /** Resolves to an error message to show, or null once saved. */
  onSubmit: (name: string, label: string) => Promise<string | null>;
  /** A turn is running: the rename would land on an older state. */
  disabled?: boolean;
}

/** The player's own name and label for an NPC (a tamed wolf becomes
    "Colmillo", "Domesticado"). */
export function NpcRenameDialog({ npc, onClose, onSubmit, disabled = false }: Props) {
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dialogProps = useAnimatedDialog(npc !== null, onClose);

  useEffect(() => {
    if (!npc) return;
    setName(npc.name);
    setLabel(npc.label ?? "");
    setError(null);
  }, [npc]);

  const valid = name.trim() !== "";

  return (
    <dialog {...dialogProps} className="roll-dialog" aria-labelledby="npc-rename-title">
      <form
        className="roll-dialog__panel"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!valid || disabled || saving) return;
          setSaving(true);
          try {
            const message = await onSubmit(name, label);
            if (message) setError(message);
            else onClose();
          } finally {
            setSaving(false);
          }
        }}
      >
        <h2 id="npc-rename-title" className="roll-dialog__title">
          Editar personaje
        </h2>
        <div className="field">
          <label htmlFor="npc-name">Nombre</label>
          <input
            id="npc-name"
            type="text"
            maxLength={NPC_NAME_MAX}
            required
            autoFocus
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="npc-label">Etiqueta (opcional)</label>
          <input
            id="npc-label"
            type="text"
            maxLength={NPC_LABEL_MAX}
            autoComplete="off"
            placeholder="Domesticado, Aliado, Mascota…"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <p className="npc-rename__hint">Reemplaza a «Amistoso» o «Neutral». Si se vuelve hostil, se ve «Hostil».</p>
        </div>
        {error && (
          <p className="npc-rename__error" role="alert">
            {error}
          </p>
        )}
        {disabled && <p className="npc-rename__hint">Esperá a que el DM termine el turno.</p>}
        <div className="actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button button--primary" disabled={!valid || disabled || saving}>
            Guardar
          </button>
        </div>
      </form>
    </dialog>
  );
}

/** The small pencil that opens the dialog, next to an NPC's tag. */
export function NpcEditButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button type="button" className="npc-edit" onClick={onClick} aria-label={`Editar a ${name}`} title="Cambiar nombre o etiqueta">
      ✎
    </button>
  );
}
