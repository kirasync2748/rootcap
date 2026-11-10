import { generateChallenge, validateChallenge } from "./index.js";
import type { ChallengeOptions } from "../core/challenge.js";
import type { createProtection } from "./index.js";

export interface FetchApiOptions {
  secret?: string;
  scope?: string;
  context?: string;
  challenge?: Omit<ChallengeOptions, "scope" | "context">;
  tokenTtlMs?: number;
  protection?: ReturnType<typeof createProtection>;
  rateLimit?: (request: Request, operation: "challenge" | "verify") => boolean | Promise<boolean>;
}

async function readJson(request: Request): Promise<unknown> {
  if (!request.body) return {};
  const reader = request.body.getReader();
  const bytes = new Uint8Array(65536);
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      if (size + result.value.byteLength > bytes.length) {
        await reader.cancel();
        throw new Error("body_too_large");
      }
      bytes.set(result.value, size);
      size += result.value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(new TextDecoder().decode(bytes.subarray(0, size)) || "{}");
}

/** Fetch-compatible API handler; return null for routes the host should handle. */
export function createFetchHandler(options: FetchApiOptions) {
  if (!options.protection && (typeof options.secret !== "string" || options.secret.length < 16))
    throw new Error("Signing secret must contain at least 16 characters");
  const scope = options.scope ?? "demo";
  return async (request: Request): Promise<Response | null> => {
    const path = new URL(request.url).pathname;
    if (path !== "/api/challenge" && path !== "/api/verify") return null;
    const operation = path === "/api/challenge" ? "challenge" : "verify";
    const send = (status: number, body: unknown, headers: Record<string, string> = {}) =>
      new Response(request.method === "HEAD" ? null : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
      });
    if (
      operation === "challenge"
        ? request.method !== "GET" && request.method !== "HEAD"
        : request.method !== "POST"
    )
      return send(
        405,
        { error: "method_not_allowed" },
        { Allow: operation === "challenge" ? "GET, HEAD" : "POST" },
      );
    try {
      if (options.rateLimit && (await options.rateLimit(request, operation)) !== true)
        return send(429, { error: "rate_limited" });
      if (operation === "challenge") {
        const config = { ...options.challenge, scope, context: options.context };
        const challenge = options.protection
          ? await options.protection.generateChallenge(config)
          : await generateChallenge(options.secret!, config);
        return send(200, challenge);
      }
      let body: unknown;
      try {
        body = await readJson(request);
      } catch {
        return send(400, { success: false, reason: "invalid_body" });
      }
      const config = { scope, context: options.context, tokenTtlMs: options.tokenTtlMs };
      const result = options.protection
        ? await options.protection.validateChallenge(body, config)
        : await validateChallenge(options.secret!, body, config);
      return send(200, result);
    } catch {
      return send(503, { error: "service_unavailable" });
    }
  };
}
