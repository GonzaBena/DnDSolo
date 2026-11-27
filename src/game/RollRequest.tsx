import { formatDice } from "../domain/dice";
import type { PlayerRollRequest } from "../domain/types";

/** The roll the DM is waiting on, above the composer. */
export function RollRequest({ roll }: { roll: PlayerRollRequest }) {
  return (
    <div className="roll-request">
      <p>
        <strong>El DM te pide una tirada: {formatDice(roll)}</strong>
        {roll.difficulty !== null && ` (CD ${roll.difficulty})`}
        {roll.damage && ` + ${formatDice(roll.damage)} de daño`}
      </p>
      <p>{roll.reason}</p>
      <p className="roll-request__hint">
        Tirá tus dados y cargá el resultado con el botón del dado, o escribilo en el chat.
      </p>
    </div>
  );
}
