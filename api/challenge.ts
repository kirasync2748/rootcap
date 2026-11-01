import type { IncomingMessage, ServerResponse } from "node:http";
import { handleChallenge } from "../lib/api/handlers.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }
  try {
    res.end(JSON.stringify(handleChallenge("demo")));
  } catch {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "service_unavailable" }));
  }
}
