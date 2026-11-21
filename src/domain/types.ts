// Core domain types. Everything here is plain data: it is what gets saved,
// what the engine transforms and (in part) what the model sees.

import type { PortraitId } from "./portraits";

export const DICE = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"] as const;
export type Die = (typeof DICE)[number];

export interface InventoryItem {
  name: string;
  quantity: number;
}

export interface Character {
  id: string;
  name: string;
  /** Labels in Spanish, taken from the rules data. */
  race: string;
  characterClass: string;
  /** Ids in the SRD rules data; null for saves made before they existed. */
  speciesId: string | null;
  classId: string | null;
  subclassId: string | null;
  srdBackgroundId: string | null;
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

/** A roll the player made with their own dice and reported through the
    dice button. The app never rolls it: it only records what was typed. */
export interface PlayerRoll {
  die: Die;
  /** How many of `die`; 1 when missing. */
  count?: number | undefined;
  /** What the dice showed, added up. */
  value: number;
  modifier: number;
  /** What it was for, when the DM had asked for it. */
  reason?: string | undefined;
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
  /** Whether they are in the current scene. Moving to another location
      clears it for everyone; the DM marks who is around. */
  present: boolean;
  /** How they talk: tone, pet phrases, register. "" when the DM gave none. */
  voice: string;
  /** Portrait archetype (see domain/portraits.ts), null for initials. A
      string, not PortraitId, so an archetype dropped later keeps old saves
      loading. */
  portrait: string | null;
}

/** What is happening right now, for the scene drawer. */
export interface Scene {
  inCombat: boolean;
  /** Name of whoever acts now: a player or an NPC in the scene. null means
      the player, which is the resting state between DM replies. */
  turnOf: string | null;
}

/** "available": seen and within reach of being taken. "taken": some player
    carries it (derived from the inventories, never set by the model).
    "gone": used up, destroyed, carried off by someone else. */
export type StoryItemStatus = "available" | "taken" | "gone";

/** An object that showed up in the story: something the player could take,
    did take, or missed. Inventories say who holds what and how many; this
    is the record of everything that appeared, for the info drawer. */
export interface StoryItem {
  name: string;
  description: string;
  /** Name of the place where it was last seen; "" when unknown (old saves). */
  location: string;
  status: StoryItemStatus;
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
  | { type: "level"; playerId: string; level: number }
  /** The SRD subclass of the player's class, once its level is reached. */
  | { type: "subclass"; playerId: string; subclassId: string }
  | { type: "location"; name: string; description: string }
  /** An empty `voice` keeps the NPC's voice; their first portrait is kept for good. */
  | {
      type: "npc";
      name: string;
      description: string;
      attitude: Attitude;
      present: boolean;
      voice: string;
      portrait: PortraitId | null;
    }
  | { type: "scene"; inCombat: boolean; turnOf: string | null }
  | { type: "quest"; title: string; description: string; status: QuestStatus }
  /** An object the narration put within reach, or that stopped being there.
      Taking it is an inventory_add with the same name. */
  | { type: "item"; name: string; description: string; status: Exclude<StoryItemStatus, "taken"> };

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
  | {
      type: "action";
      /** May be empty when the turn is only a roll. */
      text: string;
      playerId?: string | undefined;
      roll?: PlayerRoll | undefined;
    }
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
  scene: Scene;
  quests: Quest[];
  storyItems: StoryItem[];
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

export const GAME_STATE_VERSION = 7;
