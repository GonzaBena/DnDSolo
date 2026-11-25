import { castOf, splitDialogue } from "./dialogue";
import type { GameState, PlayerRollRequest } from "./types";

/** How long away from a game before it opens with "Anteriormente en…". */
export const RECAP_AFTER_MS = 12 * 60 * 60 * 1000;

/** How much of the last narration the recap quotes. */
const LAST_WORDS_MAX = 300;

export interface Recap {
  summary: string[];
  quests: { title: string; description: string }[];
  place: string;
  inCombat: boolean;
  /** Where the last narration left off, and who was speaking. */
  lastWords: { speaker: string | null; text: string } | null;
  pendingRoll: PlayerRollRequest | null;
  dying: boolean;
}

/** A game left long enough ago, with a story to recall and a hero alive. */
export function shouldShowRecap(state: GameState, now: Date): boolean {
  if (state.turns.length === 0) return false;
  if (state.players.some((p) => p.condition === "dead")) return false;
  return now.getTime() - Date.parse(state.updatedAt) >= RECAP_AFTER_MS;
}

/** The end of a paragraph that fits: whole sentences when they do, the
    raw tail when even the last one is too long. */
function tail(text: string): string {
  if (text.length <= LAST_WORDS_MAX) return text;
  const sentences = text.match(/[^.!?…]+[.!?…]+["»”)]*\s*|[^.!?…]+$/g) ?? [text];
  let kept = "";
  for (let i = sentences.length - 1; i >= 0; i--) {
    const next = sentences[i]! + kept;
    if (next.trim().length > LAST_WORDS_MAX) break;
    kept = next;
  }
  return "…" + (kept.trim() !== "" ? kept.trim() : text.slice(-LAST_WORDS_MAX));
}

/** Everything "Anteriormente en…" shows, from what the save already holds. */
export function recapOf(state: GameState): Recap {
  const last = state.turns.at(-1);
  const segment = last ? splitDialogue(last.narration, castOf(state)).at(-1) : undefined;
  const paragraph = segment?.paragraphs.at(-1);
  return {
    summary: state.summary.split(/\n+/).map((p) => p.trim()).filter((p) => p !== ""),
    quests: state.quests.filter((q) => q.status === "active").map(({ title, description }) => ({ title, description })),
    place: state.location.name,
    inCombat: state.scene.inCombat,
    lastWords: segment && paragraph ? { speaker: segment.speaker, text: tail(paragraph) } : null,
    pendingRoll: state.pendingPlayerRoll,
    dying: state.players.some((p) => p.condition === "dying"),
  };
}
