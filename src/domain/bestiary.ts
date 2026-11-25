import { firstSentence, NUMBERED } from "./arrivals";
import { healthLabel, type HealthLabel } from "./health";
import { archetypeBase, isMonsterPortrait, MONSTER_KINDS, npcNameFromArchetype, portraitUrl } from "./portraits";
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

interface MonsterGroup {
  name: string;
  members: Npc[];
  /** Nameless ones ("Goblin", "Goblin 2"), as opposed to "Grishnak". */
  generic: boolean;
}

/** Monsters met, with the nameless ones of a kind folded into one group. */
function monsterGroups(met: Npc[]): MonsterGroup[] {
  const monsterNpcs = met.filter((npc) => isMonsterPortrait(npc.portrait));
  const numberedBases = new Set(
    monsterNpcs.map((npc) => NUMBERED.exec(npc.name)?.[1]?.toLowerCase()).filter((b): b is string => !!b),
  );
  const groups: (MonsterGroup & { key: string })[] = [];
  for (const npc of monsterNpcs) {
    const base = NUMBERED.exec(npc.name)?.[1];
    const key = (base ?? npc.name).trim().toLowerCase();
    // A bare name only joins a group when numbered ones of its kind exist.
    const groupable = base !== undefined || numberedBases.has(key);
    const group = groupable ? groups.find((g) => g.key === key) : undefined;
    if (group) {
      group.members.push(npc);
      continue;
    }
    const kindName = npc.portrait ? npcNameFromArchetype(archetypeBase(npc.portrait)).toLowerCase() : "";
    groups.push({
      name: groupable ? (base ?? npc.name) : npc.name,
      key: groupable ? key : `\0${groups.length}`,
      members: [npc],
      generic: groupable || key === kindName,
    });
  }
  return groups;
}

/** Everyone the party met, split into people and monsters by portrait.
    Monsters with no proper name ("Goblin", "Goblin 2") are one entry for
    their kind: they are all alike. People are never grouped. */
export function bestiaryOf(state: GameState): { people: BestiaryEntry[]; monsters: BestiaryEntry[] } {
  const met = state.npcs.filter((npc) => npc.seen !== false);
  const people = met.filter((npc) => !isMonsterPortrait(npc.portrait)).map((npc) => entryOf(npc.name, [npc]));
  return { people, monsters: monsterGroups(met).map((g) => entryOf(g.name, g.members)) };
}

export interface MonsterSlot {
  kind: string;
  /** The kind in Spanish ("Goblin"), shown for a slot not found yet. */
  name: string;
  /** The kind's image, for the silhouette of a slot not found yet. */
  image: string | null;
  entry: BestiaryEntry | null;
}

/** Every creature kind with its slot, found or not, in a fixed order, like
    an album. Named monsters ("Grishnak") get a slot after their kind's and
    don't count as a kind found, unless they are the only one of it met. */
export function monsterAlbum(state: GameState): { slots: MonsterSlot[]; found: number; total: number } {
  const groups = monsterGroups(state.npcs.filter((npc) => npc.seen !== false));
  const slots: MonsterSlot[] = [];
  let found = 0;
  for (const kind of MONSTER_KINDS) {
    const ofKind = groups.filter((g) => archetypeBase(g.members[0]!.portrait ?? "") === kind);
    const lead = ofKind.find((g) => g.generic) ?? ofKind[0];
    const base = { kind, name: npcNameFromArchetype(kind), image: portraitUrl(kind, kind) };
    slots.push({ ...base, entry: lead ? entryOf(lead.name, lead.members) : null });
    if (lead) found += 1;
    for (const g of ofKind) if (g !== lead) slots.push({ ...base, entry: entryOf(g.name, g.members) });
  }
  return { slots, found, total: MONSTER_KINDS.length };
}
