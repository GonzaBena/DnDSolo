import { useEffect, useRef } from "react";
import { formatDice } from "../domain/dice";
import { parseInline } from "../domain/inlineMarkdown";
import type { Recap } from "../domain/recap";
import { Inline } from "./TurnLog";

const text = (value: string) => <Inline nodes={parseInline(value)} />;

/** What "Anteriormente en…" says: the story so far, the quests in hand and
    exactly where the player left off. */
export function RecapContent({ recap }: { recap: Recap }) {
  const { summary, quests, place, inCombat, lastWords, pendingRoll, dying } = recap;
  return (
    <div className="recap__content">
      <h2 id="recap-title" className="recap__title">
        — Anteriormente en… —
      </h2>
      {summary.length > 0 && (
        <div className="recap__summary">
          {summary.map((paragraph, index) => (
            <p key={index}>{text(paragraph)}</p>
          ))}
        </div>
      )}
      {quests.length > 0 && (
        <section className="recap__section">
          <h3>Misiones en curso</h3>
          <ul className="recap__quests">
            {quests.map((quest) => (
              <li key={quest.title}>
                <strong>{quest.title}</strong>
                {quest.description && <span>{quest.description}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="recap__section">
        <h3>Donde quedaste</h3>
        {place && (
          <p className="recap__place">
            {place}
            {inCombat && " · en combate"}
          </p>
        )}
        {lastWords && (
          <blockquote className="recap__quote">
            {lastWords.speaker && <cite>{lastWords.speaker}</cite>}
            <p>«{text(lastWords.text)}»</p>
          </blockquote>
        )}
        {dying ? (
          <p className="recap__roll">🎲 Tirada de muerte pendiente</p>
        ) : (
          pendingRoll && (
            <p className="recap__roll">
              🎲 Te pidieron: {pendingRoll.reason} ({formatDice(pendingRoll)}
              {pendingRoll.difficulty !== null && `, CD ${pendingRoll.difficulty}`})
            </p>
          )
        )}
      </section>
    </div>
  );
}

/** "Anteriormente en…": covers the game until "Seguir". */
export function RecapScreen({ recap, onClose }: { recap: Recap; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog ref={dialogRef} className="recap" aria-labelledby="recap-title" onClose={onClose}>
      <RecapContent recap={recap} />
      <button type="button" className="button button--primary" autoFocus onClick={() => dialogRef.current?.close()}>
        Seguir
      </button>
    </dialog>
  );
}
