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

import { createReadStream, existsSync, statSync, realpathSync } from "node:fs";
import http from "node:http";
import { extname, join, resolve, relative, isAbsolute, sep } from "node:path";
import { pathToFileURL } from "node:url";

const PORT = Number(process.env.PORT) || 3000;
const SITE_DIR = resolve(process.env.SITE_DIR || "site");
const LIB_DIR = resolve(process.env.LIB_DIR || "dist");
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

if (!existsSync(join(LIB_DIR, "server", "index.js"))) {
  console.error(
    `Error: ${join(LIB_DIR, "server", "index.js")} not found.\n` +
      "Build the library first: npm run build:lib",
  );
  process.exit(1);
}

const { createApiHandler } = await import(pathToFileURL(join(LIB_DIR, "server", "index.js")).href);
const api = createApiHandler({ secret, scope: SCOPE, demoSubmit: true });

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

function serveStatic(pathname, req, res) {
  const inside = (root, path) => {
    const rel = relative(root, path);
    return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
  };
  const requested = resolve(SITE_DIR, "." + pathname);
  if (!inside(SITE_DIR, requested)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  let filePath = requested;
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    if (extname(pathname)) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }
    filePath = join(SITE_DIR, "index.html");
  }
  if (!existsSync(filePath)) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  if (!inside(realpathSync(SITE_DIR), realpathSync(filePath))) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[extname(filePath)] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  const stream = createReadStream(filePath);
  stream.on("error", () => res.destroy());
  stream.pipe(res);
}

const server = http.createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    sendJson(res, 400, { error: "invalid_url" });
    return;
  }
  try {
    if (await api(req, res)) return;
    if (pathname.startsWith("/api/")) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET, HEAD");
      sendJson(res, 405, { error: "method_not_allowed" });
      return;
    }
    serveStatic(pathname, req, res);
  } catch {
    if (res.headersSent) res.destroy();
    else sendJson(res, 500, { error: "server_error" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`rootcap self-host server listening on http://localhost:${PORT}`);
  console.log(`  site: ${SITE_DIR}/  library: ${LIB_DIR}/  scope: "${SCOPE}"`);
});
