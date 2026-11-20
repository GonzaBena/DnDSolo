import { useEffect, useRef, useState } from "react";
import { dieSides, formatDice } from "../domain/dice";
import { DICE, type Die, type PlayerRollRequest } from "../domain/types";
import { DieShape } from "./DieShape";

interface Props {
  open: boolean;
  /** The roll the DM asked for, if any, shown as a reminder. */
  request: PlayerRollRequest | null;
  onClose: () => void;
  onSubmit: (roll: {
    die: Die;
    count: number;
    value: number;
    modifier: number;
  }) => void;
}

/** Quick way to report a roll made with the player's own dice: the value
    shown on the die plus the modifier, instead of typing it out. */
export function RollDialog({ open, request, onClose, onSubmit }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState("");
  // The modifier survives between rolls: the same check often repeats.
  const [modifier, setModifier] = useState("0");
  // Only chosen by hand for rolls nobody asked for; otherwise it's the
  // die in the DM's request.
  const [chosenDie, setChosenDie] = useState<Die>("d20");
  const die = request?.die ?? chosenDie;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setValue("");
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const parsedValue = Number.parseInt(value, 10);
  const parsedModifier = Number.parseInt(modifier, 10) || 0;
  const count = request?.count ?? 1;
  const maxValue = dieSides(die) * count;
  const valid =
    Number.isInteger(parsedValue) &&
    parsedValue >= 1 &&
    parsedValue <= maxValue;

  return (
    <dialog
      ref={dialogRef}
      className="roll-dialog"
      aria-labelledby="roll-dialog-title"
      onClose={onClose}
      // A click on the dialog itself (not its form) is a click on the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="roll-dialog__panel"
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          onSubmit({
            die,
            count,
            value: parsedValue,
            modifier: parsedModifier,
          });
        }}
      >
        <h2 id="roll-dialog-title" className="roll-dialog__title">
          Tu tirada
        </h2>
        {request && (
          <p className="roll-dialog__request">
            {formatDice(request)}
            {request.difficulty !== null &&
              ` · CD ${request.difficulty}`} — {request.reason}
          </p>
        )}
        {!request && (
          <fieldset className="roll-dialog__dice">
            <legend>Dado</legend>
            {DICE.map((option) => (
              <label key={option} className="roll-dialog__die" title={option}>
                <input
                  type="radio"
                  name="roll-die"
                  value={option}
                  checked={die === option}
                  onChange={() => setChosenDie(option)}
                />
                <span className="roll-dialog__die-shape">
                  <DieShape die={option} className="roll-dialog__die-svg" />
                </span>
                <span className="roll-dialog__die-name">{option}</span>
              </label>
            ))}
          </fieldset>
        )}
        <div className="roll-dialog__fields">
          <div className="field">
            <label htmlFor="roll-value">
              {count > 1 ? `Suma de ${count}${die}` : "Resultado"}
            </label>
            <input
              id="roll-value"
              type="number"
              inputMode="numeric"
              min={1}
              max={maxValue}
              required
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          <span className="roll-dialog__op" aria-hidden="true">
            +
          </span>
          <div className="field">
            <label htmlFor="roll-modifier">Modificador</label>
            <input
              id="roll-modifier"
              type="number"
              inputMode="numeric"
              value={modifier}
              onChange={(event) => setModifier(event.target.value)}
            />
          </div>
          <span className="roll-dialog__op" aria-hidden="true">
            =
          </span>
          <output
            className="roll-dialog__total"
            htmlFor="roll-value roll-modifier"
          >
            {valid ? parsedValue + parsedModifier : "—"}
          </output>
        </div>
        <div className="actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="button button--primary"
            disabled={!valid}
          >
            Enviar tirada
          </button>
        </div>
      </form>
    </dialog>
  );
}
