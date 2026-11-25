import type { Character } from "../domain/types";
import { DieShape } from "./DieShape";

interface Props {
  deathSaves: Character["deathSaves"];
  canAct: boolean;
  busy: boolean;
  /** Gets the button, so the roll dialog can grow out of it. */
  onRoll: (origin: HTMLElement) => void;
  onStop: () => void;
}

/** Dying: the composer gives way to the death save. */
export function DyingNotice({ deathSaves, canAct, busy, onRoll, onStop }: Props) {
  return (
    <div className="action-form dying-notice" role="status">
      <p className="dying-notice__title">
        <strong>Estás inconsciente</strong>
      </p>
      <DeathSaveTrack successes={deathSaves.successes} failures={deathSaves.failures} />
      <div className="dying-notice__actions">
        <button
          type="button"
          className="button button--primary"
          disabled={!canAct}
          onClick={(event) => onRoll(event.currentTarget)}
        >
          <DieShape die="d20" className="dying-notice__die" />
          Tirar salvación contra la muerte
        </button>
        {busy && (
          <button type="button" className="button" aria-label="Detener respuesta" onClick={onStop}>
            Detener
          </button>
        )}
      </div>
    </div>
  );
}

/** Three marks for successes and three for failures. */
function DeathSaveTrack({ successes, failures }: { successes: number; failures: number }) {
  const marks = (filled: number, kind: "success" | "failure") =>
    [0, 1, 2].map((i) => (
      <span
        key={i}
        className={`death-saves__mark death-saves__mark--${kind}${i < filled ? " death-saves__mark--on" : ""}`}
      />
    ));
  return (
    <div className="death-saves">
      <span className="death-saves__row" aria-label={`${successes} de 3 éxitos`}>
        <span className="death-saves__label">Éxitos</span>
        {marks(successes, "success")}
      </span>
      <span className="death-saves__row" aria-label={`${failures} de 3 fallos`}>
        <span className="death-saves__label">Fallos</span>
        {marks(failures, "failure")}
      </span>
    </div>
  );
}
