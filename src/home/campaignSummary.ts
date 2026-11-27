import { findCampaign } from "../campaigns";
import type { GameState } from "../domain/types";
import type { GameSummary } from "../persistence/GameRepo";

/** What the home screen shows about one saved campaign. */
export interface CampaignSummary {
  id: string;
  name: string;
  subtitle: string;
  /** One letter for the avatar circle; "?" without a player. */
  initials: string;
  detail: string;
  /** End of the latest narration, "" when there is none. */
  excerpt: string;
}

export function summarizeCampaign(game: GameState | GameSummary): CampaignSummary {
  const isSummary = "turnCount" in game;
  const player = isSummary ? game.player : game.players[0];
  const campaign = findCampaign(game.campaignId);
  const count = isSummary ? game.turnCount : game.turns.length;
  const turns = count === 1 ? "1 turno" : `${count} turnos`;
  const latestNarration = isSummary
    ? game.latestNarration
    : (game.turns.findLast((turn) => turn.narration.trim() !== "")?.narration ?? "");
  const playerLine = player ? `${player.characterClass} · nivel ${player.level}` : "";
  const subtitle = [playerLine, campaign?.title].filter(Boolean).join(" · ");
  return {
    id: game.id,
    name: player ? player.name : "Sin personaje",
    subtitle,
    // Array.from splits by code point, so an emoji stays whole.
    initials: Array.from(player?.name.trim() ?? "")[0]?.toUpperCase() ?? "?",
    detail: `${turns} · ${new Date(game.updatedAt).toLocaleDateString("es-AR")}`,
    excerpt: latestNarration ? narrationExcerpt(latestNarration) : "",
  };
}

/** The last sentences of a narration that fit in `max` characters (90 is two
    lines of the card on a phone): where the story left off. A single sentence
    too long is cut at a word, with "…". */
export function narrationExcerpt(text: string, max = 90): string {
  const plain = text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // [text](url) keeps the text
    .replace(/^\s*(#{1,6}|[-+]|\d+\.)\s+/gm, "") // headings and list marks
    .replace(/[*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = plain.split(/(?<=[.!?…])\s+/);
  let excerpt = "";
  for (let i = sentences.length - 1; i >= 0; i--) {
    const candidate = excerpt ? `${sentences[i]} ${excerpt}` : sentences[i]!;
    if (candidate.length > max) break;
    excerpt = candidate;
  }
  if (excerpt || !plain) return excerpt;

  const last = sentences[sentences.length - 1]!;
  const cut = last.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${space > 0 ? cut.slice(0, space) : cut}…`;
}
