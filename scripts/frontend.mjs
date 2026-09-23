import { createServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { extname, join, normalize, relative, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = normalize(fileURLToPath(new URL("../", import.meta.url)));
const port = Number(process.env.HVB_FRONTEND_PORT || 3200);
const apiBase = (process.env.HVB_API_URL || "http://127.0.0.1:3100").replace(
  /\/$/,
  "",
);

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

async function proxy(req, res, api) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 512000) {
      securityHeaders(res);
      res.statusCode = 413;
      res.end();
      return;
    }
    chunks.push(chunk);
  }
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (
      !value ||
      ["host", "content-length", "connection", "transfer-encoding"].includes(
        key,
      )
    )
      continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const url = new URL(req.url || "/", "http://local");
  const target = `${api}${url.pathname}${url.search}`;
  try {
    const response = await fetch(target, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method || "GET") ? undefined : body,
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    securityHeaders(res);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (
        ![
          "content-encoding",
          "content-length",
          "transfer-encoding",
          "connection",
        ].includes(key)
      ) {
        res.setHeader(key, value);
      }
    });
    securityHeaders(res);
    const payload = Buffer.from(await response.arrayBuffer());
    res.end(req.method === "HEAD" ? undefined : payload);
  } catch {
    securityHeaders(res);
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ erro: "api_local_indisponivel" }));
  }
}

async function staticFile(req, res) {
  securityHeaders(res);
  if (!["GET", "HEAD"].includes(req.method)) {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.end();
    return;
  }
  let rawPath;
  try {
    rawPath = decodeURIComponent(
      new URL(req.url || "/", "http://local").pathname,
    );
  } catch {
    res.statusCode = 400;
    res.end("Invalid path");
    return;
  }
  const requested = rawPath === "/" ? "/index.html" : rawPath;
  // Never serve the repository itself: .env/.local/source/database stay private.
  if (
    !["/index.html", "/robots.txt"].includes(requested) &&
    !/^\/assets\/[a-zA-Z0-9][a-zA-Z0-9._-]*\.(css|js|svg|webp|png)$/.test(
      requested,
    )
  ) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  try {
    const filePath = await realpath(join(root, requested));
    const publicRoot = await realpath(
      requested.startsWith("/assets/") ? join(root, "assets") : root,
    );
    const rel = relative(publicRoot, filePath);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    const content = await readFile(filePath);
    securityHeaders(res);
    res.statusCode = 200;
    res.setHeader(
      "Content-Type",
      types[extname(filePath)] || "application/octet-stream",
    );
    res.end(req.method === "HEAD" ? undefined : content);
  } catch {
    securityHeaders(res);
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not found");
  }
}

export function createFrontendServer(api = apiBase) {
  return createServer(async (req, res) => {
    securityHeaders(res);
    try {
      const path = new URL(req.url || "/", "http://local").pathname;
      if (path === "/health" || path === "/ready" || path.startsWith("/v1/")) {
        await proxy(req, res, api);
        return;
      }
      await staticFile(req, res);
    } catch {
      res.statusCode = 400;
      res.end("Invalid request");
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  createFrontendServer().listen(port, "127.0.0.1", () => {
    console.log(`HVB frontend: http://127.0.0.1:${port}`);
  });
