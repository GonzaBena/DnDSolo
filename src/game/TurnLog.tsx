import { useLayoutEffect, useRef } from "react";
import {
  enterFromRight,
  enterNarration,
  enterPage,
  rollIn,
} from "../animations/motion";
import { findNpc, splitDialogue, type Cast } from "../domain/dialogue";
import { formatDice, naturalResult } from "../domain/dice";
import type {
  Character,
  EnemyRollResult,
  PlayerRoll,
  Turn,
  TurnInput,
} from "../domain/types";
import { DieShape } from "./DieShape";
import { initials, NpcAvatar } from "./NpcAvatar";
import { useEnter } from "./useEnter";

// `animated` is only set for the turn being played right now. Turns already
// in the log render still, and a turn doesn't animate a second time when it
// moves from "in flight" to the log. A save being opened gets its own
// entrance instead (see TurnLog).

/** A die result with its tumbling animation, for enemy rolls and for the
    rolls the player reports through the dice button. */
function RollCard({
  label,
  die,
  total,
  meta,
  variant,
  natural = null,
  animated,
}: {
  label: string;
  die: EnemyRollResult["die"];
  total: number;
  meta: string;
  variant: "enemy" | "player";
  natural?: "critical" | "fumble" | null;
  animated?: boolean | undefined;
}) {
  const ref = useEnter<HTMLDivElement>(animated ? rollIn : null);
  return (
    <div
      ref={ref}
      className={`roll-card roll-card--${variant}${natural ? ` roll-card--${natural}` : ""}`}
    >
      <span className="roll-card__label">
        {natural === "critical"
          ? "¡20 natural!"
          : natural === "fumble"
            ? "¡Pifia!"
            : label}
      </span>
      <span className="roll-card__result">
        {/* Only visible while the roll animates (see rollIn). */}
        <DieShape die={die} className="roll-card__die" />
        {die === "d100" && <span className="roll-card__burst" />}
        <span className="roll-card__value">{total}</span>
      </span>
      <span className="roll-card__meta">{meta}</span>
    </div>
  );
}

function EnemyRollCard({
  result,
  animated,
}: {
  result: EnemyRollResult;
  animated?: boolean;
}) {
  // Only worth spelling out when the total isn't just the single die.
  const showDice = result.values.length > 1 || result.modifier !== 0;
  const meta =
    `${result.reason} · ${formatDice(result)}` +
    (showDice ? ` · dados: ${result.values.join(", ")}` : "");
  return (
    <RollCard
      label="Tirada del enemigo"
      die={result.die}
      total={result.total}
      meta={meta}
      variant="enemy"
      animated={animated}
    />
  );
}

/** The player's own roll: the app didn't roll it, it shows what was typed. */
function PlayerRollCard({
  roll,
  animated,
}: {
  roll: PlayerRoll;
  animated?: boolean;
}) {
  const dice = formatDice({
    die: roll.die,
    count: roll.count ?? 1,
    modifier: roll.modifier,
  });
  const meta =
    (roll.reason ? `${roll.reason} · ` : "") +
    dice +
    (roll.modifier !== 0
      ? ` · ${(roll.count ?? 1) > 1 ? "dados" : "dado"}: ${roll.value}`
      : "");
  return (
    <RollCard
      label="Tu tirada"
      die={roll.die}
      total={roll.value + roll.modifier}
      meta={meta}
      variant="player"
      natural={naturalResult(roll)}
      animated={animated}
    />
  );
}

const DM_NAME = "DM";

/** Whose character said this. Falls back to the first player for messages
    saved before authorship was recorded (and for the solo game in general). */
function speakerName(
  players: Character[],
  playerId: string | undefined,
): string {
  const speaker = players.find((p) => p.id === playerId) ?? players[0];
  return speaker?.name ?? "Jugador";
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
        <>
          {input.text.trim() !== "" && (
            <PlayerEntry
              text={input.text}
              name={speakerName(players, input.playerId)}
              animated={animated}
            />
          )}
          {input.roll && (
            <div className="roll-cards roll-cards--player">
              <PlayerRollCard roll={input.roll} animated={animated} />
            </div>
          )}
        </>
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

/** One NPC's line: a bubble on the DM's side, tinted by their attitude
    (neutral for someone the state doesn't know yet). */
function NpcLine({
  name,
  paragraphs,
  cast,
  animated,
}: {
  name: string;
  paragraphs: string[];
  cast: Cast;
  animated?: boolean | undefined;
}) {
  const npc = findNpc(cast.npcs, name);
  const attitude = npc?.attitude ?? "neutral";
  return (
    <div className={`message message--npc message--${attitude}`}>
      <NpcAvatar name={name} npc={npc} size="sm" />
      <div className="npc-line">
        <span className="npc-line__name">{name}</span>
        {paragraphs.length > 0 && (
          <div className="entry entry--npc">
            {paragraphs.map((paragraph, index) => (
              <Paragraph key={index} text={paragraph} animated={animated} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** The DM's reply, split into their narration and the lines each NPC
    says (marked "[[Name]]" by the DM, see domain/dialogue). */
export function Narration({
  text,
  cast,
  animated,
}: {
  text: string;
  cast: Cast;
  animated?: boolean;
}) {
  // Keyed by position: while streaming, a segment and its paragraphs keep
  // their elements as they grow and only what is new animates in.
  return (
    <>
      {splitDialogue(text, cast).map((segment, index) =>
        segment.speaker === null ? (
          <div key={index} className="message message--dm">
            <Speaker name={DM_NAME} />
            <div className="entry entry--dm">
              {segment.paragraphs.map((paragraph, p) => (
                <Paragraph key={p} text={paragraph} animated={animated} />
              ))}
            </div>
          </div>
        ) : (
          <NpcLine
            key={index}
            name={segment.speaker}
            paragraphs={segment.paragraphs}
            cast={cast}
            animated={animated}
          />
        ),
      )}
    </>
  );
}

// Opening a save scrolls to the end, so only the last turns are on screen.
// Staggering every turn of a long game would make the visible ones wait.
const ENTERING_TURNS = 6;

/** `enterCount` is how many turns the save had when it was opened: the last
    of those rise in one after another, like the blocks of a page. Later
    turns already animated while they were in flight, so they join the log
    still. */
export function TurnLog({
  turns,
  players,
  cast,
  enterCount = 0,
}: {
  turns: Turn[];
  players: Character[];
  cast: Cast;
  enterCount?: number;
}) {
  const entering = useRef<HTMLDivElement[]>([]);
  useLayoutEffect(() => {
    enterPage(entering.current);
    // Mount-only on purpose: this is the entrance of the save as it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      {turns.map((turn, index) => {
        const enters =
          index < enterCount && index >= enterCount - ENTERING_TURNS;
        return (
          <div
            key={turn.number}
            className="turn"
            ref={(element) => {
              if (enters && element && !entering.current.includes(element)) {
                entering.current.push(element);
              }
            }}
          >
            <InputEntry input={turn.input} players={players} />
            <Narration text={turn.narration} cast={cast} />
          </div>
        );
      })}
    </>
  );
}
