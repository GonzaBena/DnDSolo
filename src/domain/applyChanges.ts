import { findClass } from "../rules";
import { addFailures } from "./deathSaves";
import { npcNameFromArchetype } from "./portraits";
import { MILESTONES_PER_LEVEL, type Character, type GameState, type StateChange, type StoryItem } from "./types";

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

/** Resolves a player by id, then by name (any case); a lone player is always meant. */
function findPlayerByTarget(players: Character[], target: string): number {
  const byId = findPlayerIndex(players, target);
  if (players.length === 1 || players[byId]?.id === target) return byId;
  const byName = players.findIndex((p) => sameName(p.name, target));
  return byName !== -1 ? byName : byId;
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
  let milestoneGiven = false;

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
        // Against `next`, so a quest completed earlier in this reply counts.
        if (next.players[index]!.milestonesSinceLevel < MILESTONES_PER_LEVEL) {
          rejected.push({ change, reason: "Not enough milestones for a new level." });
          break;
        }
        updatePlayer(index, (p) => ({ ...p, level: change.level, milestonesSinceLevel: 0 }));
        break;
      }
      case "milestone": {
        const index = findPlayerIndex(next.players, change.playerId);
        if (index === -1) {
          rejected.push({ change, reason: "Unknown player." });
          break;
        }
        if (milestoneGiven) {
          rejected.push({ change, reason: "One milestone per reply." });
          break;
        }
        milestoneGiven = true;
        updatePlayer(index, (p) => ({ ...p, milestonesSinceLevel: p.milestonesSinceLevel + 1 }));
        break;
      }
      case "hp": {
        const index = findPlayerByTarget(next.players, change.target);
        if (index === -1) {
          rejected.push({ change, reason: "Unknown player." });
          break;
        }
        const player = next.players[index]!;
        if (player.stats === null || player.currentHp === null) {
          rejected.push({ change, reason: "That character has no hit points tracked." });
          break;
        }
        if (player.condition === "dead") {
          rejected.push({ change, reason: "The character is dead." });
          break;
        }
        const max = player.stats.maxHp;
        updatePlayer(index, (p) => {
          const before = p.currentHp ?? 0;
          const currentHp = Math.min(max, Math.max(0, before + change.delta));
          // Damage taken at 0 HP is a failed death save (a stable character starts dying again).
          if (change.delta < 0 && before === 0) return addFailures({ ...p, currentHp }, 1);
          if (currentHp === 0) return { ...p, currentHp, condition: "dying" };
          if (p.condition !== "ok") return { ...p, currentHp, condition: "ok", deathSaves: { successes: 0, failures: 0 } };
          return { ...p, currentHp };
        });
        break;
      }
      case "rest": {
        if (change.kind === "short") break;
        if (next.scene.inCombat) {
          rejected.push({ change, reason: "Can't rest during combat." });
          break;
        }
        if (next.players.some((p) => p.condition === "dead")) {
          rejected.push({ change, reason: "The character is dead." });
          break;
        }
        if (next.players.some((p) => p.condition === "dying")) {
          rejected.push({ change, reason: "Can't rest while dying." });
          break;
        }
        next = {
          ...next,
          players: next.players.map((p) => ({
            ...p,
            currentHp: p.stats === null ? p.currentHp : p.stats.maxHp,
            condition: "ok",
            deathSaves: { successes: 0, failures: 0 },
          })),
        };
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
        const name = npcNameFromArchetype(change.name);
        const existing = next.npcs.find((n) => sameName(n.name, name));
        const npc = {
          name,
          // Like voice: an empty description keeps the stored one (absent NPCs reach the model without it).
          description: change.description.trim() || existing?.description || "",
          attitude: change.attitude,
          present: change.present,
          voice: change.voice.trim() || existing?.voice || "",
          // The first portrait sticks: an NPC keeps their face for the whole game.
          portrait: existing?.portrait ?? change.portrait ?? null,
        };
        next = { ...next, npcs: upsert(next.npcs, npc, (n) => sameName(n.name, name)) };
        break;
      }
      case "scene":
        next = {
          ...next,
          scene: {
            inCombat: change.inCombat,
            turnOf: change.turnOf === null ? null : npcNameFromArchetype(change.turnOf),
          },
        };
        break;
      case "quest": {
        const existing = next.quests.find((q) => sameName(q.title, change.title));
        const quest = {
          title: change.title,
          // Closed quests are sent back to the DM without a description, so an
          // empty one keeps what is stored.
          description: change.description.trim() || existing?.description || "",
          status: change.status,
        };
        next = {
          ...next,
          quests: upsert(next.quests, quest, (q) => sameName(q.title, change.title)),
        };
        // Finishing a quest the party had taken on is a milestone for everyone.
        if (existing?.status === "active" && change.status === "completed") {
          next = {
            ...next,
            players: next.players.map((p) => ({ ...p, milestonesSinceLevel: p.milestonesSinceLevel + 1 })),
          };
        }
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
