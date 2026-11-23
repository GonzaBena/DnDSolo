// Minimal typings for the parts of Google Identity Services we use
// (google.accounts.oauth2 token and code clients); GIS ships no types of its own.

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

export interface GisCodeResponse {
  /** One-time authorization code, exchanged by the server. */
  code: string;
  /** Set instead of a code when the user denied consent. */
  error?: string;
}

export interface GisCodeClientConfig {
  client_id: string;
  scope: string;
  ux_mode: "popup";
  /** "offline" makes Google issue a refresh token on the exchange. */
  access_type: "offline";
  /** "consent" makes Google issue a refresh token again on a reconnect. */
  prompt: "consent";
  callback: (response: GisCodeResponse) => void;
  error_callback?: (error: { type: string }) => void;
}

export interface GisCodeClient {
  requestCode(): void;
}

export interface GisCodeApi {
  initCodeClient(config: GisCodeClientConfig): GisCodeClient;
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

/** The loaded oauth2 namespace; throws when the script has not loaded yet. */
function oauth2(): GisTokenApi & GisCodeApi {
  const api = (globalThis as { google?: { accounts?: { oauth2?: GisTokenApi & GisCodeApi } } }).google?.accounts
    ?.oauth2;
  if (!api) throw new Error("Google Identity Services not loaded");
  return api;
}

export function gisTokenApi(): GisTokenApi {
  return oauth2();
}

export function gisCodeApi(): GisCodeApi {
  return oauth2();
}
