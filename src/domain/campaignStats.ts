import { samePlace } from "./names";
import { isMonsterPortrait } from "./portraits";
import type { GameState, Moment, Turn } from "./types";

export interface CampaignStats {
  turns: number;
  places: number;
  people: number;
  monsters: number;
  monstersDefeated: number;
  questsCompleted: number;
  questsFailed: number;
  questsActive: number;
  threadsResolved: number;
  rolls: number;
  natural20s: number;
  natural1s: number;
}

/** The natural on a single d20 the player rolled this turn; null otherwise. */
function naturalOf(turn: Turn): number | null {
  const { input } = turn;
  if (input.type === "death_save") return input.natural;
  if (input.type !== "action" || !input.roll) return null;
  const { die, count, value } = input.roll;
  return die === "d20" && (count ?? 1) === 1 ? value : null;
}

const isRoll = (turn: Turn) =>
  turn.input.type === "death_save" || (turn.input.type === "action" && turn.input.roll !== undefined);

/** The campaign in numbers, all counted from what the save already holds. */
export function campaignStats(state: GameState): CampaignStats {
  const placeNames: string[] = [];
  for (const turn of state.turns) {
    const name = turn.chapter?.name;
    if (name && !placeNames.some((known) => samePlace(known, name))) placeNames.push(name);
  }
  const places = placeNames.length > 0 ? placeNames.length : state.location.name.trim() !== "" ? 1 : 0;
  const met = state.npcs.filter((npc) => npc.seen !== false);
  const monsters = met.filter((npc) => isMonsterPortrait(npc.portrait));
  const naturals = state.turns.map(naturalOf);
  const quests = (status: string) => state.quests.filter((q) => q.status === status).length;
  return {
    turns: state.turns.length,
    places,
    people: met.length - monsters.length,
    monsters: monsters.length,
    monstersDefeated: monsters.filter((npc) => npc.maxHp !== null && npc.hp === 0).length,
    questsCompleted: quests("completed"),
    questsFailed: quests("failed"),
    questsActive: quests("active"),
    threadsResolved: state.threads.filter((t) => !t.secret && t.status === "resolved").length,
    rolls: state.turns.filter(isRoll).length,
    natural20s: naturals.filter((n) => n === 20).length,
    natural1s: naturals.filter((n) => n === 1).length,
  };
}

export type TimelineEntry = { turn: number } & ({ kind: "place"; name: string } | Moment);

/** The key moments in order: each place reached for the first time, then
    what that turn brought (quests, levels, death). */
export function timelineOf(state: GameState): TimelineEntry[] {
  return state.turns.flatMap((turn): TimelineEntry[] => [
    ...(turn.chapter?.firstVisit ? [{ turn: turn.number, kind: "place" as const, name: turn.chapter.name }] : []),
    ...(turn.moments ?? []).map((moment) => ({ turn: turn.number, ...moment })),
  ]);
}
