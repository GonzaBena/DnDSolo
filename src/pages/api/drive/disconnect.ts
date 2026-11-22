import type { APIRoute } from "astro";
import { clearRefreshToken, driveSecrets, isJsonPost, json, readRefreshToken, unsupported } from "../../../server/driveRoute";
import { revoke } from "../../../server/googleTokens";

export const prerender = false;

/** Revokes the refresh token at Google and always clears the cookie. */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isJsonPost(request)) return unsupported();
  const secrets = driveSecrets();
  const refreshToken = secrets ? readRefreshToken(cookies, secrets.sessionSecret) : null;
  clearRefreshToken(cookies);
  if (refreshToken) {
    try {
      await revoke(refreshToken);
    } catch {
      // Revocation failed: the cookie is gone anyway; the user can revoke from their Google account.
    }
  }
  return json(204);
};

export const ALL: APIRoute = () => unsupported();
