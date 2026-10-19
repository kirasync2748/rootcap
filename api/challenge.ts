import type { IncomingMessage, ServerResponse } from "node:http";
import { handleChallenge } from "../lib/api/handlers.js";

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(handleChallenge("demo")));
}
