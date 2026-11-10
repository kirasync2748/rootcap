export { generateChallenge, validateChallenge, verifyToken, deriveSalt } from "./challenge.js";

export type {
  ChallengeOptions,
  Challenge,
  ChallengeResponse,
  VerifyOptions,
  ValidationResult,
} from "./challenge.js";

export { verifySolution, leadingZeroBits } from "./pow.js";
export { signJWT, verifyJWT } from "./jwt.js";

export { createProtection } from "./protection.js";
export type { ConsumptionStore, ProtectionOptions } from "./protection.js";

export { securityProfiles } from "./profiles.js";

export { createRedisConsumptionStore } from "./redis-store.js";
export type { RedisCommandClient } from "./redis-store.js";
export { createRedisRateLimiter } from "./redis-rate-limit.js";
