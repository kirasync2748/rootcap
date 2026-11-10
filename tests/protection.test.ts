import { describe, expect, it } from "vitest";
import { createProtection, type ConsumptionStore } from "../lib/core/protection";
import { generateChallenge, validateChallenge, verifyToken } from "../lib/core/challenge";
import { verifySolution } from "../lib/core/pow";

const oldKey = "old-signing-key-with-enough-entropy";
const newKey = "new-signing-key-with-enough-entropy";
function solve(challenges: { s: string; d: number }[]) {
  return challenges.map((challenge) => {
    let nonce = 0;
    while (!verifySolution(challenge.s, nonce, challenge.d)) nonce++;
    return nonce;
  });
}
function memoryStore(): ConsumptionStore {
  const entries = new Set<string>();
  return {
    async consume(kind, id) {
      const key = `${kind}:${id}`;
      if (entries.has(key)) return false;
      entries.add(key);
      return true;
    },
  };
}

describe("optional protection", () => {
  it("keeps the stateless API reusable and binds context when requested", () => {
    const c = generateChallenge(oldKey, {
      count: 1,
      difficulty: 1,
      scope: "pay",
      context: "order-42",
    });
    const body = { token: c.token, solutions: solve(c.challenges) };
    expect(validateChallenge(oldKey, body, { context: "order-43" }).reason).toBe(
      "context_mismatch",
    );
    const result = validateChallenge(oldKey, body, { scope: "pay", context: "order-42" });
    expect(verifyToken(oldKey, result.token!, { context: "order-42" })).toBe(true);
    expect(verifyToken(oldKey, result.token!, { context: "order-43" })).toBe(false);
    expect(verifyToken(oldKey, result.token!)).toBe(true);
    expect(verifyToken(oldKey, result.token!)).toBe(true);
  });
  it("accepts old challenges and redeem tokens during rotation, issuing with the active key", async () => {
    const c = generateChallenge(oldKey, { count: 1, difficulty: 1 });
    const body = { token: c.token, solutions: solve(c.challenges) };
    const existing = validateChallenge(oldKey, body).token!;
    const protection = createProtection({ keys: [newKey, oldKey] });
    expect(await protection.verifyToken(existing)).toBe(true);
    const result = await protection.validateChallenge(body);
    expect(verifyToken(newKey, result.token!)).toBe(true);
    expect(verifyToken(oldKey, result.token!)).toBe(false);
    expect(await createProtection({ keys: [newKey] }).verifyToken(existing)).toBe(false);
  });
  it("atomically allows only one challenge and one redeem use", async () => {
    const protection = createProtection({
      keys: [newKey],
      store: memoryStore(),
      consumeChallenges: true,
      consumeTokens: true,
    });
    const c = protection.generateChallenge({ count: 1, difficulty: 1 });
    const body = { token: c.token, solutions: solve(c.challenges) };
    const results = await Promise.all([
      protection.validateChallenge(body),
      protection.validateChallenge(body),
    ]);
    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(results.find((r) => !r.success)?.reason).toBe("challenge_consumed");
    const token = results.find((r) => r.success)!.token!;
    expect(
      (await Promise.all([protection.verifyToken(token), protection.verifyToken(token)])).sort(),
    ).toEqual([false, true]);
  });
  it("requires a store and propagates store failures rather than accepting tokens", async () => {
    expect(() => createProtection({ keys: [newKey], consumeTokens: true })).toThrow();
    const protection = createProtection({
      keys: [newKey],
      store: {
        async consume() {
          throw new Error("offline");
        },
      },
      consumeChallenges: true,
    });
    const c = protection.generateChallenge({ count: 1, difficulty: 1 });
    await expect(
      protection.validateChallenge({ token: c.token, solutions: solve(c.challenges) }),
    ).rejects.toThrow("offline");
  });
});
