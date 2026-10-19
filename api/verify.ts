import type { IncomingMessage, ServerResponse } from "node:http";
import { handleVerify } from "../lib/api/handlers.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const body = await readJson(req);
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(handleVerify(body, "demo")));
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}
