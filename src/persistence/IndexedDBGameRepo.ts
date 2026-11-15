import type { GameState } from "../domain/types";
import { migrateSave } from "./migrations";
import type { GameRepo } from "./GameRepo";

const DB_NAME = "dnsolo";
const DB_VERSION = 1;
const STORE = "games";
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
    this.db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE, { keyPath: "id" });
        // ISO timestamps sort chronologically as strings, so this index
        // gives "latest game" without loading every save.
        store.createIndex(BY_UPDATED, "updatedAt");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.db;
  }

  async save(state: GameState): Promise<void> {
    const transaction = (await this.open()).transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(state);
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

  async delete(id: string): Promise<void> {
    const transaction = (await this.open()).transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(id);
    await done(transaction);
  }
}
