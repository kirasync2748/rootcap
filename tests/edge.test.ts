import { describe, expect, it } from "vitest";
import * as edge from "../lib/edge/index";
import * as node from "../lib/core/challenge";
import { signJWT } from "../lib/core/jwt";
import { verifySolution } from "../lib/core/pow";

const secret = "edge-interoperability-test-secret";
const options = { count: 3, difficulty: 1, scope: "signup", context: "transaction-1" };
function solve(challenges: { s: string; d: number }[]) {
  return challenges.map(({ s, d }) => {
    let nonce = 0;
    while (!verifySolution(s, nonce, d)) nonce++;
    return nonce;
  });
}

describe("Web Crypto interoperability", () => {
  it("verifies a Node challenge at the edge and redeems the resulting token on Node", async () => {
    const challenge = node.generateChallenge(secret, options);
    expect(await edge.deriveSalt("seed", 2)).toBe(node.deriveSalt("seed", 2));
    const result = await edge.validateChallenge(
      secret,
      { token: challenge.token, solutions: solve(challenge.challenges) },
      options,
    );
    expect(result.success).toBe(true);
    expect(node.verifyToken(secret, result.token!, options)).toBe(true);
    expect(await edge.verifyToken(secret, result.token!, options)).toBe(true);
  });
  it("verifies an edge challenge on Node and redeems its token at the edge", async () => {
    const challenge = await edge.generateChallenge(secret, options);
    const result = node.validateChallenge(
      secret,
      { token: challenge.token, solutions: solve(challenge.challenges) },
      options,
    );
    expect(result.success).toBe(true);
    expect(await edge.verifyToken(secret, result.token!, options)).toBe(true);
    expect(await edge.verifyToken(secret, result.token!, { context: "other" })).toBe(false);
  });
  it("rejects forged, expired, wrong-scope and invalid proof inputs", async () => {
    const challenge = await edge.generateChallenge(secret, options);
    const solutions = solve(challenge.challenges);
    expect(
      (
        await edge.validateChallenge(
          secret,
          { token: challenge.token, solutions },
          { scope: "other" },
        )
      ).reason,
    ).toBe("scope_mismatch");
    expect(
      (
        await edge.validateChallenge(
          secret,
          { token: challenge.token, solutions },
          { context: "other" },
        )
      ).reason,
    ).toBe("context_mismatch");
    expect(
      (
        await edge.validateChallenge(
          secret,
          { token: challenge.token, solutions: [-1, ...solutions.slice(1)] },
          options,
        )
      ).reason,
    ).toBe("invalid_solution");
    expect(
      (
        await edge.validateChallenge(
          "another-secret",
          { token: challenge.token, solutions },
          options,
        )
      ).reason,
    ).toBe("invalid_token");
    expect(await edge.verifyToken(secret, `${challenge.token}x`)).toBe(false);
    expect(
      await edge.verifyToken(secret, signJWT(secret, { type: "redeem", exp: Date.now() - 1 })),
    ).toBe(false);
  });
  it("enforces the existing challenge bounds", async () => {
    await expect(edge.generateChallenge(secret, { count: 0 })).rejects.toThrow(RangeError);
    await expect(edge.generateChallenge(secret, { difficulty: 17 })).rejects.toThrow(RangeError);
    await expect(edge.generateChallenge(secret, { expiresMs: 0 })).rejects.toThrow(RangeError);
  });
});

it("enforces one-time use and rotation across Node and Web Crypto", async () => {
  const used = new Set<string>();
  const store = {
    async consume(kind: string, id: string) {
      const k = `${kind}:${id}`;
      if (used.has(k)) return false;
      used.add(k);
      return true;
    },
  };
  const oldKey = "old-interoperability-secret-key";
  const newKey = "new-interoperability-secret-key";
  const nodeProtection = (await import("../lib/core/protection")).createProtection({
    keys: [newKey, oldKey],
    store,
    consumeChallenges: true,
    consumeTokens: true,
  });
  const edgeProtection = edge.createProtection({
    keys: [newKey, oldKey],
    store,
    consumeChallenges: true,
    consumeTokens: true,
  });
  const oldChallenge = node.generateChallenge(oldKey, options);
  const body = { token: oldChallenge.token, solutions: solve(oldChallenge.challenges) };
  const result = await edgeProtection.validateChallenge(body, options);
  expect(result.success).toBe(true);
  expect(node.verifyToken(newKey, result.token!, options)).toBe(true);
  expect((await nodeProtection.validateChallenge(body, options)).reason).toBe("challenge_consumed");
  expect(await nodeProtection.verifyToken(result.token!, options)).toBe(true);
  expect(await edgeProtection.verifyToken(result.token!, options)).toBe(false);
});
