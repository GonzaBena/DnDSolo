// Core domain types. Everything here is plain data: it is what gets saved,
// what the engine transforms and (in part) what the model sees.

import type { HealthLabel } from "./health";
import type { PortraitId } from "./portraits";
import type { CharacterChoices } from "../rules/buildSheet";

export const DICE = ["d4", "d6", "d8", "d10", "d12", "d20", "d100"] as const;
export type Die = (typeof DICE)[number];

export interface InventoryItem {
  name: string;
  quantity: number;
}

export interface CharacterStats {
  maxHp: number;
  armorClass: number;
  initiative: number;
  speed: number;
  hitDice: string;
  attacks: { name: string; attackBonus: number; damage: string }[];
  spellSaveDc: number | null;
  spellAttackBonus: number | null;
}

/** "dying": at 0 HP, rolling death saves. "stable": at 0 HP, no longer
    rolling. "dead": the story is over for them. */
export type Condition = "ok" | "dying" | "stable" | "dead";

export interface DeathSaves {
  successes: number;
  failures: number;
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
  /** Starts with the character's starting gear (from the sheet, when there is
      one) and then changes only through the DM's inventory changes. */
  inventory: InventoryItem[];
  /** Combat stats; null until the sheet fills them in (and for older saves). */
  stats: CharacterStats | null;
  /** Current hit points; null exactly when `stats` is null. */
  currentHp: number | null;
  condition: Condition;
  /** Only meaningful while dying; cleared whenever the character gets up or stabilizes. */
  deathSaves: DeathSaves;
  /** Milestones earned since the last level up. */
  milestonesSinceLevel: number;
  /** The rules choices the sheet is built from; `choices.level` is the level
      they were made up to. Null for manual sheets and saves made before v17. */
  choices: CharacterChoices | null;
  /** What the player noted outside the SRD 5.2 (for the DM), and a subclass from their manual. */
  outsideSrd: OutsideSrd;
}

export interface OutsideSrd {
  /** Free text, up to 1000 characters. */
  note: string;
  /** Name of a subclass outside the SRD; while set, the SRD subclass doesn't apply. */
  subclass: string | null;
}

export const ROLL_MODES = ["normal", "advantage", "disadvantage"] as const;
export type RollMode = (typeof ROLL_MODES)[number];

/** A roll the DM asks the *player* for. The app never rolls it: the player
    rolls their own dice, applies their own modifiers and types the total
    in the chat. This only exists to show the request clearly. */
export interface PlayerRollRequest {
  die: Die;
  /** How many dice are added up. Advantage is a mode, not a count of 2. */
  count: number;
  /** e.g. "Sigilo para pasar al guardia" */
  reason: string;
  /** Difficulty class, when the roll has one. */
  difficulty: number | null;
  mode: RollMode;
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
  /** Advantage or disadvantage; `value` is then the die that was kept. */
  mode?: RollMode | undefined;
  /** Both d20 of an advantage or disadvantage roll. */
  rolls?: [number, number] | undefined;
}

/** A roll for an enemy or NPC. These are the only dice the app rolls. */
export interface EnemyRollRequest {
  die: Die;
  count: number;
  /** Flat bonus the DM assigns to the creature, e.g. +4 to hit. */
  modifier: number;
  reason: string;
  /** Advantage or disadvantage: two dice are rolled and one is kept. */
  mode: RollMode;
}

export interface EnemyRollResult extends EnemyRollRequest {
  /** Each die as rolled by code, never by the model. With advantage or
      disadvantage these are the two dice rolled. */
  values: number[];
  /** Sum of values (the kept die with advantage or disadvantage) plus
      modifier. */
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
  /** Hit points, tracked by code once the DM sets `maxHp`; null for NPCs nobody fights. */
  hp: number | null;
  maxHp: number | null;
  /** Whether they have ever been in the scene (false while only mentioned).
      Absent in saves from before it was tracked: treat as seen. */
  seen?: boolean;
}

