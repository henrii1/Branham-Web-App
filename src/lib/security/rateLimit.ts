interface FixedWindowBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

declare global {
  var __branhamChatRateLimitStore: Map<string, FixedWindowBucket> | undefined;
  var __branhamChatRateLimitLastSweepAt: number | undefined;
}

const RATE_LIMIT_STORE =
  globalThis.__branhamChatRateLimitStore ??
  (globalThis.__branhamChatRateLimitStore = new Map<string, FixedWindowBucket>());

function sweepExpiredBuckets(now: number) {
  const lastSweepAt = globalThis.__branhamChatRateLimitLastSweepAt ?? 0;
  if (now - lastSweepAt < 10_000 && RATE_LIMIT_STORE.size < 1_000) {
    return;
  }

  for (const [key, bucket] of RATE_LIMIT_STORE.entries()) {
    if (bucket.resetAt <= now) {
      RATE_LIMIT_STORE.delete(key);
    }
  }

  globalThis.__branhamChatRateLimitLastSweepAt = now;
}

export function checkFixedWindowRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  sweepExpiredBuckets(now);

  const existing = RATE_LIMIT_STORE.get(key);

  if (!existing || existing.resetAt <= now) {
    RATE_LIMIT_STORE.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      allowed: true,
      limit,
      remaining: Math.max(limit - 1, 0),
      resetAt: now + windowMs,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.max(
        Math.ceil((existing.resetAt - now) / 1_000),
        1,
      ),
    };
  }

  existing.count += 1;

  return {
    allowed: true,
    limit,
    remaining: Math.max(limit - existing.count, 0),
    resetAt: existing.resetAt,
    retryAfterSeconds: 0,
  };
}
