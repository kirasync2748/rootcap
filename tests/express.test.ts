import express from "express";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";
import { createExpressMiddleware } from "../lib/integrations/express";
import { verifySolution } from "../lib/core/pow";
import { verifyToken } from "../lib/core/challenge";

describe("Express middleware", () => {
  it("verifies proofs and allows application routes to continue", async () => {
    const secret = "express-integration-test-secret";
    const app = express();
    app.use(
      createExpressMiddleware({ secret, scope: "signup", challenge: { count: 1, difficulty: 1 } }),
    );
    app.get("/health", (_req, res) => res.send("ok"));
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    try {
      expect(await (await fetch(url + "/health")).text()).toBe("ok");
      const challenge = await (await fetch(url + "/api/challenge")).json();
      const c = challenge.challenges[0];
      let nonce = 0;
      while (!verifySolution(c.s, nonce, c.d)) nonce++;
      const response = await fetch(url + "/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: challenge.token, solutions: [nonce] }),
      });
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(verifyToken(secret, result.token, { scope: "signup" })).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
