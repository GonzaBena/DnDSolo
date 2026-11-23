export type SyncState = "off" | "idle" | "syncing" | "offline" | "reconnect" | "error";

export interface SyncStatus {
  state: SyncState;
  lastSyncedAt: string | null;
}

type Listener = (status: SyncStatus) => void;

let current: SyncStatus = { state: "off", lastSyncedAt: null };
const listeners = new Set<Listener>();

export const syncStatus = {
  get(): SyncStatus {
    return current;
  },
  set(patch: Partial<SyncStatus>): void {
    current = { ...current, ...patch };
    for (const listener of listeners) listener(current);
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
