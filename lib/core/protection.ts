import { generateChallenge, validateChallenge, verifyToken } from "./challenge.js";
import type { ChallengeOptions, ValidationResult, VerifyOptions } from "./challenge.js";
import { signJWT, verifyJWT } from "./jwt.js";

/**
 * Implement with an atomic insert-if-absent and expiry, shared by all instances.
 * Return false when the identifier was already consumed. Failures must reject.
 */
export interface ConsumptionStore {
  consume(kind: "challenge" | "redeem", id: string, expires: number): Promise<boolean>;
}

export interface ProtectionOptions {
  /** First key signs new tokens; subsequent keys verify tokens issued before rotation. */
  keys: readonly string[];
  store?: ConsumptionStore;
  consumeChallenges?: boolean;
  consumeTokens?: boolean;
}

interface Claims {
  seed?: unknown;
  exp?: unknown;
  [key: string]: unknown;
}

/** Optional stateful security layer. The original stateless API remains available. */
export function createProtection(options: ProtectionOptions) {
  const keys = [...options.keys];
  if (!keys.length || keys.some((key) => typeof key !== "string" || key.length < 16)) {
    throw new RangeError("each signing key must contain at least 16 characters");
  }
  const { store, consumeChallenges = false, consumeTokens = false } = options;
  if ((consumeChallenges || consumeTokens) && !store) {
    throw new Error("a shared consumption store is required for one-time use");
  }

  function findKey(token: string): { key: string; claims: Claims } | undefined {
    for (const key of keys) {
      const claims = verifyJWT<Claims>(key, token);
      if (claims) return { key, claims };
    }
    return undefined;
  }

  async function consume(kind: "challenge" | "redeem", claims: Claims): Promise<boolean> {
    if (
      typeof claims.seed !== "string" ||
      !/^[a-f0-9]{64}$/.test(claims.seed) ||
      !Number.isSafeInteger(claims.exp) ||
      (claims.exp as number) <= Date.now()
    )
      return false;
    const accepted = await store!.consume(kind, claims.seed, claims.exp as number);
    return accepted === true && Date.now() < (claims.exp as number);
  }

  return {
    generateChallenge(challengeOptions: ChallengeOptions = {}) {
      return generateChallenge(keys[0], challengeOptions);
    },
    async validateChallenge(
      body: unknown,
      verifyOptions: VerifyOptions = {},
    ): Promise<ValidationResult> {
      const token = body && typeof body === "object" && "token" in body ? body.token : undefined;
      if (typeof token !== "string") return validateChallenge(keys[0], body, verifyOptions);
      const match = findKey(token);
      if (!match) return { success: false, reason: "invalid_token" };
      const result = validateChallenge(match.key, body, verifyOptions);
      if (!result.success) return result;
      if (consumeChallenges && !(await consume("challenge", match.claims))) {
        return { success: false, reason: "challenge_consumed" };
      }
      // Always issue the redeem token with the current key, even for old challenges.
      if (match.key !== keys[0] && result.token) {
        const claims = verifyJWT<Record<string, unknown>>(match.key, result.token);
        if (!claims) throw new Error("could not rotate redeem token");
        result.token = signJWT(keys[0], claims);
      }
      return result;
    },
    async verifyToken(token: string, verifyOptions: Pick<VerifyOptions, "scope" | "context"> = {}) {
      if (typeof token !== "string") return false;
      const match = findKey(token);
      if (!match || !verifyToken(match.key, token, verifyOptions)) return false;
      return !consumeTokens || (await consume("redeem", match.claims));
    },
  };
}
