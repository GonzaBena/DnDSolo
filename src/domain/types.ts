// Core domain types. Everything here is plain data: it is what gets saved,
// what the engine transforms and (in part) what the model sees.

export const DICE = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"] as const;
export type Die = (typeof DICE)[number];

export interface InventoryItem {
  name: string;
  quantity: number;
}

export interface Character {
  id: string;
  name: string;
  race: string;
  characterClass: string;
  level: number;
  background: string | null;
  hp: number;
  maxHp: number;
  inventory: InventoryItem[];
}

export interface RollRequest {
  die: Die;
  /** e.g. "Sigilo para pasar al guardia" */
  reason: string;
  /** Difficulty class, when the roll has one. */
  difficulty: number | null;
}

export interface RollResult extends RollRequest {
  value: number;
  /** Decided by code, never by the model. null when there was no difficulty. */
  success: boolean | null;
}

export type Attitude = "friendly" | "neutral" | "hostile";
export type QuestStatus = "active" | "completed" | "failed";

export interface Location {
  name: string;
  description: string;
}

export interface Npc {
  name: string;
  description: string;
  attitude: Attitude;
}

export interface Quest {
  title: string;
  description: string;
  status: QuestStatus;
}

/** What the model may *propose*. applyStateChanges decides what is applied. */
export type StateChange =
  | { type: "hp"; playerId: string; delta: number }
  | { type: "inventory_add"; playerId: string; item: string; quantity: number }
  | { type: "inventory_remove"; playerId: string; item: string; quantity: number }
  | { type: "location"; name: string; description: string }
  | { type: "npc"; name: string; description: string; attitude: Attitude }
  | { type: "quest"; title: string; description: string; status: QuestStatus };

export interface DMResponse {
  /** Text the player reads. */
  narration: string;
  rollRequest: RollRequest | null;
  stateChanges: StateChange[];
  /** Tags such as "damage" or "scene_change", kept to hook animations later. */
  events: string[];
}

export type TurnInput =
  | { type: "start" }
  | { type: "action"; text: string }
  | { type: "roll"; result: RollResult };

export interface Turn {
  number: number;
  input: TurnInput;
  narration: string;
  events: string[];
}

export interface GameState {
  id: string;
  /** Bumped when the saved shape changes, so old saves can be migrated. */
  version: number;
  createdAt: string;
  updatedAt: string;
  /** An array even though the MVP is solo, so multiplayer doesn't force a
      rewrite of the model (Spec, architecture rule 5). */
  players: Character[];
  location: Location;
  npcs: Npc[];
  quests: Quest[];
  /** Memory layer 2: running summary of everything up to summarizedThroughTurn. */
  summary: string;
  summarizedThroughTurn: number;
  /** Full log, for display and for building summaries. The model only ever
      receives the last few. */
  turns: Turn[];
  pendingRoll: RollRequest | null;
}

export const GAME_STATE_VERSION = 1;
