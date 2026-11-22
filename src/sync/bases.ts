import type { Bases } from "./types";

const STORAGE_KEY = "dnsolo.sync.bases";

type AllBases = Record<string, Bases>;

function readAll(): AllBases {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as AllBases) : {};
  } catch {
    return {};
  }
}

function writeAll(all: AllBases): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Blocked storage: bases are rebuilt on the next sync.
  }
}

/** Per-account record of the updatedAt both sides agreed on at the last sync. */
export class SyncBases {
  constructor(private readonly accountId: string) {}

  all(): Bases {
    return readAll()[this.accountId] ?? {};
  }

  set(id: string, updatedAt: string): void {
    const all = readAll();
    all[this.accountId] = { ...all[this.accountId], [id]: updatedAt };
    writeAll(all);
  }

  forget(id: string): void {
    const all = readAll();
    const { [id]: _removed, ...rest } = all[this.accountId] ?? {};
    all[this.accountId] = rest;
    writeAll(all);
  }

  clearAccount(): void {
    const all = readAll();
    delete all[this.accountId];
    writeAll(all);
  }
}
