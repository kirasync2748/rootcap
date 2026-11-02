import { createReadStream, existsSync, realpathSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createApiHandler } from "rootcap/server";

const secret = process.env.ROOTCAP_SECRET;
if (!secret || secret.length < 16) {
  console.error("ROOTCAP_SECRET must contain at least 16 characters.");
  process.exit(1);
}
const site = fileURLToPath(new URL("./dist", import.meta.url));
if (!existsSync(site)) {
  console.error("Build the demo first: npm run build --prefix demo");
  process.exit(1);
}
const root = realpathSync(site);
const api = createApiHandler({ secret, scope: "demo", demoSubmit: true });
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};
const inside = (file) => {
  const rel = relative(root, file);
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
};
const server = createServer(async (req, res) => {
  try {
    if (await api(req, res)) return;
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" });
      res.end();
      return;
    }
    const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (path === "/api" || path.startsWith("/api/")) {
      res.writeHead(404);
      res.end();
      return;
    }
    let file = resolve(root, "." + (path === "/" ? "/index.html" : path));
    if (!inside(file)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (existsSync(file) && !inside(realpathSync(file))) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!existsSync(file) || !statSync(file).isFile()) {
      if (extname(path)) {
        res.writeHead(404);
        res.end();
        return;
      }
      file = resolve(root, "index.html");
    }
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404);
      res.end();
      return;
    }
    if (!inside(file) || !inside(realpathSync(file))) {
      res.writeHead(403);
      res.end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    const stream = createReadStream(file);
    stream.on("error", () => res.destroy());
    stream.pipe(res);
  } catch (error) {
    if (res.headersSent) res.destroy();
    else {
      res.writeHead(error instanceof URIError ? 400 : 500);
      res.end();
    }
  }
});
server.listen(Number(process.env.PORT ?? 3001), "0.0.0.0", () => {
  console.log("rootcap demo listening on port " + server.address().port);
});
