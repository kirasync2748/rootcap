import { describe, it, expect } from "vitest";
import {
  generateChallenge,
  validateChallenge,
  verifyToken,
  deriveSalt,
} from "../lib/core/challenge";
import { verifySolution } from "../lib/core/pow";

const SECRET = "test-secret-key-for-testing";

/** Solve a batch of challenges at difficulty 1 (fast for tests). */
function solveChallenges(challenges: { s: string; d: number }[]): number[] {
  return challenges.map((c) => {
    for (let nonce = 0; nonce < 100_000; nonce++) {
      if (verifySolution(c.s, nonce, c.d)) return nonce;
    }
    throw new Error("could not solve challenge");
  });
}

describe("deriveSalt", () => {
  it("is deterministic for the same seed and index", () => {
    expect(deriveSalt("seed", 0)).toBe(deriveSalt("seed", 0));
  });

  it("differs for different indices", () => {
    expect(deriveSalt("seed", 0)).not.toBe(deriveSalt("seed", 1));
  });
});

describe("generateChallenge", () => {
  it("generates the requested number of challenges", () => {
    expect(generateChallenge(SECRET, { count: 10, difficulty: 2 }).challenges).toHaveLength(10);
  });

  it("sets the difficulty on each challenge", () => {
    const result = generateChallenge(SECRET, { count: 5, difficulty: 3 });
    result.challenges.forEach((c) => expect(c.d).toBe(3));
  });

  it("returns a token and future expiry", () => {
    const result = generateChallenge(SECRET, { count: 5, difficulty: 2 });
    expect(result.token).toBeTruthy();
    expect(result.expires).toBeGreaterThan(Date.now());
  });

  it("uses defaults when no options are provided", () => {
    const result = generateChallenge(SECRET);
    expect(result.challenges).toHaveLength(50);
    result.challenges.forEach((c) => expect(c.d).toBe(4));
  });
});

describe("validateChallenge", () => {
  it("validates correct solutions and returns a redeem token", () => {
    const challenge = generateChallenge(SECRET, { count: 5, difficulty: 1, scope: "test" });
    const solutions = solveChallenges(challenge.challenges);
    const result = validateChallenge(
      SECRET,
      { token: challenge.token, solutions },
      { scope: "test" },
    );

    expect(result.success).toBe(true);
    expect(result.token).toBeTruthy();
    expect(result.expires).toBeGreaterThan(Date.now());
    expect(result.scope).toBe("test");
  });

  it("rejects non-object body", () => {
    expect(validateChallenge(SECRET, null)).toEqual({ success: false, reason: "invalid_body" });
    expect(validateChallenge(SECRET, "string")).toEqual({ success: false, reason: "invalid_body" });
  });

  it("rejects missing token", () => {
    expect(validateChallenge(SECRET, { solutions: [] })).toEqual({
      success: false,
      reason: "missing_token",
    });
  });

  it("rejects missing solutions", () => {
    const challenge = generateChallenge(SECRET, { count: 5, difficulty: 2 });
    expect(validateChallenge(SECRET, { token: challenge.token })).toEqual({
      success: false,
      reason: "missing_solutions",
    });
  });

  it("rejects an invalid token", () => {
    expect(validateChallenge(SECRET, { token: "invalid", solutions: [] })).toEqual({
      success: false,
      reason: "invalid_token",
    });
  });

  it("rejects scope mismatch", () => {
    const challenge = generateChallenge(SECRET, { count: 5, difficulty: 2, scope: "signup" });
    expect(
      validateChallenge(
        SECRET,
        { token: challenge.token, solutions: new Array(5).fill(0) },
        { scope: "login" },
      ),
    ).toEqual({ success: false, reason: "scope_mismatch" });
  });

  it("rejects wrong number of solutions", () => {
    const challenge = generateChallenge(SECRET, { count: 5, difficulty: 2 });
    expect(validateChallenge(SECRET, { token: challenge.token, solutions: [0, 0, 0] })).toEqual({
      success: false,
      reason: "invalid_solutions",
    });
  });

  it("rejects incorrect solutions", () => {
    const challenge = generateChallenge(SECRET, { count: 2, difficulty: 10 });
    expect(validateChallenge(SECRET, { token: challenge.token, solutions: [0, 0] })).toEqual({
      success: false,
      reason: "invalid_solution",
    });
  });
});

describe("verifyToken", () => {
  it("validates a redeem token from validateChallenge", () => {
    const challenge = generateChallenge(SECRET, { count: 3, difficulty: 1, scope: "test" });
    const solutions = solveChallenges(challenge.challenges);
    const result = validateChallenge(
      SECRET,
      { token: challenge.token, solutions },
      { scope: "test" },
    );

    expect(verifyToken(SECRET, result.token!)).toBe(true);
  });

  it("rejects a challenge token (not a redeem token)", () => {
    const challenge = generateChallenge(SECRET, { count: 3, difficulty: 2 });
    expect(verifyToken(SECRET, challenge.token)).toBe(false);
  });

  it("rejects malformed tokens", () => {
    expect(verifyToken(SECRET, "invalid-token")).toBe(false);
    expect(verifyToken(SECRET, "")).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    const challenge = generateChallenge(SECRET, { count: 3, difficulty: 1, scope: "test" });
    const solutions = solveChallenges(challenge.challenges);
    const result = validateChallenge(
      SECRET,
      { token: challenge.token, solutions },
      { scope: "test" },
    );

    expect(verifyToken("wrong-secret", result.token!)).toBe(false);
  });
});
