import { defineConfig, type PluginOption } from "vite";
import { generateChallenge, validateChallenge } from "rootcap";

/**
 * Minimal demo server — wires rootcap's core library into Vite's dev server
 * so the widget can fetch challenges and submit solutions.
 *
 * In a real project you would put these endpoints in your backend
 * (Express, Fastify, Hono, Vercel functions, etc.).
 */
const secret = process.env.ROOTCAP_SECRET || "demo-secret-change-me-0123456789";

const apiPlugin: PluginOption = {
  name: "rootcap-demo-api",
  configureServer(server) {
    server.middlewares.use("/api/challenge", (_req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(generateChallenge(secret, { scope: "demo" })));
    });
    server.middlewares.use("/api/verify", async (req, res) => {
      let body = "";
      req.on("data", (chunk: Buffer) => (body += chunk.toString()));
      req.on("end", () => {
        try {
          const data = JSON.parse(body || "{}");
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(validateChallenge(secret, data, { scope: "demo" })));
        } catch {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, reason: "server_error" }));
        }
      });
    });
  },
};

export default defineConfig({
  plugins: [apiPlugin],
  server: {
    host: "0.0.0.0",
    port: 3001,
  },
});
