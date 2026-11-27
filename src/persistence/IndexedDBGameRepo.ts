import type { GameState } from "../domain/types";
import { migrateSave } from "./migrations";
import { extractGameSummary, type GameRepo, type GameSummary } from "./GameRepo";

const DB_NAME = "dnsolo";
const DB_VERSION = 2;
const STORE = "games";
const SUMMARIES_STORE = "summaries";
const BY_UPDATED = "byUpdatedAt";

function asPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Older saves are migrated on read; ones that can't be (unknown version,
    wrong shape) are ignored rather than loaded into a screen that would
    crash on them. */
const readable = migrateSave;

function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export class IndexedDBGameRepo implements GameRepo {
  private db: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    // Ask the browser not to evict saves under storage pressure. Best
    // effort: unsupported or refused is fine, the export is the backup.
    void globalThis.navigator?.storage?.persist?.().catch(() => {});
    this.db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          // ISO timestamps sort chronologically as strings, so this index
          // gives "latest game" without loading every save.
          store.createIndex(BY_UPDATED, "updatedAt");
        }
        if (!db.objectStoreNames.contains(SUMMARIES_STORE)) {
          const summaries = db.createObjectStore(SUMMARIES_STORE, { keyPath: "id" });
          summaries.createIndex(BY_UPDATED, "updatedAt");
          const tx = request.transaction!;
          const gamesStore = tx.objectStore(STORE);
          const cursorReq = gamesStore.openCursor();
          cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (!cursor) return;
            const summary = extractGameSummary(cursor.value);
            if (summary) summaries.put(summary);
            cursor.continue();
          };
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.db;
  }

  async save(state: GameState): Promise<void> {
    const transaction = (await this.open()).transaction([STORE, SUMMARIES_STORE], "readwrite");
    transaction.objectStore(STORE).put(state);
    const summary = extractGameSummary(state);
    const summaries = transaction.objectStore(SUMMARIES_STORE);
    if (summary) summaries.put(summary);
    else if (typeof (state as { id?: unknown })?.id === "string") summaries.delete(state.id);
    // Resolve on transaction completion, not on the request: only then is
    // the write durable.
    await done(transaction);
  }

  async load(id: string): Promise<GameState | null> {
    const store = (await this.open()).transaction(STORE).objectStore(STORE);
    return readable(await asPromise(store.get(id)));
  }

  async loadLatest(): Promise<GameState | null> {
    const index = (await this.open()).transaction(STORE).objectStore(STORE).index(BY_UPDATED);
    return new Promise((resolve, reject) => {
      const request = index.openCursor(null, "prev");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return resolve(null);
        const state = readable(cursor.value);
        if (state) resolve(state);
        else cursor.continue();
      };
    });
  }

  async list(): Promise<GameState[]> {
    const index = (await this.open()).transaction(STORE).objectStore(STORE).index(BY_UPDATED);
    return new Promise((resolve, reject) => {
      const games: GameState[] = [];
      const request = index.openCursor(null, "prev");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return resolve(games);
        const state = readable(cursor.value);
        if (state) games.push(state);
        cursor.continue();
      };
    });
  }

  async listSummaries(): Promise<GameSummary[]> {
    const index = (await this.open()).transaction(SUMMARIES_STORE).objectStore(SUMMARIES_STORE).index(BY_UPDATED);
    return new Promise((resolve, reject) => {
      const summaries: GameSummary[] = [];
      const request = index.openCursor(null, "prev");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return resolve(summaries);
        summaries.push(cursor.value as GameSummary);
        cursor.continue();
      };
    });
  }

  async delete(id: string): Promise<void> {
    const transaction = (await this.open()).transaction([STORE, SUMMARIES_STORE], "readwrite");
    transaction.objectStore(STORE).delete(id);
    transaction.objectStore(SUMMARIES_STORE).delete(id);
    await done(transaction);
  }
}
