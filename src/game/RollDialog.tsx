import { useEffect, useId, useRef, useState, type CSSProperties, type RefObject } from "react";
import { enterRollDialog, leaveRollDialog, motionAllowed } from "../animations/motion";
import { dieSides, formatDice, resolveRollMode, rollModeLabel } from "../domain/dice";
import { DICE, type Die, type PlayerRollRequest, type RollMode } from "../domain/types";
import { DieShape, GemD20, SPARK } from "./DieShape";

interface Props {
  open: boolean;
  /** The roll the DM asked for, if any, shown as a reminder. */
  request: PlayerRollRequest | null;
  /** A death save: a bare d20 with no modifier, resolved by code. */
  deathSave?: boolean;
  /** The button that opened it: the dialog grows out of it and, once sent, goes back into it. */
  originRef?: RefObject<HTMLElement | null>;
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

/** How long the old figure takes to spin away when another die is picked. */
const FIGURE_SWAP_MS = 140;

export function RollDialog({ open, request: asked, deathSave = false, originRef, onClose, onSubmit }: Props) {
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

  // How the next close should look: sending flies back into the button.
  const leavingAs = useRef<"sent" | "cancelled">("cancelled");
  const valueRef = useRef<HTMLInputElement>(null);
  const cancelLeave = useRef<() => void>(() => {});
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const origin = originRef?.current ?? null;
    if (open) {
      // Reopened mid-exit: stop the exit and stay.
      cancelLeave.current();
      setLeaving(false);
      if (dialog.open) return;
      setValue("");
      setSecondValue("");
      setChosenMode("normal");
      dialog.showModal();
      // showModal focuses the first control (the d4 when picking a die);
      // the result is what the player came to type.
      valueRef.current?.focus();
      enterRollDialog(dialog, origin);
    } else if (dialog.open) {
      const how = leavingAs.current;
      leavingAs.current = "cancelled";
      setLeaving(true);
      cancelLeave.current = leaveRollDialog(dialog, how, origin, () => {
        setLeaving(false);
        dialog.close();
      });
    }
  }, [open, originRef]);

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
  // A natural 20 or 1 on the die that counts (only the d20 has them).
  const natural = die === "d20" && valid && (kept === 20 || kept === 1) ? kept : null;
  // With two dice, the one that doesn't count.
  const dropped = twoDice && valid ? (parsedValue === kept ? 1 : 0) : null;

  // Picking another die by hand: the old figure spins away first, then the
  // new one pops in (keyed on the figure). A requested die never changes.
  const [shownDie, setShownDie] = useState<Die>(die);
  const [figureLeaving, setFigureLeaving] = useState(false);
  useEffect(() => {
    if (die === shownDie) return;
    if (request || !motionAllowed() || !dialogRef.current?.open) {
      setShownDie(die);
      return;
    }
    setFigureLeaving(true);
    const timer = setTimeout(() => {
      setShownDie(die);
      setFigureLeaving(false);
    }, FIGURE_SWAP_MS);
    return () => clearTimeout(timer);
  }, [die, shownDie, request]);
  const figureDie = request ? die : shownDie;
  const shown = (raw: string) => {
    const n = Number.parseInt(raw, 10);
    return inRange(n) ? String(n) : "?";
  };

  return (
    <dialog
      ref={dialogRef}
      className={`roll-dialog${leaving ? " roll-dialog--leaving" : ""}`}
      aria-labelledby={ids.title}
      onClose={onClose}
      // Escape closes through the same exit animation as Cancelar.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // A click on the dialog itself (not its form) is a click on the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="roll-dialog__panel"
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid || leaving) return;
          leavingAs.current = "sent";
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
        <div className="roll-dialog__head">
          <div
            className={[
              "roll-dialog__figure",
              natural === 20 && "roll-dialog__figure--nat20",
              natural === 1 && "roll-dialog__figure--nat1",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div
              key={figureDie}
              className={[
                "roll-dialog__figs",
                twoDice && "roll-dialog__figs--two",
                figureLeaving && "roll-dialog__figs--leaving",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {figureDie === "d20" ? (
                [value, secondValue].map((raw, index) => (
                  <GemD20
                    key={index}
                    className={[
                      "roll-dialog__fig",
                      index === 1 && !twoDice && "roll-dialog__fig--off",
                      shown(raw) === "?" && "roll-dialog__fig--empty",
                      dropped === index && "roll-dialog__fig--dropped",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    value={shown(raw)}
                  />
                ))
              ) : (
                <>
                  <DieShape die={figureDie} className="roll-dialog__fig roll-dialog__fig--plain" />
                  <span className="roll-dialog__badge" key={shown(value)} aria-hidden="true">
                    {shown(value)}
                  </span>
                </>
              )}
            </div>
            {natural === 20 && (
              <span className="roll-dialog__burst" aria-hidden="true">
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                  <svg
                    key={angle}
                    className="gem-spark"
                    viewBox="0 0 10 10"
                    style={{ "--angle": `${angle}deg` } as CSSProperties}
                  >
                    <path d={SPARK} />
                  </svg>
                ))}
              </span>
            )}
          </div>
          <div className="roll-dialog__titles">
            <h2 id={ids.title} className="roll-dialog__title">
              {deathSave ? "Salvación contra la muerte" : "Tu tirada"}
            </h2>
            {request && (
              <p className="roll-dialog__request">
                <span className="roll-dialog__chip">{formatDice(request)}</span>
                {request.mode !== "normal" && (
                  <span className="roll-dialog__chip roll-dialog__chip--sun">
                    con {rollModeLabel(request.mode)}
                  </span>
                )}
                {request.difficulty !== null && (
                  <span className="roll-dialog__chip">CD {request.difficulty}</span>
                )}
                <span>{request.reason}</span>
              </p>
            )}
          </div>
        </div>
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
        {!request && (
          <div
            className={`roll-dialog__fold${die === "d20" ? "" : " roll-dialog__fold--closed"}`}
            inert={die !== "d20"}
          >
            <fieldset className="roll-dialog__modes">
              <legend>Tirada</legend>
              <div className="roll-dialog__modes-track">
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
              </div>
            </fieldset>
          </div>
        )}
        <div
          className={[
            "roll-dialog__fields",
            twoDice && "roll-dialog__fields--pair",
            deathSave && "roll-dialog__fields--bare",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="field">
            <label htmlFor={ids.value}>
              {twoDice ? (
                <>
                  <span className="roll-dialog__label-long">Dado 1</span>
                  <span className="roll-dialog__label-tiny">1.º</span>
                </>
              ) : count > 1 ? (
                `Suma de ${count}${die}`
              ) : (
                "Resultado"
              )}
            </label>
            <input
              ref={valueRef}
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
          {/* Always there, folded to no width without advantage, so picking
              it opens a column instead of reflowing the row. */}
          <div className="roll-dialog__second" inert={!twoDice}>
            <div className="field">
              <label htmlFor={ids.second}>
                <span className="roll-dialog__label-long">Dado 2</span>
                <span className="roll-dialog__label-tiny">2.º</span>
              </label>
              <input
                id={ids.second}
                type="number"
                inputMode="numeric"
                min={1}
                max={maxValue}
                required={twoDice}
                value={secondValue}
                onChange={(event) => setSecondValue(event.target.value)}
              />
            </div>
          </div>
          {!deathSave && (
            <>
              <span className="roll-dialog__op" aria-hidden="true">
                +
              </span>
              <div className="field">
                <label htmlFor={ids.modifier}>
                  <span className="roll-dialog__label-long">Modificador</span>
                  <span className="roll-dialog__label-short">Mod.</span>
                </label>
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
                {/* Keyed on the total so each new one pops in. */}
                <span key={valid ? kept + parsedModifier : "none"}>{valid ? kept + parsedModifier : "—"}</span>
              </output>
            </>
          )}
        </div>
        <div
          className={`roll-dialog__fold${twoDice && valid ? "" : " roll-dialog__fold--closed"}`}
          inert={!(twoDice && valid)}
        >
          <p className="roll-dialog__kept">
            {twoDice && valid ? `Con ${rollModeLabel(mode)} queda el ${kept}.` : "\u00a0"}
          </p>
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
