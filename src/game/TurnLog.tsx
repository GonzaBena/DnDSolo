import type { RollResult, Turn, TurnInput } from "../domain/types";

export function RollCard({ result }: { result: RollResult }) {
  const verdict = result.success === null ? null : result.success ? "Éxito" : "Fallo";
  return (
    <div className="roll-card" data-success={result.success ?? undefined}>
      <span className="roll-card__value">{result.value}</span>
      <span className="roll-card__meta">
        {result.die} · {result.reason}
        {result.difficulty !== null && ` · CD ${result.difficulty}`}
        {verdict && <strong> · {verdict}</strong>}
      </span>
    </div>
  );
}

export function InputEntry({ input }: { input: TurnInput }) {
  switch (input.type) {
    case "start":
      return null;
    case "action":
      return <p className="entry entry--player">{input.text}</p>;
    case "roll":
      return <RollCard result={input.result} />;
  }
}

export function Narration({ text }: { text: string }) {
  return (
    <div className="entry entry--dm">
      {text.split(/\n+/).map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
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
