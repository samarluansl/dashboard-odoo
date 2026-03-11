/**
 * Cache module for Odoo RPC calls.
 * Provides result caching with TTL and in-flight request deduplication.
 */

const resultCache = new Map<string, { value: unknown; expiry: number }>();
const inflight = new Map<string, Promise<unknown>>();

/** Cache TTL in milliseconds. Short-lived to avoid stale Odoo data on warm Vercel instances. */
const CACHE_TTL = 30_000;

/** Max entries to prevent unbounded memory growth on warm Vercel instances. */
const MAX_CACHE_ENTRIES = 500;
const MAX_STATIC_ENTRIES = 100;

/** Long-lived cache for static/semi-static Odoo data (account types, company lists, etc.) */
const STATIC_CACHE_TTL = 600_000; // 10 minutes
const staticCache = new Map<string, { value: unknown; expiry: number }>();

/** Get a static (long-lived) cached value. For data that changes very rarely. */
export function getStaticCached(key: string): unknown | undefined {
  const cached = staticCache.get(key);
  if (cached && cached.expiry > Date.now()) return cached.value;
  if (cached) staticCache.delete(key);
  return undefined;
}

/** Store a value in the static cache (10 min TTL). */
export function setStaticCached(key: string, value: unknown): void {
  if (staticCache.size >= MAX_STATIC_ENTRIES) {
    const firstKey = staticCache.keys().next().value;
    if (firstKey !== undefined) staticCache.delete(firstKey);
  }
  staticCache.set(key, { value, expiry: Date.now() + STATIC_CACHE_TTL });
}

/** Return cached value if still within TTL, otherwise undefined. Cleans up expired entries. */
export function getCached(key: string): unknown | undefined {
  const cached = resultCache.get(key);
  if (cached && cached.expiry > Date.now()) return cached.value;
  // Clean up expired entries
  if (cached) resultCache.delete(key);
  return undefined;
}

/** Store a value in the result cache with current timestamp + TTL. */
export function setCached(key: string, value: unknown): void {
  // PERF: Evict oldest entries if cache grows too large
  if (resultCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = resultCache.keys().next().value;
    if (firstKey !== undefined) resultCache.delete(firstKey);
  }
  resultCache.set(key, { value, expiry: Date.now() + CACHE_TTL });
}

/** Return the in-flight promise for a given cache key, if one exists. */
export function getInflight(key: string): Promise<unknown> | undefined {
  return inflight.get(key);
}

/** Register an in-flight promise to deduplicate concurrent identical requests. */
export function setInflight(key: string, promise: Promise<unknown>): void {
  inflight.set(key, promise);
}

/** Remove an in-flight entry after the request completes (success or failure). */
export function deleteInflight(key: string): void {
  inflight.delete(key);
}
