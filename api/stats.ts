import type { IncomingMessage, ServerResponse } from "node:http";
import { getStats } from "../lib/core/stats.js";

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(getStats()));
}
