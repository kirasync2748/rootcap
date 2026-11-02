import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  copyFileSync,
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { verifySolution } from "rootcap";

let child, base, fixture;
before(async () => {
  fixture = mkdtempSync(join(tmpdir(), "rootcap-demo-server-"));
  copyFileSync(join(import.meta.dirname, "server.mjs"), join(fixture, "server.mjs"));
  cpSync(join(import.meta.dirname, "dist"), join(fixture, "dist"), { recursive: true });
  symlinkSync(join(import.meta.dirname, "node_modules"), join(fixture, "node_modules"));
  child = spawn(process.execPath, ["server.mjs"], {
    cwd: fixture,
    env: { ...process.env, ROOTCAP_SECRET: "demo-regression-test-secret", PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const [data] = await Promise.race([
    once(child.stdout, "data"),
    once(child, "exit").then(([code]) => {
      throw new Error(`demo exited: ${code}`);
    }),
  ]);
  const match = data.toString().match(/port (\d+)/);
  assert.ok(match, "server must report its listening port");
  base = `http://127.0.0.1:${match[1]}`;
});
after(async () => {
  if (child && child.exitCode === null) {
    child.kill();
    await once(child, "exit");
  }
  if (fixture) rmSync(fixture, { recursive: true, force: true });
});
const post = (path, body) =>
  fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
test("serves built assets and rejects invalid methods and paths", async () => {
  const response = await fetch(base + "/");
  assert.equal(response.status, 200);
  assert.match(await response.text(), /rootcap 1\.2 demo/);
  assert.equal((await fetch(base + "/missing.js")).status, 404);
  assert.equal((await fetch(base + "/%E0%A4")).status, 400);
  const wrong = await post("/", {});
  assert.equal(wrong.status, 405);
  assert.equal(wrong.headers.get("allow"), "GET, HEAD");
});
test("serves the demo shell for extensionless routes while preserving API and asset 404s", async () => {
  const index = readFileSync(join(fixture, "dist", "index.html"), "utf8");
  for (const path of ["/docs", "/dashboard", "/nested/client-route"]) {
    const res = await fetch(base + path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get("content-type"), /^text\/html/);
    assert.equal(await res.text(), index);
  }
  const head = await fetch(base + "/docs", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  for (const path of [
    "/missing.js",
    "/missing.html",
    "/api",
    "/api/",
    "/api/missing",
    "/api%2fmissing",
  ]) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
  writeFileSync(join(fixture, "dist", "real-file"), "existing content");
  assert.equal(await (await fetch(base + "/real-file")).text(), "existing content");
});

test("rejects traversal and symlink escapes, including the fallback shell", async () => {
  const site = join(fixture, "dist");
  const outside = join(fixture, "outside.txt");
  writeFileSync(outside, "private fixture");
  symlinkSync(outside, join(site, "escaped"));
  const outsideDir = join(fixture, "outside-dir");
  mkdirSync(outsideDir);
  writeFileSync(join(outsideDir, "child"), "private fixture");
  symlinkSync(outsideDir, join(site, "escaped-dir"));
  assert.equal((await fetch(base + "/escaped")).status, 403);
  assert.equal((await fetch(base + "/escaped-dir")).status, 403);
  assert.equal((await fetch(base + "/escaped-dir/child")).status, 403);
  assert.equal((await fetch(base + "/%2e%2e%2foutside.txt")).status, 403);
  const shell = join(site, "index.html");
  const backup = join(fixture, "index.html.backup");
  renameSync(shell, backup);
  try {
    symlinkSync(outside, shell);
    assert.equal((await fetch(base + "/docs")).status, 403);
    rmSync(shell);
    assert.equal((await fetch(base + "/docs")).status, 404);
  } finally {
    rmSync(shell, { force: true });
    renameSync(backup, shell);
  }
});

test("uses the installed package to verify a real proof and redeem its token", async () => {
  const challenge = await (await fetch(base + "/api/challenge")).json();
  const solutions = challenge.challenges.map(({ s, d }) => {
    let nonce = 0;
    while (!verifySolution(s, nonce, d)) nonce++;
    return nonce;
  });
  const result = await (await post("/api/verify", { token: challenge.token, solutions })).json();
  assert.equal(result.success, true);
  assert.equal((await post("/api/submit", { token: result.token })).status, 200);
  assert.equal((await post("/api/submit", { token: "invalid" })).status, 403);
  assert.equal((await fetch(base + "/api/verify", { method: "POST", body: "{" })).status, 400);
});
