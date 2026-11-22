import { useEffect, useId, useRef, useState } from "react";
import { dieSides, formatDice, resolveRollMode, rollModeLabel } from "../domain/dice";
import { DICE, type Die, type PlayerRollRequest, type RollMode } from "../domain/types";
import { DieShape } from "./DieShape";

interface Props {
  open: boolean;
  /** The roll the DM asked for, if any, shown as a reminder. */
  request: PlayerRollRequest | null;
  /** A death save: a bare d20 with no modifier, resolved by code. */
  deathSave?: boolean;
  onClose: () => void;
  onSubmit: (roll: {
    die: Die;
    count: number;
    value: number;
    modifier: number;
    mode: RollMode;
    rolls?: [number, number];
  }) => void;
}

/** Quick way to report a roll made with the player's own dice: the value
    shown on the die plus the modifier, instead of typing it out. */
const DEATH_SAVE: PlayerRollRequest = {
  die: "d20",
  count: 1,
  reason: "Salvación contra la muerte",
  difficulty: 10,
  mode: "normal",
};

export function RollDialog({ open, request: asked, deathSave = false, onClose, onSubmit }: Props) {
  const request = deathSave ? DEATH_SAVE : asked;
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Two of these are mounted (any roll and the death save): ids must not clash.
  const uid = useId();
  const ids = {
    title: `${uid}-title`,
    value: `${uid}-value`,
    second: `${uid}-value-2`,
    modifier: `${uid}-modifier`,
  };
  const [value, setValue] = useState("");
  // The modifier survives between rolls: the same check often repeats.
  const [modifier, setModifier] = useState("0");
  // Only chosen by hand for rolls nobody asked for; otherwise it's the
  // die in the DM's request.
  const [chosenDie, setChosenDie] = useState<Die>("d20");
  const [chosenMode, setChosenMode] = useState<RollMode>("normal");
  const [secondValue, setSecondValue] = useState("");
  const die = request?.die ?? chosenDie;
  // Advantage only exists on the d20 when the player picks it by hand.
  const mode: RollMode = request ? request.mode : die === "d20" ? chosenMode : "normal";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setValue("");
      setSecondValue("");
      setChosenMode("normal");
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const parsedValue = Number.parseInt(value, 10);
  const parsedModifier = deathSave ? 0 : Number.parseInt(modifier, 10) || 0;
  const parsedSecond = Number.parseInt(secondValue, 10);
  const twoDice = mode !== "normal";
  // With advantage the system picks the die, so the count is always 1.
  const count = twoDice ? 1 : (request?.count ?? 1);
  const maxValue = dieSides(die) * count;
  const inRange = (n: number) => Number.isInteger(n) && n >= 1 && n <= maxValue;
  const valid = twoDice ? inRange(parsedValue) && inRange(parsedSecond) : inRange(parsedValue);
  const kept =
    twoDice && valid ? resolveRollMode([parsedValue, parsedSecond], mode) : parsedValue;

  return (
    <dialog
      ref={dialogRef}
      className="roll-dialog"
      aria-labelledby={ids.title}
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
            value: kept,
            modifier: parsedModifier,
            mode,
            ...(twoDice ? { rolls: [parsedValue, parsedSecond] as [number, number] } : {}),
          });
        }}
      >
        <h2 id={ids.title} className="roll-dialog__title">
          {deathSave ? "Salvación contra la muerte" : "Tu tirada"}
        </h2>
        {request && (
          <p className="roll-dialog__request">
            {formatDice(request)}
            {request.mode !== "normal" && ` con ${rollModeLabel(request.mode)}`}
            {request.difficulty !== null &&
              ` · CD ${request.difficulty}`} — {request.reason}
          </p>
        )}
        {deathSave && (
          <p className="roll-dialog__kept">
            Sin modificadores. 10 o más es un éxito; 20 natural te levanta con 1 PG.
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
        {!request && die === "d20" && (
          <fieldset className="roll-dialog__modes">
            <legend>Tirada</legend>
            {(
              [
                ["normal", "Normal"],
                ["advantage", "Ventaja"],
                ["disadvantage", "Desventaja"],
              ] as const
            ).map(([option, label]) => (
              <label key={option} className="roll-dialog__mode">
                <input
                  type="radio"
                  name="roll-mode"
                  value={option}
                  checked={mode === option}
                  onChange={() => setChosenMode(option)}
                />
                {label}
              </label>
            ))}
          </fieldset>
        )}
        <div className={`roll-dialog__fields${twoDice ? " roll-dialog__fields--pair" : ""}`}>
          {twoDice ? (
            <div className="roll-dialog__pair">
              <div className="field">
                <label htmlFor={ids.value}>Dado 1</label>
                <input
                  id={ids.value}
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
              <div className="field">
                <label htmlFor={ids.second}>Dado 2</label>
                <input
                  id={ids.second}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={maxValue}
                  required
                  value={secondValue}
                  onChange={(event) => setSecondValue(event.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="field">
              <label htmlFor={ids.value}>
                {count > 1 ? `Suma de ${count}${die}` : "Resultado"}
              </label>
              <input
                id={ids.value}
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
          )}
          {!deathSave && (
            <>
              <span className="roll-dialog__op" aria-hidden="true">
                +
              </span>
              <div className="field">
                <label htmlFor={ids.modifier}>Modificador</label>
                <input
                  id={ids.modifier}
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
                htmlFor={`${ids.value} ${ids.second} ${ids.modifier}`}
              >
                {valid ? kept + parsedModifier : "—"}
              </output>
            </>
          )}
        </div>
        {twoDice && valid && (
          <p className="roll-dialog__kept">
            Con {rollModeLabel(mode)} queda el {kept}.
          </p>
        )}
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
