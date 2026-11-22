// Shared plumbing for the /api/drive routes: request checks, the sealed cookie, secrets.
import type { AstroCookies, AstroCookieSetOptions } from "astro";
import { getSecret } from "astro:env/server";
import type { GoogleEnv } from "./googleTokens";
import { seal, unseal } from "./seal";

const COOKIE = "dnsolo_drive";
const COOKIE_OPTIONS: AstroCookieSetOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: "/api/drive",
};
/** 180 days, in seconds. */
const MAX_AGE = 15_552_000;

export interface DriveSecrets {
  google: GoogleEnv;
  sessionSecret: string;
}

/**
 * Read per request so the host's variables apply without a rebuild; null when
 * any is missing. Not `import.meta.env`: Vite inlines that at build time.
 */
export function driveSecrets(): DriveSecrets | null {
  const clientId = getSecret("PUBLIC_GOOGLE_CLIENT_ID");
  const clientSecret = getSecret("GOOGLE_CLIENT_SECRET");
  const sessionSecret = getSecret("SESSION_SECRET");
  if (!clientId || !clientSecret || !sessionSecret) return null;
  return { google: { clientId, clientSecret }, sessionSecret };
}

/**
 * Only JSON POSTs: a cross-site page cannot send this content type without a
 * CORS preflight, which these routes never answer.
 */
export function isJsonPost(request: Request): boolean {
  const type = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  return request.method === "POST" && type === "application/json";
}

export function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const unsupported = (): Response => json(415, { error: "unsupported" });
export const notConfigured = (): Response => json(500, { error: "not_configured" });

export function storeRefreshToken(cookies: AstroCookies, refreshToken: string, secret: string): void {
  cookies.set(COOKIE, seal(refreshToken, secret), { ...COOKIE_OPTIONS, maxAge: MAX_AGE });
}

export function readRefreshToken(cookies: AstroCookies, secret: string): string | null {
  const sealed = cookies.get(COOKIE)?.value;
  return sealed ? unseal(sealed, secret) : null;
}

export function clearRefreshToken(cookies: AstroCookies): void {
  cookies.delete(COOKIE, COOKIE_OPTIONS);
}
