import { generateChallenge, validateChallenge } from "../core/index.js";
import { recordChallenge, recordVerify } from "../core/stats.js";

/**
 * Shared request handlers used by both the Vite dev-server middleware and
 * the Vercel serverless functions, so behaviour is identical in every
 * environment.
 */

function getSecret(): string {
  const secret = process.env.ROOTCAP_SECRET;
  if (!secret || secret.length < 16) {
    // Fallback for local development only — never rely on this in a live setup.
    return "rootcap-dev-fallback-secret-0123456789abcdef";
  }
  return secret;
}

export function handleChallenge(scope?: string) {
  recordChallenge();
  return generateChallenge(getSecret(), { scope });
}

export function handleVerify(body: unknown, scope?: string) {
  const result = validateChallenge(getSecret(), body, { scope });
  recordVerify(result.success);
  return result;
}
