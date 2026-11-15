import { createGame } from "../src/domain/character";
import type { DMResponse, GameState } from "../src/domain/types";

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
    rollRequest: null,
    stateChanges: [],
    events: [],
    ...overrides,
  };
}
