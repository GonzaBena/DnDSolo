// Minimal typings for the parts of Google Identity Services we use
// (google.accounts.oauth2 token client); GIS ships no types of its own.

export interface GisTokenResponse {
  access_token: string;
  /** Seconds until the token expires. */
  expires_in: number;
  /** Set instead of a token when the user denied consent. */
  error?: string;
}

export interface GisTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GisTokenResponse) => void;
  /** Popup closed, blocked, or another non-OAuth failure. */
  error_callback?: (error: { type: string }) => void;
}

export interface GisTokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

export interface GisTokenApi {
  initTokenClient(config: GisTokenClientConfig): GisTokenClient;
  revoke(accessToken: string, done?: () => void): void;
}

const GIS_SRC = "https://accounts.google.com/gsi/client";

let loading: Promise<void> | null = null;

/** Injects the GIS script once; a failed load can be retried. */
export function loadGis(): Promise<void> {
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google Identity Services"));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

/** The loaded token API; throws when the script has not loaded yet. */
export function gisTokenApi(): GisTokenApi {
  const api = (globalThis as { google?: { accounts?: { oauth2?: GisTokenApi } } }).google?.accounts?.oauth2;
  if (!api) throw new Error("Google Identity Services not loaded");
  return api;
}
