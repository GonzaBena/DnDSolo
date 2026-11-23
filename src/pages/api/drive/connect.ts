import type { APIRoute } from "astro";
import { json, driveSecrets, isJsonPost, notConfigured, storeRefreshToken, unsupported } from "../../../server/driveRoute";
import { exchangeCode, InvalidGrantError } from "../../../server/googleTokens";

export const prerender = false;

/** `{ code }` from the GIS code client → access token; the refresh token goes into the sealed cookie. */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isJsonPost(request)) return unsupported();
  const secrets = driveSecrets();
  if (!secrets) return notConfigured();

  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  if (typeof body?.code !== "string" || !body.code) return json(400, { error: "missing_code" });

  try {
    const grant = await exchangeCode(body.code, secrets.google);
    storeRefreshToken(cookies, grant.refreshToken, secrets.sessionSecret);
    return json(200, { accessToken: grant.accessToken, expiresAt: grant.expiresAt });
  } catch (error) {
    if (error instanceof InvalidGrantError) return json(400, { error: "invalid_grant" });
    return json(502, { error: "google_unavailable" });
  }
};

export const ALL: APIRoute = () => unsupported();
