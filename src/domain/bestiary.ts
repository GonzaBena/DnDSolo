import { firstSentence, NUMBERED } from "./arrivals";
import { healthLabel, type HealthLabel } from "./health";
import { isMonsterPortrait } from "./portraits";
import type { Attitude, GameState, Npc } from "./types";

export type BestiaryStatus = Exclude<HealthLabel, "Fuera de combate"> | "Derrotado";

export interface BestiaryEntry {
  name: string;
  /** The one shown: the NPC itself, or the first of a group of monsters. */
  npc: Npc;
  blurb: string;
  attitude: Attitude;
  status: BestiaryStatus | null;
}

const RANK: Record<BestiaryStatus, number> = { Ileso: 3, Herido: 2, Malherido: 1, Derrotado: 0 };

function statusOf(npc: Npc): BestiaryStatus | null {
  const label = healthLabel(npc);
  return label === "Fuera de combate" ? "Derrotado" : label;
}

function entryOf(name: string, members: Npc[]): BestiaryEntry {
  const lead = members[0]!;
  // "Derrotado" only when all fell; otherwise whoever is best off.
  const statuses = members.map(statusOf).filter((s): s is BestiaryStatus => s !== null);
  const standing = statuses.filter((s) => s !== "Derrotado");
  const status =
    statuses.length === 0
      ? null
      : standing.length === 0
        ? "Derrotado"
        : standing.reduce((best, s) => (RANK[s] > RANK[best] ? s : best));
  return { name, npc: lead, blurb: firstSentence(lead.description), attitude: lead.attitude, status };
}

/** Everyone the party met, split into people and monsters by portrait.
    Monsters with no proper name ("Goblin", "Goblin 2") are one entry for
    their kind: they are all alike. People are never grouped. */
export function bestiaryOf(state: GameState): { people: BestiaryEntry[]; monsters: BestiaryEntry[] } {
  const met = state.npcs.filter((npc) => npc.seen !== false);
  const people = met.filter((npc) => !isMonsterPortrait(npc.portrait)).map((npc) => entryOf(npc.name, [npc]));
  const monsterNpcs = met.filter((npc) => isMonsterPortrait(npc.portrait));
  const numberedBases = new Set(
    monsterNpcs.map((npc) => NUMBERED.exec(npc.name)?.[1]?.toLowerCase()).filter((b): b is string => !!b),
  );
  const groups: { name: string; key: string; members: Npc[] }[] = [];
  for (const npc of monsterNpcs) {
    const base = NUMBERED.exec(npc.name)?.[1];
    const key = (base ?? npc.name).trim().toLowerCase();
    // A bare name only joins a group when numbered ones of its kind exist.
    const groupable = base !== undefined || numberedBases.has(key);
    const group = groupable ? groups.find((g) => g.key === key) : undefined;
    if (group) group.members.push(npc);
    else groups.push({ name: groupable ? (base ?? npc.name) : npc.name, key: groupable ? key : `\0${groups.length}`, members: [npc] });
  }
  return { people, monsters: groups.map((g) => entryOf(g.name, g.members)) };
}
