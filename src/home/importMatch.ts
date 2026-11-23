import type { GameState } from "../domain/types";

/**
 * How an imported file relates to the campaign already saved with its id.
 * "new": none here. "same": identical save. "newer"/"older": the file is ahead of or behind it.
 * Pure.
 */
export type ImportMatch = "new" | "same" | "newer" | "older";

export function matchImport(incoming: GameState, existing: GameState | null): ImportMatch {
  if (!existing) return "new";
  if (incoming.updatedAt === existing.updatedAt) return "same";
  return incoming.updatedAt > existing.updatedAt ? "newer" : "older";
}
