import { useEffect, useRef, useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Signed: negative for damage, positive for healing. */
  onSubmit: (delta: number) => void;
  /** A turn is running: a fix would be dropped, so it cannot be applied. */
  disabled?: boolean;
}

/** Manual hit point fix: an amount plus whether it is damage or healing. */
export function HpDialog({ open, onClose, onSubmit, disabled = false }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"damage" | "healing">("damage");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setAmount("");
      setKind("damage");
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const parsed = Number(amount);
  const valid = /^\d+$/.test(amount.trim()) && Number.isInteger(parsed) && parsed > 0;

  return (
    <dialog
      ref={dialogRef}
      className="roll-dialog"
      aria-labelledby="hp-dialog-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="roll-dialog__panel"
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid || disabled) return;
          onSubmit(kind === "damage" ? -parsed : parsed);
        }}
      >
        <h2 id="hp-dialog-title" className="roll-dialog__title">
          Corregir PG
        </h2>
        <fieldset className="roll-dialog__modes">
          <legend>Tipo</legend>
          {(
            [
              ["damage", "Daño"],
              ["healing", "Curación"],
            ] as const
          ).map(([option, label]) => (
            <label key={option} className="roll-dialog__mode">
              <input
                type="radio"
                name="hp-kind"
                value={option}
                checked={kind === option}
                onChange={() => setKind(option)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <div className="field">
          <label htmlFor="hp-amount">Cantidad</label>
          <input
            id="hp-amount"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            autoFocus
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <div className="actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button button--primary" disabled={!valid || disabled}>
            Aplicar
          </button>
        </div>
      </form>
    </dialog>
  );
}
