import mock from "../../docs/partida-mock.json";
import { gameStateSchema } from "../domain/schemas";
import type { GameState } from "../domain/types";

/** The sample game in docs/, ready to be saved. It is validated because the
    file is edited by hand, and stamped with the current time so it becomes
    the latest save, which is the one the play screen opens. */
export function loadMockGame(now: Date = new Date()): GameState {
  return { ...gameStateSchema.parse(mock), updatedAt: now.toISOString() };
}
