/** Only the hidden app folder: the app never sees the user's other files. */
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

export interface DriveAuth {
  /** Valid token or rejects AuthExpiredError; never opens UI. */
  getAccessToken(): Promise<string>;
  /** True when the next action should renew via a user gesture (browser: no token or < 10 min left; server: after a 401). */
  needsGesture(): boolean;
  /**
   * MUST be called synchronously inside a click/submit handler. Resolves false on close/deny/timeout
   * (20 s for the browser's silent renewal; 120 s for the server's full consent after a 401).
   */
  renewWithGesture(): Promise<boolean>;
  /** First consent; false if closed/denied. */
  connect(): Promise<boolean>;
  /** Revokes at Google: ends the whole grant for this client (both modes share it). */
  disconnect(): Promise<void>;
  /** Drops this auth's credentials without revoking at Google, so a grant made by the other mode survives. */
  forget(): Promise<void>;
}
