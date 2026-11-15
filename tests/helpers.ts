import { createGame } from "../src/domain/character";
import type { DMResponse, GameState } from "../src/domain/types";
import type { CharacterChoices } from "../src/rules/buildSheet";

export function newGame(): GameState {
  let counter = 0;
  return createGame(
    { name: "Lira", race: "Elfo", classId: "rogue", level: 3, background: "" },
    { newId: () => `id-${(counter += 1)}`, now: () => new Date("2026-01-01T00:00:00Z") },
  );
}

export const PLAYER_ID = "id-2"; // id-1 is the game itself

export function reply(overrides: Partial<DMResponse> = {}): DMResponse {
  return {
    narration: "Llegás a la posada del Ciervo Blanco.",
    playerRoll: null,
    enemyRolls: [],
    stateChanges: [],
    events: [],
    ...overrides,
  };
}

/** A valid level 1 human fighter with the soldier background. */
export function fighterChoices(overrides: Partial<CharacterChoices> = {}): CharacterChoices {
  return {
    speciesId: "human",
    classId: "fighter",
    backgroundId: "soldier",
    level: 1,
    baseScores: { str: 15, dex: 14, con: 13, int: 8, wis: 12, cha: 10 },
    backgroundBonus: { str: 2, con: 1 },
    classEquipment: "A",
    backgroundEquipment: "A",
    picks: {
      "species.human.skillful": ["perception"],
      "species.human.versatile": ["alert"],
      "background.soldier.tool": ["dice"],
      "class.fighter.skills": ["acrobatics", "survival"],
      "class.fighter.fighting_style": ["defense"],
      "class.fighter.weapon_mastery": ["longsword", "greatsword", "longbow"],
    },
    ...overrides,
  };
}
