import type { GameState, Npc } from "./types";

// The DM marks each line an NPC says with "[[Name]]" at the start of its
// paragraph, inside the same narration string. Keeping it in the text means
// streaming and the typewriter need no changes: the split happens when the
// narration is rendered.

export interface DialogueSegment {
  /** null is the DM narrating; otherwise the NPC who speaks, named as in the
      state when they are there. */
  speaker: string | null;
  paragraphs: string[];
}

/** Who can take part in a narration. */
export interface Cast {
  npcs: Npc[];
  playerNames: string[];
}

const MARKER = /^\s*\[\[([^\]]+)\]\]\s*/;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function findNpc(npcs: Npc[], name: string): Npc | undefined {
  return npcs.find((n) => sameName(n.name, name));
}

export function castOf(state: GameState): Cast {
  return { npcs: state.npcs, playerNames: state.players.map((p) => p.name) };
}

/** Who a marker names: the NPC as the state spells them, the trimmed name
    when they aren't there yet, or null for the player's own character
    (the DM never speaks for them, so such a line is plain narration). */
function resolveSpeaker(name: string, cast: Cast): string | null {
  if (cast.playerNames.some((p) => sameName(p, name))) return null;
  return findNpc(cast.npcs, name)?.name ?? name.trim();
}

export function splitDialogue(narration: string, cast: Cast): DialogueSegment[] {
  const segments: DialogueSegment[] = [];
  const open = (speaker: string | null): DialogueSegment => {
    const last = segments.at(-1);
    if (last && last.speaker === speaker) return last;
    const segment = { speaker, paragraphs: [] };
    segments.push(segment);
    return segment;
  };

  const lines = narration.split(/\n+/);
  // A marker alone on its line: the model put the line itself in the next
  // paragraph, which belongs to that speaker.
  let awaitingLine: string | null | undefined;
  lines.forEach((raw, index) => {
    const marker = MARKER.exec(raw);
    if (marker) {
      const speaker = resolveSpeaker(marker[1]!, cast);
      const text = raw.slice(marker[0].length).trim();
      const segment = open(speaker);
      if (text !== "") segment.paragraphs.push(text);
      awaitingLine = text === "" ? speaker : undefined;
      return;
    }
    // A marker still arriving ("[[Bre") is hidden until it closes. Only the
    // last line can still be arriving: a malformed marker earlier stays text.
    const isLast = index === lines.length - 1;
    if (isLast && /^\s*\[\[/.test(raw) && !raw.includes("]]")) return;
    const text = raw.trim();
    if (text === "") return;
    open(awaitingLine === undefined ? null : awaitingLine).paragraphs.push(text);
    awaitingLine = undefined;
  });
  return segments;
}

/** The NPC whose line is on screen at the end of a narration that is still
    arriving, or null when it is the DM's. */
export function speakingNow(narration: string, cast: Cast): string | null {
  return splitDialogue(narration, cast).at(-1)?.speaker ?? null;
}
