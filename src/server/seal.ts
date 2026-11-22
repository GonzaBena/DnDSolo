import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const IV_BYTES = 12;
const TAG_BYTES = 16;

function keyFrom(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

/** AES-256-GCM; output is base64url(iv | tag | ciphertext), safe as a cookie value. */
export function seal(plain: string, secret: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

/** Null when the value was tampered with, truncated, or sealed with another secret. */
export function unseal(sealed: string, secret: string): string | null {
  try {
    const bytes = Buffer.from(sealed, "base64url");
    if (bytes.length <= IV_BYTES + TAG_BYTES) return null;
    const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), bytes.subarray(0, IV_BYTES));
    decipher.setAuthTag(bytes.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([decipher.update(bytes.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
