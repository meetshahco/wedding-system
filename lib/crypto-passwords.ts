import crypto from "crypto";

export const CURRENT_ITERATIONS = 210000;
export const KEY_LEN = 64;
export const DIGEST = "sha512";
export const HASH_PREFIX = `pbkdf2:${DIGEST}:${CURRENT_ITERATIONS}`;

/**
 * Hash a plain text password using PBKDF2 at current OWASP recommended strength (210,000 iterations, SHA-512).
 * Result format: `pbkdf2:sha512:210000:<salt>:<derivedKey>`
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.pbkdf2Sync(
    password,
    salt,
    CURRENT_ITERATIONS,
    KEY_LEN,
    DIGEST
  ).toString("hex");
  return `${HASH_PREFIX}:${salt}:${derivedKey}`;
}

/**
 * Verify a plain text password against a stored hash string.
 * Supports current format `pbkdf2:sha512:<iterations>:<salt>:<derivedKey>`
 * and legacy format `<salt>:<derivedKey>` (100,000 iterations).
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;

  const parts = storedHash.split(":");

  // Current format: pbkdf2:sha512:<iterations>:<salt>:<derivedKey>
  if (parts.length === 5 && parts[0] === "pbkdf2" && parts[1] === "sha512") {
    const iterations = parseInt(parts[2], 10);
    const salt = parts[3];
    const key = parts[4];

    if (isNaN(iterations) || !salt || !key) return false;

    const derivedKey = crypto.pbkdf2Sync(
      password,
      salt,
      iterations,
      KEY_LEN,
      DIGEST
    ).toString("hex");

    const bufKey = Buffer.from(key, "hex");
    const bufDerived = Buffer.from(derivedKey, "hex");
    if (bufKey.length !== bufDerived.length) return false;
    return crypto.timingSafeEqual(bufKey, bufDerived);
  }

  // Legacy format: <salt>:<derivedKey> (100,000 iterations)
  if (parts.length === 2) {
    const [salt, key] = parts;
    if (!salt || !key) return false;

    const derivedKey = crypto.pbkdf2Sync(
      password,
      salt,
      100000,
      KEY_LEN,
      DIGEST
    ).toString("hex");

    const bufKey = Buffer.from(key, "hex");
    const bufDerived = Buffer.from(derivedKey, "hex");
    if (bufKey.length !== bufDerived.length) return false;
    return crypto.timingSafeEqual(bufKey, bufDerived);
  }

  return false;
}

/**
 * Returns true if the stored hash was created with an older scheme or lower iteration count.
 */
export function needsRehash(storedHash: string): boolean {
  return !storedHash || !storedHash.startsWith(HASH_PREFIX);
}
