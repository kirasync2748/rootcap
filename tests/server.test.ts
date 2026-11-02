import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PassThrough } from "node:stream";
import type { IncomingMessage } from "node:http";
import { readJson } from "../lib/api/http";
import { createApiHandler } from "../lib/api/server";
import { generateChallenge, validateChallenge } from "../lib/core/challenge";
import { verifySolution } from "../lib/core/pow";

const secret = "adapter-regression-secret";
let server: Server;
let base: string;
beforeAll(async () => {
  const api = createApiHandler({ secret, demoSubmit: true });
  server = createServer((req, res) => {
    void api(req, res).then((handled) => {
      if (!handled) {
        res.statusCode = 404;
        res.end();
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(
  () => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
);

function redeem(scope: string) {
  const challenge = generateChallenge(secret, { count: 2, difficulty: 1, scope });
  const solutions = challenge.challenges.map((c) => {
    let nonce = 0;
    while (!verifySolution(c.s, nonce, c.d)) nonce++;
    return nonce;
  });
  return validateChallenge(secret, { token: challenge.token, solutions }, { scope }).token;
}
const post = (path: string, body: unknown) =>
  fetch(base + path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

describe("shared API adapter", () => {
  it("verifies actual proofs and redeems only valid tokens with the server scope", async () => {
    const challenge = await (await fetch(base + "/api/challenge?scope=attacker")).json();
    const solutions = challenge.challenges.map((c: { s: string; d: number }) => {
      let nonce = 0;
      while (!verifySolution(c.s, nonce, c.d)) nonce++;
      return nonce;
    });
    const result = await (await post("/api/verify", { token: challenge.token, solutions })).json();
    expect(result.success).toBe(true);
    expect(result.scope).toBe("demo");
    expect((await post("/api/submit", { token: result.token })).status).toBe(200);
    for (const token of ["forged", challenge.token, redeem("signup"), null]) {
      expect((await post("/api/submit", { token })).status).toBe(403);
    }
  });
  it("uses exact routing, method guards, HEAD and no-store", async () => {
    expect((await fetch(base + "/api/challenge/extra")).status).toBe(404);
    const wrong = await post("/api/challenge", {});
    expect(wrong.status).toBe(405);
    expect(wrong.headers.get("allow")).toBe("GET, HEAD");
    expect(wrong.headers.get("cache-control")).toBe("no-store");
    const head = await fetch(base + "/api/challenge", { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  });
  it("bounds JSON and rejects malformed requests without a server error", async () => {
    expect((await post("/api/verify", { padding: "x".repeat(65536) })).status).toBe(400);
    expect((await fetch(base + "/api/verify", { method: "POST", body: "{" })).status).toBe(400);
  });
  it("decodes UTF-8 only after collecting chunks", async () => {
    const stream = new PassThrough();
    const pending = readJson(stream as IncomingMessage);
    const bytes = Buffer.from(JSON.stringify({ text: "😀" }));
    const split = bytes.indexOf(Buffer.from("😀")) + 1;
    stream.write(bytes.subarray(0, split));
    stream.end(bytes.subarray(split));
    expect(await pending).toEqual({ text: "😀" });
  });
});
