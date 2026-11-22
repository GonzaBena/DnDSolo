// GOOGLE_CLIENT_SECRET and SESSION_SECRET are read at runtime with
// getSecret() from astro:env/server (src/server/driveRoute.ts), not here.
interface ImportMetaEnv {
  /** OAuth client id for Google Drive sync (public by design). */
  readonly PUBLIC_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
