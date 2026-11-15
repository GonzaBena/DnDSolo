import type { Character, GameState, StateChange } from "./types";

export interface RejectedChange {
  change: StateChange;
  reason: string;
}

export interface ApplyResult {
  state: GameState;
  rejected: RejectedChange[];
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function findPlayerIndex(players: Character[], playerId: string): number {
  const index = players.findIndex((p) => p.id === playerId);
  if (index !== -1) return index;
  // Models occasionally garble ids. With a single player there is no
  // ambiguity about who was meant, so don't drop the change over it.
  return players.length === 1 ? 0 : -1;
}

function upsert<T>(list: T[], item: T, matches: (existing: T) => boolean): T[] {
  const index = list.findIndex(matches);
  if (index === -1) return [...list, item];
  return list.map((existing, i) => (i === index ? item : existing));
}

/** The referee: the model proposes changes, this decides what actually
    happens. Never mutates `state`; impossible changes are clamped or
    returned in `rejected` instead of throwing, so one bad proposal can't
    break a turn. */
export function applyStateChanges(state: GameState, changes: StateChange[]): ApplyResult {
  let next = state;
  const rejected: RejectedChange[] = [];

  const updatePlayer = (index: number, update: (player: Character) => Character) => {
    next = { ...next, players: next.players.map((p, i) => (i === index ? update(p) : p)) };
  };

  for (const change of changes) {
    switch (change.type) {
      case "inventory_add": {
        const index = findPlayerIndex(next.players, change.playerId);
        if (index === -1) {
          rejected.push({ change, reason: "Unknown player." });
          break;
        }
        updatePlayer(index, (p) => {
          const existing = p.inventory.find((i) => sameName(i.name, change.item));
          const inventory = existing
            ? p.inventory.map((i) =>
                i === existing ? { ...i, quantity: i.quantity + change.quantity } : i,
              )
            : [...p.inventory, { name: change.item.trim(), quantity: change.quantity }];
          return { ...p, inventory };
        });
        break;
      }
      case "inventory_remove": {
        const index = findPlayerIndex(next.players, change.playerId);
        if (index === -1) {
          rejected.push({ change, reason: "Unknown player." });
          break;
        }
        const player = next.players[index]!;
        if (!player.inventory.some((i) => sameName(i.name, change.item))) {
          rejected.push({ change, reason: "The player doesn't have that item." });
          break;
        }
        updatePlayer(index, (p) => ({
          ...p,
          inventory: p.inventory
            .map((i) =>
              sameName(i.name, change.item) ? { ...i, quantity: i.quantity - change.quantity } : i,
            )
            .filter((i) => i.quantity > 0),
        }));
        break;
      }
      case "location":
        next = { ...next, location: { name: change.name, description: change.description } };
        break;
      case "npc": {
        const npc = {
          name: change.name,
          description: change.description,
          attitude: change.attitude,
        };
        next = { ...next, npcs: upsert(next.npcs, npc, (n) => sameName(n.name, change.name)) };
        break;
      }
      case "quest": {
        const quest = {
          title: change.title,
          description: change.description,
          status: change.status,
        };
        next = {
          ...next,
          quests: upsert(next.quests, quest, (q) => sameName(q.title, change.title)),
        };
        break;
      }
    }
  }

  return { state: next, rejected };
}
