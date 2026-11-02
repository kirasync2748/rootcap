import type { IncomingMessage, ServerResponse } from "node:http";
import { generateChallenge, validateChallenge, verifyToken } from "../core/index.js";
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
    let body: unknown;
    if (post) {
      try {
        body = await readJson(req);
      } catch {
        send(400, { success: false, reason: "invalid_body" });
        return true;
      }
    }
    try {
      if (path === "/api/stats") send(200, getStats());
      else {
        const secret = options.secret ?? getSecret();
        if (secret.length < 16)
          throw new Error("Signing secret must contain at least 16 characters");
        if (path === "/api/challenge") {
          const result = generateChallenge(secret, { scope });
          recordChallenge();
          send(200, result);
        } else if (path === "/api/verify") {
          const result = validateChallenge(secret, body, { scope });
          recordVerify(result.success);
          send(200, result);
        } else {
          const token = body && typeof body === "object" && "token" in body ? body.token : null;
          const success = typeof token === "string" && verifyToken(secret, token, { scope });
          send(success ? 200 : 403, { success });
        }
      }
    } catch {
      send(503, { error: "service_unavailable" });
    }
    return true;
  };
}
