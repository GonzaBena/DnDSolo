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
  /** Story items the DM handed out. The player's real sheet (HP, stats,
      modifiers) lives with the player, not here. */
  inventory: InventoryItem[];
}

/** A roll the DM asks the *player* for. The app never rolls it: the player
    rolls their own dice, applies their own modifiers and types the total
    in the chat. This only exists to show the request clearly. */
export interface PlayerRollRequest {
  die: Die;
  count: number;
  /** e.g. "Sigilo para pasar al guardia" */
  reason: string;
  /** Difficulty class, when the roll has one. */
  difficulty: number | null;
}

/** A roll for an enemy or NPC. These are the only dice the app rolls. */
export interface EnemyRollRequest {
  die: Die;
  count: number;
  /** Flat bonus the DM assigns to the creature, e.g. +4 to hit. */
  modifier: number;
  reason: string;
}

export interface EnemyRollResult extends EnemyRollRequest {
  /** Each die as rolled by code, never by the model. */
  values: number[];
  /** Sum of values plus modifier. */
  total: number;
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
  | { type: "inventory_add"; playerId: string; item: string; quantity: number }
  | { type: "inventory_remove"; playerId: string; item: string; quantity: number }
  | { type: "location"; name: string; description: string }
  | { type: "npc"; name: string; description: string; attitude: Attitude }
  | { type: "quest"; title: string; description: string; status: QuestStatus };

export interface DMResponse {
  /** Text the player reads. */
  narration: string;
  playerRoll: PlayerRollRequest | null;
  enemyRolls: EnemyRollRequest[];
  stateChanges: StateChange[];
  /** Tags such as "damage" or "scene_change", kept to hook animations later. */
  events: string[];
}

export type TurnInput =
  | { type: "start" }
  /** `playerId` says whose character spoke. Optional because saves from
      before it existed don't have it; those belong to the only player. */
  | { type: "action"; text: string; playerId?: string | undefined }
  /** Sent automatically by the app after rolling what the DM asked for. */
  | { type: "enemy_rolls"; results: EnemyRollResult[] };

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
  /** What the DM last asked the player to roll; informative only, the
      player answers in free text. */
  pendingPlayerRoll: PlayerRollRequest | null;
  /** Enemy rolls the DM asked for and the app still has to roll and send. */
  pendingEnemyRolls: EnemyRollRequest[];
}

export const GAME_STATE_VERSION = 2;
