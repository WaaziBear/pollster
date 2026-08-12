/**
 * Minimal in-memory fixed-window rate limiter to slow credential stuffing and
 * signup abuse. Sufficient for a single-instance dev/demo deployment. For a
 * multi-instance production deployment, back this with Redis or a similar store.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Returns true if the action is allowed, false if the limit is exceeded.
 * @param key       unique key (e.g. `login:user@example.com`)
 * @param limit     max attempts per window
 * @param windowMs  window length in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}
