import { enterFromRight, enterNarration, popIn } from "../animations/motion";
import { formatDice } from "../domain/dice";
import type { EnemyRollResult, Turn, TurnInput } from "../domain/types";
import { useEnter } from "./useEnter";

// `animated` is only set for the turn being played right now. Turns that
// are already in the log (including a whole loaded save) render still, and
// a turn doesn't animate a second time when it moves from "in flight" to
// the log.

/** A roll the app made for an enemy. The player's own rolls never get a
    card: they are plain chat messages. */
function EnemyRollCard({ result, animated }: { result: EnemyRollResult; animated?: boolean }) {
  const ref = useEnter<HTMLDivElement>(animated ? popIn : null);
  // Only worth spelling out when the total isn't just the single die.
  const showDice = result.values.length > 1 || result.modifier !== 0;
  return (
    <div ref={ref} className="roll-card">
      <span className="roll-card__label">Tirada del enemigo</span>
      <span className="roll-card__value">{result.total}</span>
      <span className="roll-card__meta">
        {result.reason} · {formatDice(result)}
        {showDice && ` · dados: ${result.values.join(", ")}`}
      </span>
    </div>
  );
}

function PlayerEntry({ text, animated }: { text: string; animated?: boolean }) {
  const ref = useEnter<HTMLParagraphElement>(animated ? enterFromRight : null);
  return (
    <p ref={ref} className="entry entry--player">
      {text}
    </p>
  );
}

export function InputEntry({ input, animated }: { input: TurnInput; animated?: boolean }) {
  switch (input.type) {
    case "start":
      return null;
    case "action":
      return <PlayerEntry text={input.text} animated={animated} />;
    case "enemy_rolls":
      return (
        <div className="roll-cards">
          {input.results.map((result, index) => (
            <EnemyRollCard key={index} result={result} animated={animated} />
          ))}
        </div>
      );
  }
}

function Paragraph({ text, animated }: { text: string; animated?: boolean }) {
  const ref = useEnter<HTMLParagraphElement>(animated ? enterNarration : null);
  return <p ref={ref}>{text}</p>;
}

export function Narration({ text, animated }: { text: string; animated?: boolean }) {
  return (
    <div className="entry entry--dm">
      {/* Keyed by position: while streaming, a paragraph keeps its element
          as it grows and only a newly started paragraph animates in. */}
      {text.split(/\n+/).map((paragraph, index) => (
        <Paragraph key={index} text={paragraph} animated={animated} />
      ))}
    </div>
  );
}

export function TurnLog({ turns }: { turns: Turn[] }) {
  return (
    <>
      {turns.map((turn) => (
        <div key={turn.number} className="turn">
          <InputEntry input={turn.input} />
          <Narration text={turn.narration} />
        </div>
      ))}
    </>
  );
}
