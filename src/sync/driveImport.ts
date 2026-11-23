// The Drive half of the import dialog: what Drive holds, compared with this device.
import type { GameState } from "../domain/types";
import type { RemoteEntry } from "./types";

/** "same": identical here. "newer_remote": Drive moved ahead. "newer_local": this device is ahead. "new": not here. */
export type DriveRowStatus = "same" | "newer_remote" | "newer_local" | "new";

export interface DriveRow {
  id: string;
  name: string;
  status: DriveRowStatus;
  updatedAt: string;
}

export const STATUS_TEXT: Record<DriveRowStatus, string> = {
  same: "Ya la tenés",
  newer_remote: "Hay una versión más nueva",
  newer_local: "La tuya es más nueva",
  new: "Nueva",
};

const localName = (game: GameState): string => {
  const player = game.players[0];
  return player ? `${player.name}, ${player.characterClass} nivel ${player.level}` : "Sin personaje";
};

/** Pure. Deleted campaigns are left out; the newest comes first. */
export function driveRows(remote: RemoteEntry[], local: GameState[]): DriveRow[] {
  const localById = new Map(local.map((game) => [game.id, game]));
  return remote
    .filter((entry) => !entry.deleted)
    .map((entry) => {
      const here = localById.get(entry.id);
      const status: DriveRowStatus = !here
        ? "new"
        : here.updatedAt === entry.updatedAt
          ? "same"
          : entry.updatedAt > here.updatedAt
            ? "newer_remote"
            : "newer_local";
      const name = here ? localName(here) : (entry.hero ?? "Campaña sin nombre");
      return { id: entry.id, name, status, updatedAt: entry.updatedAt };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** How many rows "Traer de Drive" would bring down or update. */
export const pendingCount = (rows: DriveRow[]): number =>
  rows.filter((row) => row.status === "new" || row.status === "newer_remote").length;
