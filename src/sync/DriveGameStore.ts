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

interface DriveFile {
  id: string;
  name: string;
  appProperties?: Record<string, string>;
}

const gameFileName = (id: string) => `game-${id}.json`;

export class DriveGameStore implements RemoteGameStore {
  private readonly fetchFn: typeof fetch;
  private accountFileId: string | null = null;
  /** game id -> Drive file id, refreshed on every list. */
  private fileIds = new Map<string, string>();

  constructor(
    private readonly getToken: () => Promise<string>,
    fetchFn: typeof fetch = globalThis.fetch.bind(globalThis),
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
    if (response.status === 401) throw new AuthExpiredError("Drive token expired");
    if (!response.ok) throw new Error(`Drive request failed with status ${response.status}`);
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

  async accountId(): Promise<string> {
    if (this.accountFileId) return this.accountFileId;
    const existing = (await this.listFiles()).find((f) => f.name === ACCOUNT_FILE);
    this.accountFileId = existing?.id ?? (await this.writeFile(null, ACCOUNT_FILE, {}, {}));
    return this.accountFileId;
  }

  async list(): Promise<RemoteEntry[]> {
    const entries: RemoteEntry[] = [];
    this.fileIds.clear();
    for (const file of await this.listFiles()) {
      const props = file.appProperties;
      if (!props?.gameId) continue; // account marker or foreign file
      this.fileIds.set(props.gameId, file.id);
      entries.push({
        id: props.gameId,
        updatedAt: props.updatedAt ?? "",
        turnCount: Number(props.turnCount ?? 0),
        deleted: props.deleted === "true",
      });
    }
    return entries;
  }

  /** File id from the cache, re-listing once on a miss. */
  private async findFileId(id: string): Promise<string | null> {
    if (!this.fileIds.has(id)) await this.list();
    return this.fileIds.get(id) ?? null;
  }

  async get(id: string): Promise<unknown | null> {
    const fileId = await this.findFileId(id);
    if (!fileId) return null;
    const response = await this.request(`${API}/${fileId}?alt=media`);
    const raw = (await response.json()) as unknown;
    if (raw && typeof raw === "object" && (raw as { deleted?: unknown }).deleted === true) {
      return null;
    }
    return raw;
  }

  async put(state: GameState): Promise<void> {
    const fileId = await this.findFileId(state.id);
    const newId = await this.writeFile(
      fileId,
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
    const fileId = await this.findFileId(id);
    const newId = await this.writeFile(
      fileId,
      gameFileName(id),
      { gameId: id, updatedAt: new Date().toISOString(), turnCount: "0", deleted: "true" },
      { deleted: true, deletedAt: new Date().toISOString() },
    );
    this.fileIds.set(id, newId);
  }
}
