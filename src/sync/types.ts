export interface LocalEntry {
  id: string;
  updatedAt: string;
  turnCount: number;
}

export interface RemoteEntry {
  id: string;
  updatedAt: string;
  turnCount: number;
  deleted: boolean;
  /** "Aria, Mago nivel 3": lets a device name a campaign it hasn't downloaded. Missing on files from older versions. */
  hero?: string;
}

/** gameId -> updatedAt that both sides agreed on the last time they synced. */
export type Bases = Record<string, string>;

export type SyncAction =
  | { type: "upload"; id: string }
  | { type: "download"; id: string }
  | { type: "delete_local"; id: string }
  | { type: "tombstone"; id: string }
  | { type: "forget_base"; id: string }
  | { type: "mark_synced"; id: string; updatedAt: string }
  | { type: "conflict"; id: string; kind: "both_changed" | "deleted_remotely" };
