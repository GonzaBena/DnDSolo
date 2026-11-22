import { DRIVE_SCOPE, type DriveAuth } from "./DriveAuth";
import { ServerNotConfiguredError } from "./errors";
import type { GisCodeApi, GisCodeClient } from "./gis";
import { AuthExpiredError, OfflineError } from "./RemoteGameStore";

/** Renew ahead of time so a token never expires mid-request. */
const RENEW_MARGIN_MS = 10 * 60_000;
/** The first consent screen takes reading; still never wait forever. */
const CONNECT_TIMEOUT_MS = 120_000;

interface Deps {
  clientId: string;
  gis: () => GisCodeApi;
  fetchFn?: typeof fetch;
}

interface AccessGrant {
  accessToken: string;
  expiresAt: number;
}

/**
 * Auto-renewal: the server keeps the refresh token in an HttpOnly cookie
 * (never visible here) and hands out short-lived access tokens on request.
 */
export class ServerDriveAuth implements DriveAuth {
  private readonly fetchFn: typeof fetch;
  private client: GisCodeClient | null = null;
  private token: { value: string; expiresAt: number } | null = null;
  private refreshing: Promise<string> | null = null;
  /** The server answered 401: no cookie, or Google no longer honours its refresh token. */
  private lostGrant = false;
  /** Settles the consent in flight; GIS has one callback per client. */
  private settle: ((code: string | null) => void) | null = null;

  constructor(private readonly deps: Deps) {
    // Bound lazily so tests and a late-patched global fetch both work.
    this.fetchFn = deps.fetchFn ?? ((input, init) => fetch(input, init));
  }

  getAccessToken(): Promise<string> {
    if (this.token && this.token.expiresAt - Date.now() > RENEW_MARGIN_MS) return Promise.resolve(this.token.value);
    this.refreshing ??= this.refresh().finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  /** True once the server could not renew (401): only a new consent brings the connection back. */
  needsGesture(): boolean {
    return this.lostGrant;
  }

  /**
   * After a 401, opens the consent window synchronously (inside the click,
   * like `connect`) and exchanges the code; otherwise renews silently through
   * the server. Resolves false on close, deny, timeout or any failure.
   */
  async renewWithGesture(): Promise<boolean> {
    try {
      if (this.lostGrant) return await this.connect();
      await this.getAccessToken();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Opens the Google window synchronously (popups need the live gesture).
   * Rejects ServerNotConfiguredError when this server cannot renew at all,
   * so the page can say so instead of "not connected".
   */
  async connect(): Promise<boolean> {
    const code = await this.requestCode();
    if (!code) return false;
    let response: Response;
    try {
      response = await this.post("/api/drive/connect", { code });
    } catch {
      return false;
    }
    if (response.status === 500) {
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (body?.error === "not_configured") throw new ServerNotConfiguredError("Auto-renewal is not configured");
    }
    if (!response.ok) return false;
    try {
      this.store((await response.json()) as AccessGrant);
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.token = null;
    try {
      await this.post("/api/drive/disconnect", {});
    } catch {
      // Unreachable server: the cookie stays, but sync is off and the token is gone here.
    }
  }

  /** Clears the cookie (and the token here) without the server revoking at Google. */
  async forget(): Promise<void> {
    this.token = null;
    try {
      await this.post("/api/drive/disconnect", { revoke: false });
    } catch {
      // Unreachable server: the cookie stays until it expires; this page no longer uses it.
    }
  }

  private async refresh(): Promise<string> {
    let response: Response;
    try {
      response = await this.post("/api/drive/token", {});
    } catch (cause) {
      return this.fallback(new OfflineError(`Network error: ${String(cause)}`));
    }
    if (response.status === 401) {
      this.token = null;
      this.lostGrant = true;
      throw new AuthExpiredError("Drive connection expired");
    }
    if (!response.ok) return this.fallback(new Error(`Token renewal answered ${response.status}`));
    this.store((await response.json()) as AccessGrant);
    return this.token!.value;
  }

  /** An early renewal that fails still leaves the current token usable until it expires. */
  private fallback(error: Error): string {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;
    throw error;
  }

  private store(grant: AccessGrant): void {
    this.token = { value: grant.accessToken, expiresAt: grant.expiresAt };
    this.lostGrant = false;
  }

  private post(url: string, body: unknown): Promise<Response> {
    return this.fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    });
  }

  private requestCode(): Promise<string | null> {
    this.settle?.(null); // a newer request supersedes one still waiting
    return new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => finish(null), CONNECT_TIMEOUT_MS);
      const finish = (code: string | null) => {
        clearTimeout(timer);
        if (this.settle === finish) this.settle = null;
        resolve(code);
      };
      this.settle = finish;
      try {
        this.codeClient().requestCode();
      } catch {
        finish(null);
      }
    });
  }

  private codeClient(): GisCodeClient {
    this.client ??= this.deps.gis().initCodeClient({
      client_id: this.deps.clientId,
      scope: DRIVE_SCOPE,
      ux_mode: "popup",
      access_type: "offline",
      prompt: "consent",
      callback: (response) => this.settle?.(response.error || !response.code ? null : response.code),
      error_callback: () => this.settle?.(null),
    });
    return this.client;
  }
}
