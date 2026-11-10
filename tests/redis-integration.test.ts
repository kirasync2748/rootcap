import { spawn, execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRedisConsumptionStore } from "../lib/core/redis-store";
import { createRedisRateLimiter } from "../lib/core/redis-rate-limit";
import { createProtection } from "../lib/core/protection";
import { verifySolution } from "../lib/core/pow";

const exec = promisify(execFile);
const enabled = process.env.ROOTCAP_REDIS_INTEGRATION === "1";

describe.skipIf(!enabled)("Redis one-time use integration", () => {
  let dir: string;
  let socket: string;
  let redis: ReturnType<typeof spawn>;
  async function command(args: string[]) {
    const result = await exec("redis-cli", ["-s", socket, "--json", ...args]);
    return JSON.parse(result.stdout.trim());
  }
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "rootcap-redis-"));
    socket = join(dir, "redis.sock");
    redis = spawn(
      "redis-server",
      [
        "--port",
        "0",
        "--save",
        "",
        "--appendonly",
        "no",
        "--unixsocket",
        socket,
        "--unixsocketperm",
        "700",
      ],
      { stdio: "ignore" },
    );
    for (let i = 0; i < 100; i++) {
      try {
        if ((await command(["PING"])) === "PONG") return;
      } catch {
        /* Waiting for startup. */
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error("Redis did not start");
  });
  afterAll(async () => {
    if (redis) {
      try {
        await command(["SHUTDOWN", "NOSAVE"]);
      } catch {
        /* Shutdown can close the connection. */
      }
      redis.kill();
    }
    if (dir) await rm(dir, { recursive: true, force: true });
  });
  it("enforces consumption across independent protection instances", async () => {
    const store = createRedisConsumptionStore({ sendCommand: command });
    const config = {
      keys: ["real-redis-integration-secret"],
      store,
      consumeChallenges: true,
      consumeTokens: true,
    };
    const first = createProtection(config);
    const second = createProtection(config);
    const challenge = first.generateChallenge({ count: 2, difficulty: 1 });
    const solutions = challenge.challenges.map((c) => {
      let nonce = 0;
      while (!verifySolution(c.s, nonce, c.d)) nonce++;
      return nonce;
    });
    const body = { token: challenge.token, solutions };
    const results = await Promise.all([
      first.validateChallenge(body),
      second.validateChallenge(body),
    ]);
    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(results.find((r) => !r.success)?.reason).toBe("challenge_consumed");
    const token = results.find((r) => r.success)!.token!;
    const redemptions = await Promise.all([first.verifyToken(token), second.verifyToken(token)]);
    expect(redemptions.filter(Boolean)).toHaveLength(1);
  });
  it("limits concurrent requests across instances", async () => {
    const a = createRedisRateLimiter({ sendCommand: command }, { limit: 3, windowMs: 10_000 });
    const b = createRedisRateLimiter({ sendCommand: command }, { limit: 3, windowMs: 10_000 });
    const decisions = await Promise.all([
      a.allow("shared"),
      b.allow("shared"),
      a.allow("shared"),
      b.allow("shared"),
    ]);
    expect(decisions.filter(Boolean)).toHaveLength(3);
    expect(await a.allow("independent")).toBe(true);
    await command(["SET", "rootcap:rate:no-expiry", "1"]);
    expect(await a.allow("no-expiry")).toBe(true);
    expect(await command(["PTTL", "rootcap:rate:no-expiry"])).toBeGreaterThan(0);
  });
  it("fails closed when Redis stops accepting commands", async () => {
    const store = createRedisConsumptionStore({ sendCommand: command });
    try {
      await command(["SHUTDOWN", "NOSAVE"]);
    } catch {
      /* Shutdown can close the connection. */
    }
    await expect(store.consume("redeem", "a".repeat(64), Date.now() + 1000)).rejects.toThrow();
  });
});
