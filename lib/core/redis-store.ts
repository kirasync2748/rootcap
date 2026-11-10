import type { ConsumptionStore } from "./protection.js";

/** Minimal node-redis-compatible command interface. */
export interface RedisCommandClient {
  sendCommand(args: string[]): Promise<unknown>;
}

/** Create an atomic Redis-backed consumption store without a runtime dependency. */
export function createRedisConsumptionStore(
  client: RedisCommandClient,
  prefix = "rootcap:consumed:",
): ConsumptionStore {
  if (!prefix || typeof prefix !== "string")
    throw new RangeError("a non-empty key prefix is required");
  return {
    async consume(kind, id, expires) {
      if (
        (kind !== "challenge" && kind !== "redeem") ||
        !/^[a-f0-9]{64}$/.test(id) ||
        !Number.isSafeInteger(expires) ||
        expires <= Date.now()
      )
        return false;
      const result = await client.sendCommand([
        "SET",
        `${prefix}${kind}:${id}`,
        "1",
        "PXAT",
        String(expires),
        "NX",
      ]);
      if (result === "OK") return true;
      if (result === null) return false;
      throw new Error("unexpected Redis SET response");
    },
  };
}
