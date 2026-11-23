// Sync preferences live in localStorage, like the rest of the user settings.

export interface SyncConfig {
  enabled: boolean;
  autoRenew: boolean;
}

const STORAGE_KEY = "dnsolo.sync";

export function loadSyncConfig(): SyncConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { enabled: false, autoRenew: false };
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    return { enabled: parsed?.enabled === true, autoRenew: parsed?.autoRenew === true };
  } catch {
    // Blocked storage or corrupt JSON both mean "sync off".
    return { enabled: false, autoRenew: false };
  }
}

export function saveSyncConfig(config: SyncConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Blocked storage: the preference just won't persist.
  }
}
