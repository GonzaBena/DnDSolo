import { enterFromRight, enterNarration, popIn } from "../animations/motion";
import type { RollResult, Turn, TurnInput } from "../domain/types";
import { useEnter } from "./useEnter";

// `animated` is only set for the turn being played right now. Turns that
// are already in the log (including a whole loaded save) render still, and
// a turn doesn't animate a second time when it moves from "in flight" to
// the log.

export function RollCard({ result, animated }: { result: RollResult; animated?: boolean }) {
  const ref = useEnter<HTMLDivElement>(animated ? popIn : null);
  const verdict = result.success === null ? null : result.success ? "Éxito" : "Fallo";
  return (
    <div ref={ref} className="roll-card" data-success={result.success ?? undefined}>
      <span className="roll-card__value">{result.value}</span>
      <span className="roll-card__meta">
        {result.die} · {result.reason}
        {result.difficulty !== null && ` · CD ${result.difficulty}`}
        {verdict && <strong> · {verdict}</strong>}
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
    case "roll":
      return <RollCard result={input.result} animated={animated} />;
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
