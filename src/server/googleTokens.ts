// Google OAuth token endpoints, called only from the server (they need the client secret).

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const TIMEOUT_MS = 10_000;

export interface GoogleEnv {
  clientId: string;
  clientSecret: string;
}

export interface AccessGrant {
  accessToken: string;
  /** Epoch ms. */
  expiresAt: number;
}

/** Google rejected the code or refresh token (revoked, expired, or already used). */
export class InvalidGrantError extends Error {}

interface TokenBody {
  access_token?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
  error?: unknown;
}

function postForm(url: string, params: Record<string, string>, fetchFn: typeof fetch): Promise<Response> {
  return fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/** Errors carry only the status and Google's error code, never request or response tokens. */
async function tokenRequest(params: Record<string, string>, fetchFn: typeof fetch): Promise<TokenBody & AccessGrant> {
  const response = await postForm(TOKEN_URL, params, fetchFn);
  const body = ((await response.json().catch(() => null)) ?? {}) as TokenBody;
  if (!response.ok) {
    if (body.error === "invalid_grant") throw new InvalidGrantError("Google rejected the grant");
    throw new Error(`Google token endpoint answered ${response.status} (${String(body.error ?? "no error code")})`);
  }
  if (typeof body.access_token !== "string" || typeof body.expires_in !== "number") {
    throw new Error("Google token endpoint answered without an access token");
  }
  return { ...body, accessToken: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
}

export async function exchangeCode(
  code: string,
  env: GoogleEnv,
  fetchFn: typeof fetch = fetch,
): Promise<AccessGrant & { refreshToken: string }> {
  const body = await tokenRequest(
    {
      code,
      client_id: env.clientId,
      client_secret: env.clientSecret,
      redirect_uri: "postmessage",
      grant_type: "authorization_code",
    },
    fetchFn,
  );
  if (typeof body.refresh_token !== "string") throw new Error("Google sent no refresh token");
  return { accessToken: body.accessToken, expiresAt: body.expiresAt, refreshToken: body.refresh_token };
}

export async function refreshAccess(
  refreshToken: string,
  env: GoogleEnv,
  fetchFn: typeof fetch = fetch,
): Promise<AccessGrant> {
  const body = await tokenRequest(
    {
      refresh_token: refreshToken,
      client_id: env.clientId,
      client_secret: env.clientSecret,
      grant_type: "refresh_token",
    },
    fetchFn,
  );
  return { accessToken: body.accessToken, expiresAt: body.expiresAt };
}

export async function revoke(token: string, fetchFn: typeof fetch = fetch): Promise<void> {
  const response = await postForm(REVOKE_URL, { token }, fetchFn);
  if (!response.ok) throw new Error(`Google revoke endpoint answered ${response.status}`);
}
