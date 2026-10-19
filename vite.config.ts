import { defineConfig, type PluginOption } from "vite";
import { handleChallenge, handleVerify } from "./lib/api/handlers.js";
import { getStats } from "./lib/core/stats.js";

function readBody(req: { on: (ev: string, cb: (chunk: Buffer) => void) => void }): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => resolve(body));
  });
}

/**
 * Serves the challenge / verify / stats endpoints from the Vite dev server so
 * the widget and dashboard work locally without a separate backend. On Vercel
 * the same handlers are wired into the `api/` serverless functions.
 */
const devApiPlugin: PluginOption = {
  name: "rootcap-dev-api",
  configureServer(server) {
    server.middlewares.use("/api/challenge", (_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(handleChallenge("demo")));
    });
    server.middlewares.use("/api/verify", async (req, res) => {
      try {
        const body = JSON.parse((await readBody(req)) || "{}");
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(handleVerify(body, "demo")));
      } catch {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: false, reason: "server_error" }));
      }
    });
    server.middlewares.use("/api/stats", (_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(getStats()));
    });
  },
};

export default defineConfig({
  plugins: [devApiPlugin],
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
  build: {
    target: "es2022",
  },
});
