import { findNpc } from "./dialogue";
import { healthLabel } from "./health";
import type { Arrival, Attitude, GameState } from "./types";

/** Who walked into the scene between two states: NPCs present now that
    either did not exist before or were away. In the new state's order. */
export function arrivalsOf(prev: GameState, next: GameState): Arrival[] {
  const arrivals: Arrival[] = [];
  for (const npc of next.npcs) {
    if (!npc.present) continue;
    const before = findNpc(prev.npcs, npc.name);
    if (before?.present) continue;
    // Someone known who fell (0 hp) and now "comes back" is, in practice,
    // a new enemy the DM numbered like an old one: hp is kept from the
    // first time (see applyChanges), so it would read "Fuera de combate".
    const fallen = npc.hp !== null && npc.hp <= 0;
    const health = fallen ? null : healthLabel(npc);
    arrivals.push({
      name: npc.name.trim(),
      attitude: npc.attitude,
      portrait: npc.portrait,
      blurb: firstSentence(npc.description),
      returning: before !== undefined && !fallen,
      health: health === "Ileso" ? null : health,
    });
  }
  return arrivals;
}

/** The text up to the first sentence end (. ! ? or …, followed by a space
    or the end), so "Mide 1.80 de alto." is not cut at the number. */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = /^.*?[.!?…](?=\s|$)/s.exec(trimmed);
  return match ? match[0] : trimmed;
}

export interface ArrivalGroup {
  /** The base name ("Goblin") when count > 1, the full name otherwise. */
  name: string;
  count: number;
  /** The first of them, whose portrait and text stand for the group. */
  lead: Arrival;
}

const NUMBERED = /^(.*\S)\s+\d+$/;

/** "Goblin 1", "Goblin 2" and "Goblin 3" with the same attitude become one
    "Goblin ×3". A name without a trailing number is never grouped. Groups
    keep the order of their first member. */
export function groupArrivals(arrivals: readonly Arrival[]): ArrivalGroup[] {
  const groups: { base: string | null; members: Arrival[] }[] = [];
  for (const arrival of arrivals) {
    const base = NUMBERED.exec(arrival.name)?.[1] ?? null;
    const group =
      base === null
        ? undefined
        : groups.find(
            (g) =>
              g.base !== null &&
              g.base.toLowerCase() === base.toLowerCase() &&
              g.members[0]!.attitude === arrival.attitude,
          );
    if (group) group.members.push(arrival);
    else groups.push({ base, members: [arrival] });
  }
  return groups.map(({ base, members }) => ({
    name: members.length > 1 && base !== null ? base : members[0]!.name,
    count: members.length,
    lead: members[0]!,
  }));
}

/** Hostiles showing up as combat breaks out: the turn deserves a banner. */
export function isAmbush(events: readonly string[], arrivals: readonly Arrival[]): boolean {
  return events.includes("combat_start") && arrivals.some((a) => a.attitude === "hostile");
}

export const ATTITUDE_LABEL: Record<Attitude, string> = {
  friendly: "aliado",
  neutral: "neutral",
  hostile: "hostil",
};

function section(title: string, arrivals: Arrival[]): string {
  if (arrivals.length === 0) return "";
  const parts = groupArrivals(arrivals).map(
    (g) => `${g.name}${g.count > 1 ? ` ×${g.count}` : ""}, ${ATTITUDE_LABEL[g.lead.attitude]}`,
  );
  return `${title}: ${parts.join("; ")}.`;
}

/** The arrivals as one sentence run for screen readers. */
export function arrivalsAnnouncement(arrivals: readonly Arrival[]): string {
  return [
    section("Aparece", arrivals.filter((a) => !a.returning)),
    section("Vuelve", arrivals.filter((a) => a.returning)),
  ]
    .filter(Boolean)
    .join(" ");
}
