import type { GameState } from "../domain/types";
import {
  AuthExpiredError,
  OfflineError,
  type RemoteGameStore,
} from "./RemoteGameStore";
import type { RemoteEntry } from "./types";

const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const ACCOUNT_FILE = "account.json";
const BOUNDARY = "dnsolo_boundary_7f3a9c";

class DriveStatusError extends Error {
  constructor(readonly status: number) {
    super(`Drive request failed with status ${status}`);
  }
}

const isNotFound = (e: unknown) => e instanceof DriveStatusError && e.status === 404;

interface DriveFile {
  id: string;
  name: string;
  appProperties?: Record<string, string>;
}

const gameFileName = (id: string) => `game-${id}.json`;

export class DriveGameStore implements RemoteGameStore {
  private readonly fetchFn: typeof fetch;
  private accountFileId: Promise<string> | null = null;
  /** game id -> Drive file id, refreshed on every list. */
  private fileIds = new Map<string, string>();

  constructor(
    private readonly getToken: () => Promise<string>,
    fetchFn: typeof fetch = globalThis.fetch.bind(globalThis),
    /** Drive refused `token` (401): the auth must stop handing it out. */
    private readonly onUnauthorized: (token: string) => void = () => undefined,
  ) {
    this.fetchFn = fetchFn;
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.getToken();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    let response: Response;
    try {
      response = await this.fetchFn(url, { ...init, headers });
    } catch (cause) {
      throw new OfflineError(`Network error: ${String(cause)}`);
    }
    if (response.status === 401) {
      try {
        this.onUnauthorized(token);
      } catch {
        // The auth's bug is its own; the caller still learns the token is dead.
      }
      throw new AuthExpiredError("Drive token expired");
    }
    if (!response.ok) throw new DriveStatusError(response.status);
    return response;
  }

  private async listFiles(): Promise<DriveFile[]> {
    const files: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      let url =
        `${API}?spaces=appDataFolder` +
        `&fields=${encodeURIComponent("nextPageToken,files(id,name,appProperties)")}` +
        `&pageSize=1000`;
      if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
      const body = (await (await this.request(url)).json()) as {
        files?: DriveFile[];
        nextPageToken?: string;
      };
      files.push(...(body.files ?? []));
      pageToken = body.nextPageToken;
    } while (pageToken);
    return files;
  }

  /** Writes a file (create when fileId is null, update otherwise); returns its id. */
  private async writeFile(
    fileId: string | null,
    name: string,
    appProperties: Record<string, string>,
    content: unknown,
  ): Promise<string> {
    const metadata: Record<string, unknown> = { name, appProperties };
    if (!fileId) metadata.parents = ["appDataFolder"];
    const body =
      `--${BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${BOUNDARY}\r\nContent-Type: application/json\r\n\r\n` +
      `${JSON.stringify(content)}\r\n--${BOUNDARY}--`;
    const response = await this.request(
      fileId ? `${UPLOAD}/${fileId}?uploadType=multipart` : `${UPLOAD}?uploadType=multipart`,
      {
        method: fileId ? "PATCH" : "POST",
        headers: { "Content-Type": `multipart/related; boundary=${BOUNDARY}` },
        body,
      },
    );
    return ((await response.json()) as { id: string }).id;
  }

  accountId(): Promise<string> {
    if (!this.accountFileId) {
      const pending = this.findOrCreateAccountFile();
      this.accountFileId = pending;
      // A failure must not stick: let a later call retry.
      pending.catch(() => {
        if (this.accountFileId === pending) this.accountFileId = null;
      });
    }
    return this.accountFileId;
  }

  private async findOrCreateAccountFile(): Promise<string> {
    // Smallest id wins so every device agrees if several markers exist.
    const ids = (await this.listFiles())
      .filter((f) => f.name === ACCOUNT_FILE)
      .map((f) => f.id)
      .sort();
    return ids[0] ?? (await this.writeFile(null, ACCOUNT_FILE, {}, {}));
  }

  async list(): Promise<RemoteEntry[]> {
    const entries = new Map<string, RemoteEntry>();
    this.fileIds.clear();
    for (const file of await this.listFiles()) {
      const props = file.appProperties;
      if (!props?.gameId) continue; // account marker or foreign file
      const entry: RemoteEntry = {
        id: props.gameId,
        updatedAt: props.updatedAt ?? "",
        turnCount: Number(props.turnCount ?? 0),
        deleted: props.deleted === "true",
      };
      // Duplicates of one game: keep the newest.
      const current = entries.get(entry.id);
      if (current && current.updatedAt >= entry.updatedAt) continue;
      entries.set(entry.id, entry);
      this.fileIds.set(entry.id, file.id);
    }
    return [...entries.values()];
  }

  /** File id from the cache, re-listing once on a miss. */
  private async findFileId(id: string): Promise<string | null> {
    if (!this.fileIds.has(id)) await this.list();
    return this.fileIds.get(id) ?? null;
  }

  async get(id: string): Promise<unknown | null> {
    const fileId = await this.findFileId(id);
    if (!fileId) return null;
    let response: Response;
    try {
      response = await this.request(`${API}/${fileId}?alt=media`);
    } catch (e) {
      if (!isNotFound(e)) throw e;
      this.fileIds.delete(id);
      return null;
    }
    const raw = (await response.json()) as unknown;
    if (raw && typeof raw === "object" && (raw as { deleted?: unknown }).deleted === true) {
      return null;
    }
    return raw;
  }

  /** Writes a game file; if the cached file vanished (404), re-lists once and retries. */
  private async writeGameFile(
    id: string,
    name: string,
    appProperties: Record<string, string>,
    content: unknown,
  ): Promise<string> {
    const fileId = await this.findFileId(id);
    if (!fileId) return this.writeFile(null, name, appProperties, content);
    try {
      return await this.writeFile(fileId, name, appProperties, content);
    } catch (e) {
      if (!isNotFound(e)) throw e;
      this.fileIds.delete(id);
      return this.writeFile(await this.findFileId(id), name, appProperties, content);
    }
  }

  async put(state: GameState): Promise<void> {
    const newId = await this.writeGameFile(
      state.id,
      gameFileName(state.id),
      {
        gameId: state.id,
        updatedAt: state.updatedAt,
        turnCount: String(state.turns.length),
      },
      state,
    );
    this.fileIds.set(state.id, newId);
  }

  async tombstone(id: string): Promise<void> {
    const newId = await this.writeGameFile(
      id,
      gameFileName(id),
      { gameId: id, updatedAt: new Date().toISOString(), turnCount: "0", deleted: "true" },
      { deleted: true, deletedAt: new Date().toISOString() },
    );
    this.fileIds.set(id, newId);
  }
}
