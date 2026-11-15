import mock from "../../docs/partida-mock.json";
import type { GameState } from "../domain/types";
import { migrateSave } from "./migrations";

/** The sample game in docs/, ready to be saved. It is validated because the
    file is edited by hand, and stamped with the current time so it becomes
    the latest save, which is the one the play screen opens. */
export function loadMockGame(now: Date = new Date()): GameState {
  const game = migrateSave(mock);
  if (!game) throw new Error("docs/partida-mock.json is not a valid save.");
  return { ...game, updatedAt: now.toISOString() };
}
