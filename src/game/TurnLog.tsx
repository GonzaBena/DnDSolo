import { enterFromRight, enterNarration, popIn } from "../animations/motion";
import { formatDice } from "../domain/dice";
import type { Character, EnemyRollResult, Turn, TurnInput } from "../domain/types";
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

const DM_NAME = "DM";

/** Whose character said this. Falls back to the first player for messages
    saved before authorship was recorded (and for the solo game in general). */
function speakerName(players: Character[], playerId: string | undefined): string {
  const speaker = players.find((p) => p.id === playerId) ?? players[0];
  return speaker?.name ?? "Jugador";
}

/** "Mateo Valen" -> "MV". A single-word name uses its first two letters
    ("Lira" -> "LI") so the label is always the same width. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length >= 2 ? words[0]![0]! + words[1]![0]! : (words[0] ?? "").slice(0, 2);
  return letters.toUpperCase();
}

/** Who said a message, as two initials beside it. Deliberately faint: it
    is there to be found when you look for it, not to compete with the
    text. The full name stays available on hover and to screen readers. */
function Speaker({ name }: { name: string }) {
  return (
    <abbr className="speaker" title={name}>
      {initials(name)}
    </abbr>
  );
}

function PlayerEntry({
  text,
  name,
  animated,
}: {
  text: string;
  name: string;
  animated?: boolean;
}) {
  const ref = useEnter<HTMLDivElement>(animated ? enterFromRight : null);
  return (
    <div ref={ref} className="message message--player">
      <p className="entry entry--player">{text}</p>
      <Speaker name={name} />
    </div>
  );
}

export function InputEntry({
  input,
  players,
  animated,
}: {
  input: TurnInput;
  players: Character[];
  animated?: boolean;
}) {
  switch (input.type) {
    case "start":
      return null;
    case "action":
      return (
        <PlayerEntry
          text={input.text}
          name={speakerName(players, input.playerId)}
          animated={animated}
        />
      );
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
    <div className="message message--dm">
      <Speaker name={DM_NAME} />
      <div className="entry entry--dm">
        {/* Keyed by position: while streaming, a paragraph keeps its element
            as it grows and only a newly started paragraph animates in. */}
        {text.split(/\n+/).map((paragraph, index) => (
          <Paragraph key={index} text={paragraph} animated={animated} />
        ))}
      </div>
    </div>
  );
}

export function TurnLog({ turns, players }: { turns: Turn[]; players: Character[] }) {
  return (
    <>
      {turns.map((turn) => (
        <div key={turn.number} className="turn">
          <InputEntry input={turn.input} players={players} />
          <Narration text={turn.narration} />
        </div>
      ))}
    </>
  );
}
