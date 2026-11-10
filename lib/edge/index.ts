/** Asynchronous, Web Crypto implementation of the rootcap wire protocol. */
import type {
  ChallengeOptions,
  ChallengeResponse,
  ValidationResult,
  VerifyOptions,
} from "../core/challenge.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const header = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
const maxTokenLength = 16384;

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function decode64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(
    value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4),
  );
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
async function key(secret: string, usage: KeyUsage): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}
async function sign(secret: string, payload: Record<string, unknown>): Promise<string> {
  const encoded = base64url(encoder.encode(JSON.stringify(payload)));
  const data = `${header}.${encoded}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await key(secret, "sign"),
    encoder.encode(data),
  );
  return `${data}.${base64url(new Uint8Array(signature))}`;
}
async function verify<T>(secret: string, token: string): Promise<T | null> {
  if (typeof token !== "string" || token.length > maxTokenLength) return null;
  const parts = token.split(".");
  if (
    parts.length !== 3 ||
    parts[0] !== header ||
    !/^[A-Za-z0-9_-]+$/.test(parts[1]) ||
    !/^[A-Za-z0-9_-]+$/.test(parts[2])
  )
    return null;
  try {
    const signature = decode64(parts[2]);
    if (
      signature.length !== 32 ||
      !(await crypto.subtle.verify(
        "HMAC",
        await key(secret, "verify"),
        signature,
        encoder.encode(`${parts[0]}.${parts[1]}`),
      ))
    )
      return null;
    const payload: unknown = JSON.parse(decoder.decode(decode64(parts[1])));
    return payload !== null && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as T)
      : null;
  } catch {
    return null;
  }
}
function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}
export async function deriveSalt(seed: string, index: number): Promise<string> {
  return hex(await sha256(`${seed}:${index}`));
}
async function validSolution(salt: string, nonce: number, difficulty: number): Promise<boolean> {
  const hash = await sha256(`${salt}${nonce}`);
  let bits = 0;
  for (const byte of hash) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    for (let mask = 0x80; (byte & mask) === 0; mask >>= 1) bits++;
    break;
  }
  return bits >= difficulty;
}
interface ChallengeClaims {
  seed: string;
  count: number;
  difficulty: number;
  iat: number;
  exp: number;
  scope?: string;
  context?: string;
}

/** Issue a protocol-compatible challenge using Web Crypto. */
export async function generateChallenge(
  secret: string,
  opts: ChallengeOptions = {},
): Promise<ChallengeResponse> {
  if (opts.scope !== undefined && typeof opts.scope !== "string")
    throw new RangeError("scope must be a string");
  if (opts.context !== undefined && typeof opts.context !== "string")
    throw new RangeError("context must be a string");
  const count = opts.count ?? 50;
  const difficulty = opts.difficulty ?? 4;
  const expiresMs = opts.expiresMs ?? 600_000;
  if (!Number.isSafeInteger(count) || count < 1 || count > 1000)
    throw new RangeError("count must be an integer from 1 to 1000");
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 16)
    throw new RangeError("difficulty must be an integer from 1 to 16");
  const iat = Date.now();
  if (!Number.isSafeInteger(expiresMs) || expiresMs <= 0 || !Number.isSafeInteger(iat + expiresMs))
    throw new RangeError("expiresMs must be a positive safe lifetime");
  const seed = hex(crypto.getRandomValues(new Uint8Array(32)));
  const exp = iat + expiresMs;
  const token = await sign(secret, {
    seed,
    count,
    difficulty,
    iat,
    exp,
    scope: opts.scope,
    context: opts.context,
  });
  if (token.length > maxTokenLength) throw new RangeError("challenge token exceeds maximum length");
  const challenges = await Promise.all(
    Array.from({ length: count }, async (_, i) => ({
      s: await deriveSalt(seed, i),
      d: difficulty,
    })),
  );
  return { challenges, token, expires: exp };
}

/** Verify a proof and issue a redeem token using Web Crypto. */
export async function validateChallenge(
  secret: string,
  body: unknown,
  opts: VerifyOptions = {},
): Promise<ValidationResult> {
  if (body === null || typeof body !== "object") return { success: false, reason: "invalid_body" };
  const b = body as Record<string, unknown>;
  if (!b.token || typeof b.token !== "string") return { success: false, reason: "missing_token" };
  if (!Array.isArray(b.solutions)) return { success: false, reason: "missing_solutions" };
  const p = await verify<ChallengeClaims>(secret, b.token);
  if (
    !p ||
    typeof p.seed !== "string" ||
    !/^[a-f0-9]{64}$/.test(p.seed) ||
    !Number.isSafeInteger(p.count) ||
    p.count < 1 ||
    p.count > 1000 ||
    !Number.isInteger(p.difficulty) ||
    p.difficulty < 1 ||
    p.difficulty > 16 ||
    !Number.isSafeInteger(p.exp) ||
    !Number.isSafeInteger(p.iat) ||
    p.exp <= p.iat ||
    (p.scope !== undefined && typeof p.scope !== "string") ||
    (p.context !== undefined && typeof p.context !== "string")
  )
    return { success: false, reason: "invalid_token" };
  if (Date.now() >= p.exp) return { success: false, reason: "expired" };
  if (opts.scope !== undefined && p.scope !== opts.scope)
    return { success: false, reason: "scope_mismatch" };
  if (opts.context !== undefined && p.context !== opts.context)
    return { success: false, reason: "context_mismatch" };
  if (b.solutions.length !== p.count) return { success: false, reason: "invalid_solutions" };
  for (let i = 0; i < p.count; i++) {
    const solution = b.solutions[i];
    if (
      typeof solution !== "number" ||
      !Number.isSafeInteger(solution) ||
      solution < 0 ||
      !(await validSolution(await deriveSalt(p.seed, i), solution, p.difficulty))
    )
      return { success: false, reason: "invalid_solution" };
  }
  // Async verification can cross the challenge expiry while hashing.
  const now = Date.now();
  if (now >= p.exp) return { success: false, reason: "expired" };
  const ttl = opts.tokenTtlMs ?? 1_200_000;
  if (!Number.isSafeInteger(ttl) || ttl <= 0 || !Number.isSafeInteger(now + ttl))
    throw new RangeError("tokenTtlMs must be a positive safe lifetime");
  const token = await sign(secret, {
    seed: p.seed,
    type: "redeem",
    iat: now,
    exp: now + ttl,
    scope: p.scope,
    context: p.context,
  });
  return { success: true, token, expires: now + ttl, scope: p.scope };
}

/** Verify a redeem token using Web Crypto. */
export async function verifyToken(
  secret: string,
  token: string,
  opts: Pick<VerifyOptions, "scope" | "context"> = {},
): Promise<boolean> {
  const p = await verify<{ type?: string; exp: number; scope?: string; context?: string }>(
    secret,
    token,
  );
  if (!p || p.type !== "redeem" || !Number.isSafeInteger(p.exp) || Date.now() >= p.exp)
    return false;
  if (opts.scope !== undefined && p.scope !== opts.scope) return false;
  if (opts.context !== undefined && p.context !== opts.context) return false;
  return true;
}

/** Optional rotation and atomic one-time use for Web Crypto runtimes. */
export function createProtection(options: import("../core/protection.js").ProtectionOptions) {
  const keys = [...options.keys];
  if (!keys.length || keys.some((value) => typeof value !== "string" || value.length < 16)) {
    throw new RangeError("each signing key must contain at least 16 characters");
  }
  const { store, consumeChallenges = false, consumeTokens = false } = options;
  if ((consumeChallenges || consumeTokens) && !store)
    throw new Error("a shared consumption store is required for one-time use");
  type Claims = Record<string, unknown> & { seed?: unknown; exp?: unknown };
  async function findKey(token: string): Promise<{ key: string; claims: Claims } | undefined> {
    for (const candidate of keys) {
      const claims = await verify<Claims>(candidate, token);
      if (claims) return { key: candidate, claims };
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
    generateChallenge: (opts: ChallengeOptions = {}) => generateChallenge(keys[0], opts),
    async validateChallenge(body: unknown, opts: VerifyOptions = {}): Promise<ValidationResult> {
      const token = body && typeof body === "object" && "token" in body ? body.token : undefined;
      if (typeof token !== "string") return validateChallenge(keys[0], body, opts);
      const match = await findKey(token);
      if (!match) return { success: false, reason: "invalid_token" };
      const result = await validateChallenge(match.key, body, opts);
      if (!result.success) return result;
      if (consumeChallenges && !(await consume("challenge", match.claims)))
        return { success: false, reason: "challenge_consumed" };
      if (match.key !== keys[0] && result.token) {
        const claims = await verify<Record<string, unknown>>(match.key, result.token);
        if (!claims) throw new Error("could not rotate redeem token");
        result.token = await sign(keys[0], claims);
      }
      return result;
    },
    async verifyToken(
      token: string,
      opts: Pick<VerifyOptions, "scope" | "context"> = {},
    ): Promise<boolean> {
      if (typeof token !== "string") return false;
      const match = await findKey(token);
      if (!match || !(await verifyToken(match.key, token, opts))) return false;
      return !consumeTokens || (await consume("redeem", match.claims));
    },
  };
}

export { createRedisConsumptionStore } from "../core/redis-store.js";
export type { RedisCommandClient } from "../core/redis-store.js";
export type { ConsumptionStore, ProtectionOptions } from "../core/protection.js";
export type {
  ChallengeOptions,
  ChallengeResponse,
  ValidationResult,
  VerifyOptions,
} from "../core/challenge.js";
export { createRedisRateLimiter } from "../core/redis-rate-limit.js";

export { createFetchHandler } from "./http.js";
export type { FetchApiOptions } from "./http.js";
