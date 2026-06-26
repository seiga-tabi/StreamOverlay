export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

type Bucket = {
  count: number;
  resetAt: number;
};

export class MemoryRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private lastPruneAt = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  check(key: string, now = Date.now()): RateLimitResult {
    this.prune(now);
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { ok: true };
    }
    current.count += 1;
    if (current.count <= this.limit) return { ok: true };
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }

  reset(): void {
    this.buckets.clear();
    this.lastPruneAt = 0;
  }

  private prune(now: number): void {
    if (now - this.lastPruneAt < this.windowMs) return;
    this.lastPruneAt = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

export const dashboardLoginLimiter = new MemoryRateLimiter(8, 60_000);
export const dashboardApiLimiter = new MemoryRateLimiter(240, 60_000);
export const publicLolApiLimiter = new MemoryRateLimiter(60, 60_000);
export const oauthLimiter = new MemoryRateLimiter(20, 60_000);
export const websocketLimiter = new MemoryRateLimiter(60, 60_000);
export const bridgeCommandLimiter = new MemoryRateLimiter(120, 60_000);

export function resetSecurityRateLimiters(): void {
  dashboardLoginLimiter.reset();
  dashboardApiLimiter.reset();
  publicLolApiLimiter.reset();
  oauthLimiter.reset();
  websocketLimiter.reset();
  bridgeCommandLimiter.reset();
}
