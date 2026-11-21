import { findClass } from "../rules";
import type { Character, GameState, StateChange, StoryItem } from "./types";

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

  // A new place is a new scene: nobody from the last one comes along unless
  // the DM marks them present again. Done before the loop so an "npc"
  // change listed ahead of the "location" one in the same turn still counts.
  const moves = changes.some(
    (c) => c.type === "location" && !sameName(c.name, state.location.name),
  );
  // Where the party ends up this turn: objects mentioned in it are seen
  // there, whatever order the changes came in.
  const finalLocation =
    changes.findLast((c) => c.type === "location")?.name.trim() ?? state.location.name;

  if (moves) {
    next = {
      ...next,
      npcs: next.npcs.map((n) => ({ ...n, present: false })),
      scene: { ...next.scene, turnOf: null },
    };
  }

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
      case "level": {
        const index = findPlayerIndex(next.players, change.playerId);
        if (index === -1) {
          rejected.push({ change, reason: "Unknown player." });
          break;
        }
        // Against the level before this reply, so a reply raises each player one level at most.
        const before = state.players[index]!;
        if (change.level !== before.level + 1 || next.players[index]!.level !== before.level || change.level > 20) {
          rejected.push({ change, reason: "Level changes go one at a time." });
          break;
        }
        updatePlayer(index, (p) => ({ ...p, level: change.level }));
        break;
      }
      case "subclass": {
        const index = findPlayerIndex(next.players, change.playerId);
        if (index === -1) {
          rejected.push({ change, reason: "Unknown player." });
          break;
        }
        const player = next.players[index]!;
        const subclass = findClass(player.classId ?? player.characterClass)?.subclass;
        if (!subclass || subclass.id !== change.subclassId) {
          rejected.push({ change, reason: "That is not the SRD subclass of the player's class." });
          break;
        }
        if (player.subclassId !== null) {
          rejected.push({ change, reason: "The player already has a subclass." });
          break;
        }
        if (player.level < subclass.level) {
          rejected.push({ change, reason: "The player hasn't reached the subclass level." });
          break;
        }
        updatePlayer(index, (p) => ({ ...p, subclassId: subclass.id }));
        break;
      }
      case "location":
        next = { ...next, location: { name: change.name, description: change.description } };
        break;
      case "npc": {
        const existing = next.npcs.find((n) => sameName(n.name, change.name));
        const npc = {
          name: change.name,
          description: change.description,
          attitude: change.attitude,
          present: change.present,
          voice: change.voice.trim() || existing?.voice || "",
          portrait: change.portrait ?? existing?.portrait ?? null,
        };
        next = { ...next, npcs: upsert(next.npcs, npc, (n) => sameName(n.name, change.name)) };
        break;
      }
      case "scene":
        next = { ...next, scene: { inCombat: change.inCombat, turnOf: change.turnOf } };
        break;
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
      case "item": {
        const existing = next.storyItems.find((i) => sameName(i.name, change.name));
        const item: StoryItem = {
          name: existing?.name ?? change.name.trim(),
          description: change.description.trim() || existing?.description || "",
          // Seen again within reach means it is here now; gone keeps where it was last.
          location: change.status === "available" ? finalLocation : (existing?.location ?? finalLocation),
          status: change.status,
        };
        next = {
          ...next,
          storyItems: upsert(next.storyItems, item, (i) => sameName(i.name, change.name)),
        };
        break;
      }
    }
  }

  return { state: settleTurn(syncStoryItems(next), changes, rejected), rejected };
}

/** Inventories are the truth about who holds what: anything carried is
    "taken" (and recorded if the DM never announced it), and anything no
    longer carried that wasn't left within reach again is "gone". */
function syncStoryItems(state: GameState): GameState {
  const held = new Map<string, string>();
  for (const player of state.players) {
    for (const item of player.inventory) {
      const key = item.name.trim().toLowerCase();
      if (!held.has(key)) held.set(key, item.name);
    }
  }
  const storyItems: StoryItem[] = state.storyItems.map((item) => {
    const key = item.name.trim().toLowerCase();
    if (held.has(key)) {
      held.delete(key);
      return item.status === "taken" ? item : { ...item, status: "taken" };
    }
    return item.status === "taken" ? { ...item, status: "gone" } : item;
  });
  for (const name of held.values()) {
    storyItems.push({ name, description: "", location: state.location.name, status: "taken" });
  }
  return { ...state, storyItems };
}

/** The turn can only belong to someone who is in the scene. A name that
    matches nobody (or someone who just left) hands it back to the player
    instead of leaving the drawer with no one highlighted. */
function settleTurn(state: GameState, changes: StateChange[], rejected: RejectedChange[]): GameState {
  const { turnOf } = state.scene;
  if (turnOf === null) return state;
  const inScene = [
    ...state.players.map((p) => p.name),
    ...state.npcs.filter((n) => n.present).map((n) => n.name),
  ];
  const match = inScene.find((name) => sameName(name, turnOf));
  if (match !== undefined) return { ...state, scene: { ...state.scene, turnOf: match } };
  const change = changes.findLast((c) => c.type === "scene");
  if (change) rejected.push({ change, reason: "Nobody by that name is in the scene." });
  return { ...state, scene: { ...state.scene, turnOf: null } };
}
