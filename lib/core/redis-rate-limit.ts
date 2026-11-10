import type { RedisCommandClient } from "./redis-store.js";

/** Redis fixed-window limiter. Callers choose a trusted, privacy-appropriate key. */
export function createRedisRateLimiter(
  client: RedisCommandClient,
  options: { limit: number; windowMs: number; prefix?: string },
) {
  const { limit, windowMs, prefix = "rootcap:rate:" } = options;
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    !Number.isSafeInteger(windowMs) ||
    windowMs < 1 ||
    windowMs > 2_147_483_647 ||
    typeof prefix !== "string" ||
    !prefix
  )
    throw new RangeError("invalid rate limiter configuration");
  // One script prevents a process failure between incrementing and setting expiry.
  const script =
    "local n=redis.call('INCR',KEYS[1]); if redis.call('PTTL',KEYS[1])<0 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return n";
  return {
    async allow(identity: string): Promise<boolean> {
      if (typeof identity !== "string" || !identity || identity.length > 512)
        throw new RangeError("invalid rate limit identity");
      const count = await client.sendCommand([
        "EVAL",
        script,
        "1",
        `${prefix}${identity}`,
        String(windowMs),
      ]);
      if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 1)
        throw new Error("unexpected Redis rate limit response");
      return count <= limit;
    },
  };
}
