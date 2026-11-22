import { DRIVE_SCOPE, type DriveAuth } from "./DriveAuth";
import type { GisTokenApi, GisTokenClient, GisTokenResponse } from "./gis";
import { AuthExpiredError } from "./RemoteGameStore";

/** Renew ahead of time so a token never expires mid-session. */
const RENEW_MARGIN_MS = 10 * 60_000;
/** On mobile the Google window is a tab switch; give up waiting after this. */
const RENEW_TIMEOUT_MS = 20_000;
/** The first consent screen takes reading; still never wait forever. */
const CONNECT_TIMEOUT_MS = 120_000;
/** GIS may never call back from a revoke; disconnecting must still finish. */
const REVOKE_TIMEOUT_MS = 5_000;

export type TokenStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

interface Deps {
  clientId: string;
  gis: () => GisTokenApi;
  now?: () => number;
  /** Where the token outlives a page load; defaults to sessionStorage (this tab only). */
  storage?: TokenStorage | null;
}

interface Token {
  value: string;
  expiresAt: number;
}

/** sessionStorage when there is one; touching it can throw where site data is blocked. */
function defaultStorage(): TokenStorage | null {
  try {
    return (globalThis as { sessionStorage?: TokenStorage }).sessionStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * GIS token client: short-lived tokens renewed by a user gesture. The token is
 * kept in sessionStorage so the next page of the same tab (every navigation is
 * a full load) uses it instead of asking Google again; it never leaves the tab.
 */
export class BrowserDriveAuth implements DriveAuth {
  private readonly now: () => number;
  private readonly storage: TokenStorage | null;
  private readonly storageKey: string;
  private client: GisTokenClient | null = null;
  private token: Token | null = null;
  /** Settles the request in flight; GIS has one callback per client. */
  private settle: ((ok: boolean) => void) | null = null;

  constructor(private readonly deps: Deps) {
    this.now = deps.now ?? Date.now;
    this.storage = deps.storage === undefined ? defaultStorage() : deps.storage;
    this.storageKey = `dnsolo.sync.token.${deps.clientId}`;
    this.token = this.readStored();
  }

  async getAccessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > this.now()) return this.token.value;
    throw new AuthExpiredError("No valid Drive token");
  }

  needsGesture(): boolean {
    return !this.token || this.token.expiresAt - this.now() < RENEW_MARGIN_MS;
  }

  renewWithGesture(): Promise<boolean> {
    return this.request({ prompt: "" }, RENEW_TIMEOUT_MS);
  }

  connect(): Promise<boolean> {
    return this.request(undefined, CONNECT_TIMEOUT_MS);
  }

  async disconnect(): Promise<void> {
    const token = this.token?.value;
    this.setToken(null);
    if (!token) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const gis = this.deps.gis();
      await new Promise<void>((resolve) => {
        timer = setTimeout(resolve, REVOKE_TIMEOUT_MS);
        gis.revoke(token, resolve);
      });
    } catch {
      // GIS unavailable: the token is dropped locally and expires within the hour.
    } finally {
      clearTimeout(timer);
    }
  }

  async forget(): Promise<void> {
    this.setToken(null);
  }

  /** The token a previous page of this tab stored, if it is still valid. */
  private readStored(): Token | null {
    try {
      const raw = this.storage?.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<Token> | null;
      if (typeof parsed?.value !== "string" || typeof parsed.expiresAt !== "number") return null;
      return parsed.expiresAt > this.now() ? { value: parsed.value, expiresAt: parsed.expiresAt } : null;
    } catch {
      return null; // corrupt or blocked: behave as a fresh page
    }
  }

  private setToken(token: Token | null): void {
    this.token = token;
    try {
      if (token) this.storage?.setItem(this.storageKey, JSON.stringify(token));
      else this.storage?.removeItem(this.storageKey);
    } catch {
      // Blocked or full storage: the token still works for this page.
    }
  }

  /** Opens the Google window synchronously (popups need the live gesture). */
  private request(overrides: { prompt: string } | undefined, timeoutMs: number): Promise<boolean> {
    this.settle?.(false); // a newer request supersedes one still waiting
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => finish(false), timeoutMs);
      const finish = (ok: boolean) => {
        clearTimeout(timer);
        if (this.settle === finish) this.settle = null;
        resolve(ok);
      };
      this.settle = finish;
      try {
        this.tokenClient().requestAccessToken(overrides);
      } catch {
        finish(false);
      }
    });
  }

  private tokenClient(): GisTokenClient {
    this.client ??= this.deps.gis().initTokenClient({
      client_id: this.deps.clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => this.onToken(response),
      error_callback: () => this.settle?.(false),
    });
    return this.client;
  }

  private onToken(response: GisTokenResponse): void {
    if (response.error || !response.access_token) {
      this.settle?.(false);
      return;
    }
    // A late answer (after the timeout) still leaves a usable token.
    this.setToken({ value: response.access_token, expiresAt: this.now() + response.expires_in * 1000 });
    this.settle?.(true);
  }
}
