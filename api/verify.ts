import type { IncomingMessage, ServerResponse } from "node:http";
import { handleVerify } from "../lib/api/handlers.js";
import { readJson } from "../lib/api/http.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }
  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    res.statusCode = 400;
    res.end(JSON.stringify({ success: false, reason: "invalid_body" }));
    return;
  }
  try {
    res.end(JSON.stringify(handleVerify(body, "demo")));
  } catch {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "service_unavailable" }));
  }
}
