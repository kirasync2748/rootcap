import { randomBytes, createHash } from "node:crypto";
import { signJWT, verifyJWT } from "./jwt.js";
import { verifySolution } from "./pow.js";

export interface ChallengeOptions {
  /** Number of challenges to generate (default 50). */
  count?: number;
  /** Leading zero bits required per challenge (default 4). */
  difficulty?: number;
  /** Time-to-live for the challenge token in ms (default 600000 = 10 min). */
  expiresMs?: number;
  /** Optional scope string bound to the challenge. */
  scope?: string;
}

export interface Challenge {
  /** Salt as a hex string. */
  s: string;
  /** Difficulty (leading zero bits required). */
  d: number;
}

export interface ChallengeResponse {
  challenges: Challenge[];
  /** Signed JWT containing the challenge parameters. */
  token: string;
  /** Expiry timestamp (ms since epoch). */
  expires: number;
}

export interface VerifyOptions {
  /** Must match the scope the challenge was created with. */
  scope?: string;
  /** Time-to-live for the redeem token in ms (default 1200000 = 20 min). */
  tokenTtlMs?: number;
}

export interface ValidationResult {
  success: boolean;
  reason?: string;
  token?: string;
  expires?: number;
  scope?: string;
}

/**
 * Deterministically derive a salt from a seed and an index.
 * This keeps the JWT small — only the seed is stored, not every salt.
 */
export function deriveSalt(seed: string, index: number): string {
  return createHash("sha256").update(`${seed}:${index}`).digest("hex");
}

/**
 * Generate a set of proof-of-work challenges and a signed token.
 * The token is a stateless HS256 JWT — no server-side storage required.
 */
export function generateChallenge(secret: string, opts: ChallengeOptions = {}): ChallengeResponse {
  const count = opts.count ?? 50;
  const difficulty = opts.difficulty ?? 4;
  const expiresMs = opts.expiresMs ?? 600_000;
  const seed = randomBytes(32).toString("hex");
  const iat = Date.now();
  const exp = iat + expiresMs;

  const challenges: Challenge[] = Array.from({ length: count }, (_, i) => ({
    s: deriveSalt(seed, i),
    d: difficulty,
  }));

  const token = signJWT(secret, {
    seed,
    count,
    difficulty,
    iat,
    exp,
    scope: opts.scope,
  });

  return { challenges, token, expires: exp };
}

/**
 * Validate submitted solutions against a signed challenge token and
 * issue a redeem token on success.
 */
export function validateChallenge(
  secret: string,
  body: unknown,
  opts: VerifyOptions = {},
): ValidationResult {
  if (body === null || typeof body !== "object") {
    return { success: false, reason: "invalid_body" };
  }
  const b = body as Record<string, unknown>;
  if (!b.token || typeof b.token !== "string") {
    return { success: false, reason: "missing_token" };
  }
  if (!Array.isArray(b.solutions)) {
    return { success: false, reason: "missing_solutions" };
  }

  const payload = verifyJWT<{
    seed: string;
    count: number;
    difficulty: number;
    iat: number;
    exp: number;
    scope?: string;
  }>(secret, b.token);

  if (!payload) return { success: false, reason: "invalid_token" };
  if (Date.now() >= payload.exp) return { success: false, reason: "expired" };
  if (opts.scope !== undefined && payload.scope !== opts.scope) {
    return { success: false, reason: "scope_mismatch" };
  }
  if (b.solutions.length !== payload.count) {
    return { success: false, reason: "invalid_solutions" };
  }

  for (let i = 0; i < payload.count; i++) {
    const sol = b.solutions[i];
    if (typeof sol !== "number" || !Number.isFinite(sol)) {
      return { success: false, reason: "invalid_solution" };
    }
    const salt = deriveSalt(payload.seed, i);
    if (!verifySolution(salt, sol, payload.difficulty)) {
      return { success: false, reason: "invalid_solution" };
    }
  }

  const now = Date.now();
  const tokenTtlMs = opts.tokenTtlMs ?? 1_200_000;
  const redeemToken = signJWT(secret, {
    seed: payload.seed,
    type: "redeem",
    iat: now,
    exp: now + tokenTtlMs,
    scope: payload.scope,
  });

  return {
    success: true,
    token: redeemToken,
    expires: now + tokenTtlMs,
    scope: payload.scope,
  };
}

/**
 * Verify a previously issued redeem token.
 */
export function verifyToken(secret: string, token: string): boolean {
  const payload = verifyJWT<{ type?: string; exp: number }>(secret, token);
  if (!payload) return false;
  if (payload.type !== "redeem") return false;
  if (Date.now() >= payload.exp) return false;
  return true;
}
