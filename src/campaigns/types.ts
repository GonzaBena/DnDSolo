import type { Location, Npc, Quest, StoryItem, Thread } from "../domain/types";

export interface CampaignAct {
  number: 1 | 2 | 3;
  title: string;
  /** Title of the quest that closes this act once marked completed or failed. */
  closesWhenCompleted: string;
  /** Title of the secret threat thread whose resolution also closes Act 3. */
  closesWhenThreadResolved?: string;
  /** Concise DM instructions for this act only (objectives, triggers and milestone). */
  dmGuidance: string;
}

export interface CampaignLocation {
  name: string;
  /** Lowercase accent-free keywords to match `state.location.name` flexibly. */
  keywords: string[];
  /** One-line summary shown in the index of other places when the player is elsewhere. */
  indexLine: string;
  /** Secret DM details (atmosphere, clues, items and NPCs/enemies with their stats) sent ONLY when here. */
  dmDetails: string;
}

export interface OfficialCampaign {
  id: string;
  title: string;
  /** Short badge shown on the selection card, e.g. "Frontera y ruinas · Niveles 1 a 3". */
  tag: string;
  startingLevel: number;
  maxLevel: number;
  /** Public premise shown on the selector card, in /generator and in the Info drawer. */
  synopsis: string;
  /** Hook passed to the character generator so the 3 concepts fit the opening scene. */
  generatorPromptHook: string;
  /** Instruction for Turn 1 (`input.type === "start"`). */
  startPrompt: string;
  /** Always-present 2-3 sentence compass so the DM never contradicts the central truth. */
  dmCompass: string;
  /** Seeded into `GameState` when the campaign is created (Turn 0). */
  initialState: {
    location: Location;
    /** Only NPCs present in the opening scene (`present: true`), to avoid spoiling un-met NPCs in InfoDrawer. */
    npcs: Npc[];
    quests: Quest[];
    threads: Thread[];
    storyItems: StoryItem[];
  };
  acts: readonly [CampaignAct, CampaignAct, CampaignAct];
  locations: readonly CampaignLocation[];
}
