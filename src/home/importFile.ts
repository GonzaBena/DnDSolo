import type { GameState } from "../domain/types";
import { migrateSave } from "../persistence/migrations";
import { matchImport } from "./importMatch";

/**
 * What to do with an imported file. "invalid": not a campaign. "unreadable":
 * this device's saves could not be read. "same": already here, nothing to do.
 * "new": save it. "conflict": a different version of a campaign already here.
 */
export type ImportDecision =
  | { kind: "invalid" }
  | { kind: "unreadable" }
  | { kind: "same"; game: GameState }
  | { kind: "new"; game: GameState }
  | { kind: "conflict"; game: GameState; newer: boolean };

/** Same gate as loading from disk: migrate, validate, or refuse. */
export async function decideImport(
  text: string,
  loadExisting: (id: string) => Promise<GameState | null>,
): Promise<ImportDecision> {
  let game: GameState | null;
  try {
    game = migrateSave(JSON.parse(text));
  } catch {
    game = null;
  }
  if (!game) return { kind: "invalid" };
  let existing: GameState | null;
  try {
    existing = await loadExisting(game.id);
  } catch {
    return { kind: "unreadable" };
  }
  const match = matchImport(game, existing);
  if (match === "same" || match === "new") return { kind: match, game };
  return { kind: "conflict", game, newer: match === "newer" };
}

/** The question asked when the file and this device hold different versions. */
export function conflictQuestion(name: string, newer: boolean): string {
  return newer
    ? `Ya tenés «${name}». La del archivo es más nueva.`
    : `Ya tenés «${name}», y la tuya es más nueva que la del archivo.`;
}
