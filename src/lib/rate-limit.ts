/**
 * Rate limiter with Upstash Redis support.
 * - Redis configured → distributed rate limiting across all serverless instances
 * - Redis not configured → in-memory fallback (per-instance, best-effort)
 *
 * Required env vars for Redis:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ---------- Redis-backed limiters (singleton) ----------
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const useRedis = Boolean(redisUrl && redisToken);

let redis: Redis | null = null;
const redisLimiters = new Map<string, Ratelimit>();

function getRedisLimiter(limit: number, windowMs: number): Ratelimit {
  const key = `${limit}:${windowMs}`;
  let limiter = redisLimiters.get(key);
  if (!limiter) {
    if (!redis) {
      redis = new Redis({ url: redisUrl!, token: redisToken! });
    }
    const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      prefix: "rl",
      analytics: false,
    });
    redisLimiters.set(key, limiter);
  }
  return limiter;
}

// ---------- In-memory fallback ----------
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
if (typeof globalThis !== "undefined") {
  const cleanup = () => {
    const now = Date.now();
    store.forEach((entry, k) => {
      if (entry.resetAt < now) store.delete(k);
    });
  };
  // Avoid duplicate intervals in hot-reload
  (globalThis as any).__rlCleanup?.();
  const id = setInterval(cleanup, 5 * 60 * 1000);
  (globalThis as any).__rlCleanup = () => clearInterval(id);
}

function checkInMemory(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// ---------- Public API ----------
/**
 * Check rate limit for a given key.
 * Uses Upstash Redis if configured, otherwise falls back to in-memory.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  if (useRedis) {
    try {
      const limiter = getRedisLimiter(limit, windowMs);
      const result = await limiter.limit(key);
      return {
        allowed: result.success,
        remaining: result.remaining,
        resetAt: result.reset,
      };
    } catch (err) {
      // Redis failure → fall back to in-memory
      console.warn("[RATE-LIMIT] Redis error, falling back to in-memory:", err);
      return checkInMemory(key, limit, windowMs);
    }
  }

  return checkInMemory(key, limit, windowMs);
}

/**
 * Sync version for backward compatibility (in-memory only).
 * @deprecated Use the async checkRateLimit instead.
 */
export function checkRateLimitSync(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  return checkInMemory(key, limit, windowMs);
}
