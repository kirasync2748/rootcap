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
});
