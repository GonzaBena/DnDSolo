import { GAME_STATE_VERSION, type Character, type GameState } from "./types";

export interface ClassOption {
  id: string;
  /** Shown to the player and sent to the model, hence Spanish. */
  label: string;
}

export const CLASSES: ClassOption[] = [
  { id: "barbarian", label: "Bárbaro" },
  { id: "bard", label: "Bardo" },
  { id: "cleric", label: "Clérigo" },
  { id: "druid", label: "Druida" },
  { id: "fighter", label: "Guerrero" },
  { id: "monk", label: "Monje" },
  { id: "paladin", label: "Paladín" },
  { id: "ranger", label: "Explorador" },
  { id: "rogue", label: "Pícaro" },
  { id: "sorcerer", label: "Hechicero" },
  { id: "warlock", label: "Brujo" },
  { id: "wizard", label: "Mago" },
];

export const RACES: string[] = [
  "Humano",
  "Elfo",
  "Enano",
  "Mediano",
  "Gnomo",
  "Semielfo",
  "Semiorco",
  "Dracónido",
  "Tiefling",
];

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 20;

export interface CharacterInput {
  name: string;
  race: string;
  classId: string;
  level: number;
  background: string;
}

interface CreateOptions {
  newId?: () => string;
  now?: () => Date;
}

export function createCharacter(input: CharacterInput, newId: () => string): Character {
  const option = CLASSES.find((c) => c.id === input.classId);
  if (!option) throw new Error(`Unknown class: ${input.classId}`);
  const level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.trunc(input.level)));
  const background = input.background.trim();
  return {
    id: newId(),
    name: input.name.trim(),
    race: input.race,
    characterClass: option.label,
    level,
    background: background === "" ? null : background,
    inventory: [],
  };
}

export function createGame(input: CharacterInput, options: CreateOptions = {}): GameState {
  const newId = options.newId ?? (() => crypto.randomUUID());
  const timestamp = (options.now ?? (() => new Date()))().toISOString();
  return {
    id: newId(),
    version: GAME_STATE_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    players: [createCharacter(input, newId)],
    // Empty until the DM's opening turn proposes a location.
    location: { name: "", description: "" },
    npcs: [],
    scene: { inCombat: false, turnOf: null },
    quests: [],
    summary: "",
    summarizedThroughTurn: 0,
    turns: [],
    pendingPlayerRoll: null,
    pendingEnemyRolls: [],
  };
}
