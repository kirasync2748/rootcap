import { describe, expect, it } from "vitest";
import { createFetchHandler, verifyToken } from "../lib/edge/index";
import { verifySolution } from "../lib/core/pow";
const secret = "edge-handler-test-signing-secret";

describe("Fetch API adapter", () => {
  it("issues, verifies, and redeems interoperable scoped proofs", async () => {
    const handler = createFetchHandler({
      secret,
      scope: "signup",
      challenge: { count: 2, difficulty: 1 },
    });
    const issued = (await handler(
      new Request("https://example.test/api/challenge?scope=ignored"),
    ))!;
    expect(issued.headers.get("cache-control")).toBe("no-store");
    const challenge = await issued.json();
    const solutions = challenge.challenges.map((c: { s: string; d: number }) => {
      let n = 0;
      while (!verifySolution(c.s, n, c.d)) n++;
      return n;
    });
    const response = (await handler(
      new Request("https://example.test/api/verify", {
        method: "POST",
        body: JSON.stringify({ token: challenge.token, solutions }),
      }),
    ))!;
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(await verifyToken(secret, result.token, { scope: "signup" })).toBe(true);
    expect(await verifyToken(secret, result.token, { scope: "ignored" })).toBe(false);
  });
  it("bounds input, limits requests and guards routes and methods", async () => {
    const handler = createFetchHandler({ secret });
    expect(await handler(new Request("https://example.test/unknown"))).toBeNull();
    expect((await handler(new Request("https://example.test/api/verify")))!.status).toBe(405);
    const head = (await handler(
      new Request("https://example.test/api/challenge", { method: "HEAD" }),
    ))!;
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    expect(
      (await handler(
        new Request("https://example.test/api/verify", { method: "POST", body: "x".repeat(65537) }),
      ))!.status,
    ).toBe(400);
    const limited = createFetchHandler({ secret, rateLimit: async () => false });
    expect((await limited(new Request("https://example.test/api/challenge")))!.status).toBe(429);
    const failed = createFetchHandler({
      secret,
      rateLimit: async () => {
        throw new Error("offline");
      },
    });
    expect((await failed(new Request("https://example.test/api/challenge")))!.status).toBe(503);
  });
});
