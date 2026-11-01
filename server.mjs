#!/usr/bin/env node

/**
 * Self-host server for the rootcap demo site.
 *
 * Serves the built website as static files plus the same API endpoints the
 * Vercel functions provide (`/api/challenge`, `/api/verify`, `/api/stats`),
 * using the core library bundle produced by `npm run build:lib`.
 *
 * Layout (see Dockerfile, or produce it manually):
 *   SITE_DIR (default "site") — output of `npm run build`
 *   LIB_DIR  (default "dist") — output of `npm run build:lib`
 *
 * Required environment:
 *   ROOTCAP_SECRET — HS256 signing key. Generate one with:
 *     node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
 * Optional environment:
 *   PORT — listen port (default 3000)
 */

import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import { extname, join, normalize } from "node:path";
import { generateChallenge, validateChallenge } from "./dist/core/index.js";

const PORT = Number(process.env.PORT) || 3000;
const SITE_DIR = normalize(process.env.SITE_DIR || "site");
const LIB_DIR = normalize(process.env.LIB_DIR || "dist");
const SCOPE = "demo";

const secret = process.env.ROOTCAP_SECRET;
if (!secret || secret.length < 16) {
  console.error(
    "Error: ROOTCAP_SECRET is missing or too short (minimum 16 characters).\n" +
      "Generate one with:\n" +
      "  node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"",
  );
  process.exit(1);
}

if (!existsSync(join(LIB_DIR, "core", "index.js"))) {
  console.error(
    `Error: ${join(LIB_DIR, "core", "index.js")} not found.\n` +
      "Build the library first: npm run build:lib",
  );
  process.exit(1);
}

// In-memory usage stats — same shape as lib/core/stats.ts. Counters reset
// when the server restarts.
const stats = {
  challengesRequested: 0,
  verificationsAttempted: 0,
  verificationsSucceeded: 0,
  verificationsFailed: 0,
  startedAt: Date.now(),
};

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    let size = 0;
    req.on("error", () => resolve(null));
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size <= 65536) data += chunk;
      else resolve(null);
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve(null);
      }
    });
  });
}

function serveStatic(pathname, res) {
  let filePath = normalize(join(SITE_DIR, pathname === "/" ? "/index.html" : pathname));
  if (!filePath.startsWith(SITE_DIR + "/") && filePath !== SITE_DIR) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extname(filePath)] || "application/octet-stream",
    });
    createReadStream(filePath).pipe(res);
    return;
  }
  // SPA fallback — same behaviour as the Vercel rewrite: every non-file path
  // (e.g. /docs, /dashboard) gets the app shell and the client router takes over.
  const shell = join(SITE_DIR, "index.html");
  if (existsSync(shell)) {
    res.writeHead(200, { "Content-Type": MIME_TYPES[".html"] });
    createReadStream(shell).pipe(res);
    return;
  }
  sendJson(res, 404, { error: "not_found" });
}

const server = http.createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    sendJson(res, 400, { error: "invalid_url" });
    return;
  }
  const isVerify = pathname === "/api/verify";
  const allowed = isVerify ? "POST" : "GET, HEAD";
  if (isVerify ? req.method !== "POST" : req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", allowed);
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  if (pathname === "/api/challenge") {
    stats.challengesRequested++;
    sendJson(res, 200, generateChallenge(secret, { scope: SCOPE }));
    return;
  }

  if (pathname === "/api/verify") {
    const body = await readBody(req);
    if (body === null) {
      sendJson(res, 400, { success: false, reason: "invalid_body" });
      return;
    }
    const result = validateChallenge(secret, body, { scope: SCOPE });
    stats.verificationsAttempted++;
    if (result.success) {
      stats.verificationsSucceeded++;
    } else {
      stats.verificationsFailed++;
    }
    sendJson(res, 200, result);
    return;
  }

  if (pathname === "/api/stats") {
    sendJson(res, 200, { ...stats, uptime: Date.now() - stats.startedAt });
    return;
  }

  serveStatic(pathname, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`rootcap self-host server listening on http://localhost:${PORT}`);
  console.log(`  site: ${SITE_DIR}/  library: ${LIB_DIR}/  scope: "${SCOPE}"`);
});
