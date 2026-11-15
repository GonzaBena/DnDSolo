import { GAME_STATE_VERSION, type GameState } from "../domain/types";
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

/** A save written by a different version of the app can't be trusted to
    have today's shape. There are no migrations yet, so it is ignored
    rather than loaded into a screen that would crash on it. */
function readable(value: unknown): GameState | null {
  const state = value as GameState | undefined;
  return state && state.version === GAME_STATE_VERSION ? state : null;
}

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
