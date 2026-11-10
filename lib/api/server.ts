import type { IncomingMessage, ServerResponse } from "node:http";
import { generateChallenge, validateChallenge, verifyToken } from "../core/index.js";
import type { ChallengeOptions, createProtection } from "../core/index.js";
import { getStats, recordChallenge, recordVerify } from "../core/stats.js";
import { getSecret } from "./handlers.js";
import { readJson } from "./http.js";

export interface ApiOptions {
  /** Signing secret; defaults to ROOTCAP_SECRET (development fallback only). */
  secret?: string;
  /** Server-controlled scope. Defaults to "demo". */
  scope?: string;
  /** Enable /api/submit for the example form; no form data is stored. */
  demoSubmit?: boolean;
  /** Server-controlled binding for a particular operation. */
  context?: string;
  /** Challenge parameters; scope and context are always controlled by the server. */
  challenge?: Omit<ChallengeOptions, "scope" | "context">;
  tokenTtlMs?: number;
  /** Optional key rotation and one-time use service. */
  protection?: ReturnType<typeof createProtection>;
  /** Return false to reject a request. Use shared state for multiple instances. */
  rateLimit?: (
    req: IncomingMessage,
    operation: "challenge" | "verify" | "submit",
  ) => boolean | Promise<boolean>;
  /** Receives aggregate-friendly events without tokens, solutions, or request data. */
  onEvent?: (event: {
    operation: "challenge" | "verify" | "submit";
    success: boolean;
    durationMs: number;
  }) => void | Promise<void>;
}

/** Handle known routes, returning false so callers can serve other requests. */
export function createApiHandler(options: ApiOptions = {}) {
  const scope = options.scope ?? "demo";
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const path = new URL(req.url || "/", "http://localhost").pathname;
    if (
      !["/api/challenge", "/api/verify", "/api/stats"].includes(path) &&
      !(options.demoSubmit && path === "/api/submit")
    )
      return false;
    const send = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      res.end(req.method === "HEAD" ? undefined : JSON.stringify(body));
    };
    const post = path === "/api/verify" || path === "/api/submit";
    if (post ? req.method !== "POST" : req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", post ? "POST" : "GET, HEAD");
      send(405, { error: "method_not_allowed" });
      return true;
    }
    const operation =
      path === "/api/challenge"
        ? "challenge"
        : path === "/api/verify"
          ? "verify"
          : path === "/api/submit"
            ? "submit"
            : undefined;
    const started = Date.now();
    const event = (success: boolean) => {
      if (operation && options.onEvent) {
        // Observability must not change verification results.
        void Promise.resolve()
          .then(() => options.onEvent!({ operation, success, durationMs: Date.now() - started }))
          .catch(() => {});
      }
    };
    try {
      if (operation && options.rateLimit && (await options.rateLimit(req, operation)) !== true) {
        event(false);
        send(429, { error: "rate_limited" });
        return true;
      }
    } catch {
      event(false);
      send(503, { error: "service_unavailable" });
      return true;
    }
    let body: unknown;
    if (post) {
      try {
        body = await readJson(req);
      } catch {
        event(false);
        send(400, { success: false, reason: "invalid_body" });
        return true;
      }
    }
    try {
      if (path === "/api/stats") send(200, getStats());
      else {
        const secret = options.protection ? undefined : (options.secret ?? getSecret());
        if (secret !== undefined && secret.length < 16)
          throw new Error("Signing secret must contain at least 16 characters");
        if (path === "/api/challenge") {
          const challengeOptions = { ...options.challenge, scope, context: options.context };
          const result = options.protection
            ? options.protection.generateChallenge(challengeOptions)
            : generateChallenge(secret!, challengeOptions);
          recordChallenge();
          event(true);
          send(200, result);
        } else if (path === "/api/verify") {
          const verifyOptions = { scope, context: options.context, tokenTtlMs: options.tokenTtlMs };
          const result = options.protection
            ? await options.protection.validateChallenge(body, verifyOptions)
            : validateChallenge(secret!, body, verifyOptions);
          recordVerify(result.success);
          event(result.success);
          send(200, result);
        } else {
          const token = body && typeof body === "object" && "token" in body ? body.token : null;
          const verifyOptions = { scope, context: options.context };
          const success =
            typeof token === "string" &&
            (options.protection
              ? await options.protection.verifyToken(token, verifyOptions)
              : verifyToken(secret!, token, verifyOptions));
          event(success);
          send(success ? 200 : 403, { success });
        }
      }
    } catch {
      event(false);
      send(503, { error: "service_unavailable" });
    }
    return true;
  };
}
