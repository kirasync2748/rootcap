import type { IncomingMessage, ServerResponse } from "node:http";
import { createApiHandler } from "../lib/api/server.js";

const api = createApiHandler({ demoSubmit: true });
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!(await api(req, res))) {
    res.statusCode = 404;
    res.end();
  }
}