/** What is happening right now, for the scene drawer. */
export interface Scene {
  inCombat: boolean;
  /** Name of whoever acts now: a player or an NPC in the scene. null means
      the player, which is the resting state between DM replies. */
  turnOf: string | null;
  /** Initiative order during a fight, highest first; [] outside one. */
  order: string[];
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

export type ThreadKind = "goal" | "threat" | "mystery";
export type ThreadStatus = "open" | "resolved";

/** A campaign thread: what drives the character, what moves against them,
    what is still unexplained. `secret` ones are hidden from the player
    until the DM reveals them, and once revealed they stay visible. */
export interface Thread {
  title: string;
  kind: ThreadKind;
  description: string;
  status: ThreadStatus;
  secret: boolean;
}

/** What the model may *propose*. applyStateChanges decides what is applied. */
export type StateChange =
  | { type: "inventory_add"; playerId: string; item: string; quantity: number }
  | { type: "inventory_remove"; playerId: string; item: string; quantity: number }
  /** Needs MILESTONES_PER_LEVEL milestones since the last level, and spends them. */
  | { type: "level"; playerId: string; level: number }
  /** A big achievement (a boss beaten, a central mystery solved); one per reply. */
  | { type: "milestone"; playerId: string; reason: string }
  /** A long rest restores every player's HP; a short one changes nothing by
      itself (hit dice come as "hp" changes). */
  | { type: "rest"; kind: "short" | "long" }
  /** Hit points gained (+) or lost (-). `target` is a player id or name. */
  | {
      type: "hp";
      target: string;
      delta: number;
      /** Damage from a critical hit: at 0 HP it is two failed death saves. */
      critical?: boolean | undefined;
    }
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
      /** Only counts the first time it is set; null means it has no hit points. */
      maxHp: number | null;
    }
  /** `order`: initiative, highest first; [] keeps the current one. Ending
      the fight clears it. */
  | { type: "scene"; inCombat: boolean; turnOf: string | null; order: string[] }
  | { type: "quest"; title: string; description: string; status: QuestStatus }
  /** Upserted by title; an empty description keeps the stored one. */
  | {
      type: "thread";
      title: string;
      kind: ThreadKind;
      description: string;
      status: ThreadStatus;
      secret: boolean;
    }
  /** An object the narration put within reach, or that stopped being there.
      Taking it is an inventory_add with the same name. */
  | { type: "item"; name: string; description: string; status: Exclude<StoryItemStatus, "taken"> };

export const TURN_EVENTS = [
  "damage_taken",
  "damage_dealt",
  "healing",
  "scene_change",
  "combat_start",
  "combat_end",
  "item_gained",
  "new_npc",
  "new_quest",
  "quest_completed",
  "level_up",
  "death",
] as const;
export type TurnEvent = (typeof TURN_EVENTS)[number];

export interface DMResponse {
  /** Text the player reads. */
  narration: string;
  playerRoll: PlayerRollRequest | null;
  enemyRolls: EnemyRollRequest[];
  stateChanges: StateChange[];
  /** Tags such as "damage_taken" or "scene_change", kept to hook animations. */
  events: TurnEvent[];
  /** Up to three short actions the player could take next; [] with a roll pending. */
  suggestions: string[];
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
  | { type: "enemy_rolls"; results: EnemyRollResult[] }
  /** The d20 the player rolled for a death save, resolved by applyDeathSave. */
  | { type: "death_save"; playerId: string; natural: number };

/** Someone who walked into the scene in a turn, as they were then: the
    log keeps showing them that way even if they change later. */
export interface Arrival {
  name: string;
  attitude: Attitude;
  /** Same loose type as Npc.portrait. */
  portrait: string | null;
  /** First sentence of their description; "" when there is none. */
  blurb: string;
  /** Known from before, back in the scene after being away. */
  returning: boolean;
  /** How they look; null when untracked or unhurt ("Ileso"). */
  health: Exclude<HealthLabel, "Ileso"> | null;
}

/** A new place reached in a turn, as it was then: the log marks where each
    chapter of the story began. */
export interface Chapter {
  name: string;
  description: string;
  /** No earlier turn opened a chapter with this name. */
  firstVisit: boolean;
}

/** Something a turn changed that the campaign's timeline keeps. */
export type Moment =
  | { kind: "quest"; title: string; status: QuestStatus }
  | { kind: "level"; level: number }
  | { kind: "death" };

export interface Turn {
  number: number;
  input: TurnInput;
  narration: string;
  events: string[];
  /** Who walked into the scene this turn; absent when nobody did (and in
      turns saved before arrivals were recorded). */
  arrivals?: Arrival[];
  /** The place this turn moved to; absent when it stayed put (and in turns
      saved before chapters were recorded). */
  chapter?: Chapter;
  /** Quests, levels and death this turn brought; absent when none (and in
      turns saved before they were recorded). */
  moments?: Moment[];
}

export interface GameState {
  id: string;
  /** Bumped when the saved shape changes, so old saves can be migrated. */
  version: number;
  createdAt: string;
  updatedAt: string;
  /** Id in OFFICIAL_CAMPAIGNS when playing an official module; null for a free adventure. */
  campaignId: string | null;
  /** An array even though the MVP is solo, so multiplayer doesn't force a
      rewrite of the model (Spec, architecture rule 5). */
  players: Character[];
  location: Location;
  npcs: Npc[];
  scene: Scene;
  quests: Quest[];
  threads: Thread[];
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
  /** Short actions the DM suggested for the player's next move. */
  suggestedActions: string[];
}

/** Milestones needed since the last level to gain a new one. */
export const MILESTONES_PER_LEVEL = 2;

export const GAME_STATE_VERSION = 18;
