import type { APIRoute } from "astro";
import {
  clearRefreshToken,
  driveSecrets,
  isJsonPost,
  json,
  notConfigured,
  readRefreshToken,
  storeRefreshToken,
  unsupported,
} from "../../../server/driveRoute";
import { InvalidGrantError, refreshAccess } from "../../../server/googleTokens";

export const prerender = false;

/** Fresh access token from the sealed refresh token; 401 means "reconnect". */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isJsonPost(request)) return unsupported();
  const secrets = driveSecrets();
  if (!secrets) return notConfigured();

  const refreshToken = readRefreshToken(cookies, secrets.sessionSecret);
  if (!refreshToken) {
    clearRefreshToken(cookies);
    return json(401, { error: "not_connected" });
  }

  try {
    const grant = await refreshAccess(refreshToken, secrets.google);
    // Resealing restarts Max-Age, so the connection lasts while it is used.
    storeRefreshToken(cookies, refreshToken, secrets.sessionSecret);
    return json(200, grant);
  } catch (error) {
    if (error instanceof InvalidGrantError) {
      clearRefreshToken(cookies);
      return json(401, { error: "not_connected" });
    }
    return json(502, { error: "google_unavailable" });
  }
};

export const ALL: APIRoute = () => unsupported();
