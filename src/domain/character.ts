import { GAME_STATE_VERSION, type Character, type GameState } from "./types";

export interface ClassOption {
  id: string;
  /** Shown to the player and sent to the model, hence Spanish. */
  label: string;
  hitDie: number;
}

export const CLASSES: ClassOption[] = [
  { id: "barbarian", label: "Bárbaro", hitDie: 12 },
  { id: "bard", label: "Bardo", hitDie: 8 },
  { id: "cleric", label: "Clérigo", hitDie: 8 },
  { id: "druid", label: "Druida", hitDie: 8 },
  { id: "fighter", label: "Guerrero", hitDie: 10 },
  { id: "monk", label: "Monje", hitDie: 8 },
  { id: "paladin", label: "Paladín", hitDie: 10 },
  { id: "ranger", label: "Explorador", hitDie: 10 },
  { id: "rogue", label: "Pícaro", hitDie: 8 },
  { id: "sorcerer", label: "Hechicero", hitDie: 6 },
  { id: "warlock", label: "Brujo", hitDie: 8 },
  { id: "wizard", label: "Mago", hitDie: 6 },
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

/** Max die at level 1, then the average per level. There are no ability
    scores in the MVP, so no Constitution bonus. */
export function maxHpFor(hitDie: number, level: number): number {
  return hitDie + (level - 1) * (hitDie / 2 + 1);
}

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
  const maxHp = maxHpFor(option.hitDie, level);
  const background = input.background.trim();
  return {
    id: newId(),
    name: input.name.trim(),
    race: input.race,
    characterClass: option.label,
    level,
    background: background === "" ? null : background,
    hp: maxHp,
    maxHp,
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
    quests: [],
    summary: "",
    summarizedThroughTurn: 0,
    turns: [],
    pendingRoll: null,
  };
}
