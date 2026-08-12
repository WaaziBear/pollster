import bcrypt from "bcryptjs";

/**
 * Password hashing abstraction.
 *
 * We use `bcryptjs` (pure JS) for guaranteed cross-platform builds, including
 * Windows dev machines and CI, with no native compilation step. The architect's
 * preferred choice was Argon2id (`@node-rs/argon2`); this module is the single
 * seam to swap implementations — replace the two functions below and nothing
 * else in the app changes. Argon2 is OWASP-preferred; bcrypt with a work factor
 * of 12 remains a solid, widely-accepted default.
 *
 * NOTE: These use native Node crypto under the hood and MUST run on the Node.js
 * runtime, never the Edge runtime.
 */

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
