import { describe, expect, it } from "vitest";
import { generateChallenge, validateChallenge, verifyToken } from "../lib/core/challenge";
import { signJWT, verifyJWT } from "../lib/core/jwt";
import { verifySolution } from "../lib/core/pow";
const secret = "security-regression-test-secret";

describe("untrusted token validation", () => {
  it.each([{}, { type: "redeem" }, { type: "redeem", exp: "tomorrow" }])(
    "rejects missing or invalid expiry %j",
    (claims) => {
      expect(verifyToken(secret, signJWT(secret, claims))).toBe(false);
    },
  );
  it("rejects challenge claims with no work", () => {
    const token = signJWT(secret, {
      seed: "a".repeat(64),
      count: 0,
      difficulty: 1,
      iat: Date.now(),
      exp: Date.now() + 10000,
    });
    expect(validateChallenge(secret, { token, solutions: [] }).success).toBe(false);
  });
  it("enforces redeem token scope", () => {
    const token = signJWT(secret, { type: "redeem", scope: "signup", exp: Date.now() + 10000 });
    expect(verifyToken(secret, token, { scope: "login" })).toBe(false);
    expect(verifyToken(secret, token, { scope: "signup" })).toBe(true);
  });
  it("rejects signed non-object payloads without throwing", () => {
    expect(
      verifyJWT(secret, signJWT(secret, null as unknown as Record<string, unknown>)),
    ).toBeNull();
  });
  it.each([{ count: 0 }, { count: 1.5 }, { count: 1001 }, { difficulty: 0 }, { expiresMs: -1 }])(
    "rejects invalid generation options %j",
    (options) => {
      expect(() => generateChallenge(secret, options)).toThrow(RangeError);
    },
  );
  it("rejects fractional nonces and invalid difficulties", () => {
    expect(verifySolution("salt", 0.5, 1)).toBe(false);
    expect(verifySolution("salt", 0, 0)).toBe(false);
  });

  it("accepts difficulty 16 and rejects 17 for generated and signed challenges", () => {
    expect(generateChallenge(secret, { difficulty: 16, count: 1 }).challenges[0].d).toBe(16);
    expect(() => generateChallenge(secret, { difficulty: 17 })).toThrow(RangeError);
    const iat = Date.now();
    const claims = { seed: "a".repeat(64), count: 1, difficulty: 16, iat, exp: iat + 60000 };
    expect(
      validateChallenge(secret, { token: signJWT(secret, claims), solutions: [47393] }).success,
    ).toBe(true);
    expect(
      validateChallenge(secret, {
        token: signJWT(secret, { ...claims, difficulty: 17 }),
        solutions: [47393],
      }),
    ).toEqual({ success: false, reason: "invalid_token" });
  });

  it.each(["a", "😀", '"\\'])("limits encoded challenge token size for %j scopes", (character) => {
    let low = 0;
    let high = 17000;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      try {
        generateChallenge(secret, { count: 1, difficulty: 1, scope: character.repeat(middle) });
        low = middle;
      } catch (err) {
        if (!(err instanceof RangeError)) throw err;
        high = middle;
      }
    }
    const scope = character.repeat(low);
    const challenge = generateChallenge(secret, { count: 1, difficulty: 1, scope });
    expect(challenge.token.length).toBeLessThanOrEqual(16384);
    expect(verifyJWT(secret, challenge.token)).not.toBeNull();
    let nonce = 0;
    while (!verifySolution(challenge.challenges[0].s, nonce, 1)) nonce++;
    const result = validateChallenge(
      secret,
      { token: challenge.token, solutions: [nonce] },
      { scope },
    );
    expect(result.success).toBe(true);
    expect(verifyToken(secret, result.token!, { scope })).toBe(true);
    expect(() =>
      generateChallenge(secret, { count: 1, difficulty: 1, scope: character.repeat(high) }),
    ).toThrow(RangeError);
  });
});
