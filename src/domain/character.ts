import { findCampaign } from "../campaigns";
import { buildSheet, withSpecies, type CharacterChoices } from "../rules/buildSheet";
import { BACKGROUNDS, CLASSES_DATA, SPECIES, findBackground, findClass, findSpecies } from "../rules";
import { GAME_STATE_VERSION, type Character, type CharacterStats, type GameState, type InventoryItem, type StoryItem } from "./types";

export interface ClassOption {
  id: string;
  /** Shown to the player and sent to the model, hence Spanish. */
  label: string;
}

export const CLASSES: ClassOption[] = CLASSES_DATA.map((c) => ({ id: c.id, label: c.name }));
export const SPECIES_OPTIONS: ClassOption[] = SPECIES.map((s) => ({ id: s.id, label: s.name }));
export const BACKGROUND_OPTIONS: ClassOption[] = BACKGROUNDS.map((b) => ({ id: b.id, label: b.name }));

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 20;
export const OUTSIDE_SRD_NOTE_MAX = 1000;

export interface CharacterInput {
  name: string;
  speciesId: string;
  classId: string;
  subclassId: string | null;
  srdBackgroundId: string | null;
  level: number;
  background: string;
  /** From a generated sheet or the manual form; the game then tracks HP. */
  stats?: CharacterStats | null;
  /** Gear the character starts with, from a generated sheet. */
  startingInventory?: InventoryItem[];
  /** The generator's choices, so the form can rebuild the sheet when the species changes. */
  choices?: CharacterChoices;
  /** What the character has outside the SRD, for the DM (the generator's note, or typed on the form). */
  outsideSrdNote?: string;
  /** Official campaign module id; null or omitted for a free adventure. */
  campaignId?: string | null;
}

interface CreateOptions {
  newId?: () => string;
  now?: () => Date;
}

/** The generator's choices, only while they still describe this character and build a sheet. A species changed
    on the form after generating keeps the other picks when they still build (as the form's stats do). */
function matchingChoices(input: CharacterInput, level: number): CharacterChoices | null {
  if (!input.choices) return null;
  const c = withSpecies(input.choices, input.speciesId);
  const matches = c.classId === input.classId && c.backgroundId === input.srdBackgroundId && c.level === level;
  return matches && buildSheet(c).ok ? c : null;
}

export function createCharacter(input: CharacterInput, newId: () => string): Character {
  const species = findSpecies(input.speciesId);
  if (!species) throw new Error(`Unknown species: ${input.speciesId}`);
  const cls = findClass(input.classId);
  if (!cls) throw new Error(`Unknown class: ${input.classId}`);
  if (input.srdBackgroundId !== null && !findBackground(input.srdBackgroundId)) {
    throw new Error(`Unknown background: ${input.srdBackgroundId}`);
  }
  const level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.trunc(input.level)));
  if (input.subclassId !== null) {
    if (input.subclassId !== cls.subclass.id) throw new Error(`Unknown subclass for ${cls.id}: ${input.subclassId}`);
    if (level < cls.subclass.level) throw new Error(`Subclass ${input.subclassId} needs level ${cls.subclass.level}`);
  }
  const background = input.background.trim();
  return {
    id: newId(),
    name: input.name.trim(),
    race: species.name,
    characterClass: cls.name,
    speciesId: species.id,
    classId: cls.id,
    subclassId: input.subclassId,
    srdBackgroundId: input.srdBackgroundId,
    level,
    background: background === "" ? null : background,
    inventory: (input.startingInventory ?? []).map((item) => ({ ...item })),
    stats: input.stats ?? null,
    currentHp: input.stats?.maxHp ?? null,
    condition: "ok",
    deathSaves: { successes: 0, failures: 0 },
    milestonesSinceLevel: 0,
    choices: matchingChoices(input, level),
    outsideSrd: { note: (input.outsideSrdNote ?? "").trim().slice(0, OUTSIDE_SRD_NOTE_MAX), subclass: null },
  };
}

export function createGame(input: CharacterInput, options: CreateOptions = {}): GameState {
  const campaignId = input.campaignId ?? null;
  const campaign = findCampaign(campaignId);
  if (campaignId !== null && !campaign) throw new Error(`Unknown campaign: ${campaignId}`);
  const effectiveInput: CharacterInput = campaign ? { ...input, level: campaign.startingLevel } : input;
  const newId = options.newId ?? (() => crypto.randomUUID());
  const players = [createCharacter(effectiveInput, newId)];
  // The starting gear is already carried, so the first turn must not announce it as found.
  const gearItems: StoryItem[] = players[0]!.inventory.map((item) => ({
    name: item.name,
    description: "",
    location: "",
    status: "taken",
  }));
  const moduleItems: StoryItem[] = (campaign?.initialState.storyItems ?? []).map((item) => ({ ...item }));
  const timestamp = (options.now ?? (() => new Date()))().toISOString();
  return {
    id: newId(),
    version: GAME_STATE_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    campaignId: campaign?.id ?? null,
    players,
    // Empty until the DM's opening turn proposes a location, unless seeded by a campaign module.
    location: campaign ? { ...campaign.initialState.location } : { name: "", description: "" },
    npcs: campaign ? campaign.initialState.npcs.map((npc) => ({ ...npc })) : [],
    scene: { inCombat: false, turnOf: null, order: [] },
    quests: campaign ? campaign.initialState.quests.map((quest) => ({ ...quest })) : [],
    threads: campaign ? campaign.initialState.threads.map((thread) => ({ ...thread })) : [],
    storyItems: [...gearItems, ...moduleItems],
    summary: "",
    summarizedThroughTurn: 0,
    turns: [],
    pendingPlayerRoll: null,
    pendingEnemyRolls: [],
    suggestedActions: [],
  };
}
