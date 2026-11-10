import type { IncomingMessage, ServerResponse } from "node:http";
import { createApiHandler } from "../api/server.js";
import type { ApiOptions } from "../api/server.js";

/** Express-compatible middleware. Mount before body parsers for the API routes. */
export function createExpressMiddleware(options: ApiOptions = {}) {
  const api = createApiHandler(options);
  return (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void): void => {
    void api(req, res)
      .then((handled) => {
        if (!handled) next();
      })
      .catch(next);
  };
}
