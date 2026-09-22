import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = normalize(fileURLToPath(new URL("../", import.meta.url)));
const port = Number(process.env.HVB_FRONTEND_PORT || 3200);
const apiBase = (process.env.HVB_API_URL || "http://127.0.0.1:3100").replace(/\/$/, "");

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
};

function securityHeaders(res) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cache-Control", "no-store");
}

async function proxy(req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value || ["host", "content-length", "connection"].includes(key)) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const target = `${apiBase}${req.url}`;
  try {
    const response = await fetch(target, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method || "GET") ? undefined : body,
      redirect: "manual",
    });
    securityHeaders(res);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (!["content-encoding", "content-length", "transfer-encoding", "connection"].includes(key)) {
        res.setHeader(key, value);
      }
    });
    const payload = Buffer.from(await response.arrayBuffer());
    res.end(payload);
  } catch {
    securityHeaders(res);
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ erro: "api_local_indisponivel" }));
  }
}

async function staticFile(req, res) {
  const rawPath = decodeURIComponent(new URL(req.url || "/", "http://local").pathname);
  const requested = rawPath === "/" ? "/index.html" : rawPath;
  const safePath = normalize(join(root, requested));
  if (!safePath.startsWith(root)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }
  let filePath = safePath;
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, "index.html");
    const content = await readFile(filePath);
    securityHeaders(res);
    res.statusCode = 200;
    res.setHeader("Content-Type", types[extname(filePath)] || "application/octet-stream");
    res.end(content);
  } catch {
    securityHeaders(res);
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  const path = new URL(req.url || "/", "http://local").pathname;
  if (path === "/health" || path === "/ready" || path.startsWith("/v1/")) {
    await proxy(req, res);
    return;
  }
  await staticFile(req, res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`HVB frontend: http://127.0.0.1:${port}`);
  console.log(`Proxy API: ${apiBase}`);
});
