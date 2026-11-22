import { DRIVE_SCOPE, type DriveAuth } from "./DriveAuth";
import type { GisTokenApi, GisTokenClient, GisTokenResponse } from "./gis";
import { AuthExpiredError } from "./RemoteGameStore";

/** Renew ahead of time so a token never expires mid-session. */
const RENEW_MARGIN_MS = 10 * 60_000;
/** On mobile the Google window is a tab switch; give up waiting after this. */
const RENEW_TIMEOUT_MS = 20_000;
/** The first consent screen takes reading; still never wait forever. */
const CONNECT_TIMEOUT_MS = 120_000;

interface Deps {
  clientId: string;
  gis: () => GisTokenApi;
  now?: () => number;
}

/** GIS token client: short-lived tokens kept in memory, renewed by a user gesture. */
export class BrowserDriveAuth implements DriveAuth {
  private readonly now: () => number;
  private client: GisTokenClient | null = null;
  private token: { value: string; expiresAt: number } | null = null;
  /** Settles the request in flight; GIS has one callback per client. */
  private settle: ((ok: boolean) => void) | null = null;

  constructor(private readonly deps: Deps) {
    this.now = deps.now ?? Date.now;
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
    this.token = null;
    if (!token) return;
    try {
      const gis = this.deps.gis();
      await new Promise<void>((resolve) => gis.revoke(token, resolve));
    } catch {
      // GIS unavailable: the token is dropped locally and expires within the hour.
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
    this.token = { value: response.access_token, expiresAt: this.now() + response.expires_in * 1000 };
    this.settle?.(true);
  }
}
