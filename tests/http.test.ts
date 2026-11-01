import { createServer, request, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import challenge from "../api/challenge";
import verify from "../api/verify";

let server: Server;
let port: number;
const previousSecret = process.env.ROOTCAP_SECRET;

beforeAll(async () => {
  process.env.ROOTCAP_SECRET = "http-regression-secret-key";
  server = createServer((req, res) => {
    void (req.url === "/api/challenge" ? challenge(req, res) : verify(req, res));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as { port: number }).port;
});

afterAll(async () => {
  if (previousSecret === undefined) delete process.env.ROOTCAP_SECRET;
  else process.env.ROOTCAP_SECRET = previousSecret;
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

function call(path: string, method: string, body?: string) {
  return new Promise<{ status: number | undefined; allow: string | undefined; body: string }>(
    (resolve, reject) => {
      const req = request({ host: "127.0.0.1", port, path, method }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, allow: res.headers.allow, body: data }),
        );
      });
      req.on("error", reject);
      req.end(body);
    },
  );
}

describe("serverless HTTP handlers", () => {
  it("drains an oversized streamed request before returning a JSON 400 response", async () => {
    const response = await new Promise<{ status: number | undefined; body: string }>(
      (resolve, reject) => {
        const req = request(
          { host: "127.0.0.1", port, path: "/api/verify", method: "POST" },
          (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => resolve({ status: res.statusCode, body }));
          },
        );
        req.on("error", reject);
        req.write("a".repeat(65537));
        setTimeout(() => req.end("extra data"), 20);
      },
    );
    expect(response.status).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ success: false, reason: "invalid_body" });
    expect((await call("/api/challenge", "GET")).status).toBe(200);
  });

  it("preserves JSON handling within the size limit", async () => {
    const response = await call("/api/verify", "POST", JSON.stringify({ solutions: [] }));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ success: false, reason: "missing_token" });
    const atLimit = JSON.stringify({ padding: "x".repeat(65522) });
    expect(Buffer.byteLength(atLimit)).toBe(65536);
    expect((await call("/api/verify", "POST", atLimit)).status).toBe(200);
    expect((await call("/api/verify", "POST", "{")).status).toBe(400);
  });

  it("accepts HEAD for challenges but rejects it for verification", async () => {
    const head = await call("/api/challenge", "HEAD");
    expect(head.status).toBe(200);
    expect(head.body).toBe("");
    expect((await call("/api/challenge", "POST")).allow).toBe("GET, HEAD");
    const verifyHead = await call("/api/verify", "HEAD");
    expect(verifyHead.status).toBe(405);
    expect(verifyHead.allow).toBe("POST");
  });
});
