import type { IncomingMessage, ServerResponse } from "node:http";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import {
  clearHostedCookie,
  createHostedSession,
  deriveHostedSessionKey,
  hostedCookie,
  openHostedSession,
  readHostedCookie,
} from "../scripts/hosted-session.ts";

type RequestWithBody = IncomingMessage & {
  body?: unknown;
};

type Injected = {
  statusCode: number;
  headers: Record<string, string | string[] | number | undefined>;
  body: string;
};

const attempts = new Map<string, { count: number; until: number }>();
let appPromise: ReturnType<typeof buildApp> | undefined;

function securityHeaders(res: ServerResponse): void {
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cache-Control", "no-store");
}

function json(
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>,
): void {
  securityHeaders(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function host(req: IncomingMessage): string {
  return (req.headers.host || "").split(":")[0]?.toLowerCase() ?? "";
}

function expectedOrigin(req: IncomingMessage): string | null {
  const currentHost = host(req);
  const customDev = currentHost === "hvb-sistema-dev.beskel.com.br";
  const vercelDev =
    currentHost.endsWith(".vercel.app") &&
    process.env.VERCEL_GIT_COMMIT_REF === "hvb-sistema-dev";
  if (!customDev && !vercelDev) return null;
  return `https://${currentHost}`;
}

function allowed(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = expectedOrigin(req);
  if (!origin) {
    json(res, 403, { erro: "host_dev_nao_permitido" });
    return false;
  }
  if (req.headers["sec-fetch-site"] === "cross-site") {
    json(res, 403, { erro: "origem_nao_permitida" });
    return false;
  }
  if (
    !["GET", "HEAD"].includes(req.method || "GET") &&
    req.headers.origin !== origin
  ) {
    json(res, 403, { erro: "origem_nao_permitida" });
    return false;
  }
  return true;
}

function sessionKey(): Buffer {
  const explicit = process.env.HVB_WEB_SESSION_SECRET;
  const database = process.env.DATABASE_URL;
  // DEV-only fallback: derive a domain-separated sealing key from the existing
  // private database URL. Production must supply HVB_WEB_SESSION_SECRET.
  const material =
    explicit ||
    (process.env.HVB_DATABASE_MODE === "remote-dev" ? database : undefined);
  return deriveHostedSessionKey(material || "");
}

async function app() {
  if (!appPromise) {
    if (
      process.env.HVB_DATABASE_MODE !== "remote-dev" ||
      process.env.HVB_DATABASE_TLS !== "verify-full" ||
      !["direct", "session", "transaction"].includes(
        process.env.HVB_DATABASE_CONNECTION || "",
      )
    )
      throw new Error("configuracao_dev_incompleta");
    const db = pool(process.env.DATABASE_URL ?? "", 3, {
      ...process.env,
      // Vercel marks deployments as production even when this application is
      // the isolated DEV surface. databaseConfig still receives DEV semantics.
      NODE_ENV: "development",
    });
    appPromise = buildApp(db, false).then(async (instance) => {
      await instance.ready();
      return instance;
    });
  }
  return appPromise;
}

function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded)
    return forwarded.split(",")[0]?.trim() || "unknown";
  return req.socket.remoteAddress || "unknown";
}

async function bodyBuffer(req: RequestWithBody, limit: number): Promise<Buffer> {
  if (req.body !== undefined) {
    const value =
      typeof req.body === "string" || Buffer.isBuffer(req.body)
        ? req.body
        : JSON.stringify(req.body);
    const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
    if (buffer.length > limit)
      throw Object.assign(new Error("corpo_excessivo"), { status: 413 });
    return buffer;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit)
      throw Object.assign(new Error("corpo_excessivo"), { status: 413 });
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function forwardedHeaders(
  req: IncomingMessage,
  token?: string,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (
      !value ||
      [
        "host",
        "content-length",
        "connection",
        "transfer-encoding",
        "authorization",
        "cookie",
        "x-hvb-view",
        "origin",
      ].includes(key)
    )
      continue;
    headers[key] = Array.isArray(value) ? value.join(", ") : value;
  }
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

async function injectApi(
  req: RequestWithBody,
  target: string,
  token?: string,
): Promise<Injected> {
  const instance = await app();
  const method = req.method || "GET";
  const payload = ["GET", "HEAD"].includes(method)
    ? undefined
    : await bodyBuffer(req, 512000);
  const response = await instance.inject({
    method,
    url: target,
    headers: forwardedHeaders(req, token),
    payload,
  });
  return {
    statusCode: response.statusCode,
    headers: response.headers as Record<
      string,
      string | string[] | number | undefined
    >,
    body: response.body,
  };
}

function relay(
  res: ServerResponse,
  response: Injected,
  method: string,
): void {
  securityHeaders(res);
  res.statusCode = response.statusCode;
  for (const [key, value] of Object.entries(response.headers)) {
    if (
      value === undefined ||
      [
        "content-length",
        "transfer-encoding",
        "connection",
        "set-cookie",
        "cache-control",
      ].includes(key.toLowerCase())
    )
      continue;
    res.setHeader(key, value);
  }
  securityHeaders(res);
  res.end(method === "HEAD" ? undefined : response.body);
}

function targetFromRewrite(req: IncomingMessage): string | null {
  const url = new URL(req.url || "/", "https://hvb-sistema-dev.beskel.com.br");
  const path = url.searchParams.get("hvb_path");
  if (
    !path ||
    !(
      path === "/session" ||
      path === "/health" ||
      path === "/ready" ||
      path.startsWith("/v1/")
    )
  )
    return null;
  url.searchParams.delete("hvb_path");
  const query = url.searchParams.toString();
  return `${path}${query ? `?${query}` : ""}`;
}

async function sessionHandler(
  req: RequestWithBody,
  res: ServerResponse,
): Promise<void> {
  const key = sessionKey();
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", clearHostedCookie());
    json(res, 200, { autenticado: false });
    return;
  }

  if (req.method === "GET") {
    const current = openHostedSession(
      readHostedCookie(req.headers.cookie),
      key,
    );
    if (!current) {
      res.setHeader("Set-Cookie", clearHostedCookie());
      json(res, 401, { erro: "sessao_expirada" });
      return;
    }
    current.last = Date.now();
    res.setHeader("Set-Cookie", hostedCookie(current, key));
    json(res, 200, {
      autenticado: true,
      view_id: current.view,
      expira_em: new Date(current.expires).toISOString(),
    });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, DELETE");
    json(res, 405, { erro: "metodo_nao_permitido" });
    return;
  }

  const now = Date.now();
  for (const [ip, value] of attempts)
    if (value.until <= now) attempts.delete(ip);
  const ip = clientIp(req);
  const rate = attempts.get(ip) || {
    count: 0,
    until: now + 15 * 60_000,
  };
  if (rate.count >= 10) {
    res.setHeader(
      "Retry-After",
      String(Math.max(1, Math.ceil((rate.until - now) / 1000))),
    );
    json(res, 429, { erro: "aguarde_antes_de_tentar_novamente" });
    return;
  }
  rate.count += 1;
  attempts.set(ip, rate);

  if (!req.headers["content-type"]?.startsWith("application/json")) {
    json(res, 415, { erro: "json_obrigatorio" });
    return;
  }

  let token: unknown;
  try {
    const payload = await bodyBuffer(req, 1024);
    token = JSON.parse(payload.toString("utf8")).token;
  } catch (error) {
    const status = (error as { status?: number }).status;
    json(res, status === 413 ? 413 : 401, {
      erro: status === 413 ? "corpo_excessivo" : "credencial_invalida",
    });
    return;
  }

  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    json(res, 401, { erro: "credencial_invalida" });
    return;
  }

  let identity: Injected;
  try {
    const instance = await app();
    const response = await instance.inject({
      method: "GET",
      url: "/v1/me",
      headers: { authorization: `Bearer ${token}` },
    });
    identity = {
      statusCode: response.statusCode,
      headers: response.headers as Record<
        string,
        string | string[] | number | undefined
      >,
      body: response.body,
    };
  } catch {
    json(res, 502, { erro: "api_dev_indisponivel" });
    return;
  }

  let actor: Record<string, unknown> | undefined;
  try {
    actor = JSON.parse(identity.body) as Record<string, unknown>;
  } catch {
    actor = undefined;
  }
  if (
    identity.statusCode !== 200 ||
    typeof actor?.usuario_id !== "string" ||
    typeof actor?.organizacao_id !== "string"
  ) {
    json(res, identity.statusCode >= 500 ? 502 : 401, {
      erro: "credencial_invalida_ou_api_indisponivel",
    });
    return;
  }

  const session = createHostedSession(token);
  attempts.delete(ip);
  res.setHeader("Set-Cookie", hostedCookie(session, key));
  json(res, 200, {
    autenticado: true,
    view_id: session.view,
    expira_em: new Date(session.expires).toISOString(),
  });
}

async function authenticatedProxy(
  req: RequestWithBody,
  res: ServerResponse,
  target: string,
): Promise<void> {
  const key = sessionKey();
  const session = openHostedSession(readHostedCookie(req.headers.cookie), key);
  if (!session) {
    res.setHeader("Set-Cookie", clearHostedCookie());
    json(res, 401, { erro: "sessao_expirada" });
    return;
  }
  if (req.headers["x-hvb-view"] !== session.view) {
    res.setHeader("X-HVB-Session-Reset", "1");
    res.setHeader("Set-Cookie", clearHostedCookie());
    json(res, 409, { erro: "sessao_alterada_entre_novamente" });
    return;
  }

  let response: Injected;
  try {
    response = await injectApi(req, target, session.token);
  } catch (error) {
    const status = (error as { status?: number }).status;
    json(res, status === 413 ? 413 : 502, {
      erro: status === 413 ? "corpo_excessivo" : "api_dev_indisponivel",
    });
    return;
  }

  if (response.statusCode === 401) {
    res.setHeader("Set-Cookie", clearHostedCookie());
  } else {
    session.last = Date.now();
    res.setHeader("Set-Cookie", hostedCookie(session, key));
  }
  relay(res, response, req.method || "GET");
}

export default async function handler(
  req: RequestWithBody,
  res: ServerResponse,
): Promise<void> {
  securityHeaders(res);
  if (!allowed(req, res)) return;

  const target = targetFromRewrite(req);
  if (!target) {
    json(res, 404, { erro: "rota_nao_encontrada" });
    return;
  }

  try {
    if (target === "/health") {
      json(res, 200, { status: "ok" });
      return;
    }
    if (target === "/session") {
      await sessionHandler(req, res);
      return;
    }
    if (target === "/ready") {
      const response = await injectApi(req, target);
      relay(res, response, req.method || "GET");
      return;
    }
    await authenticatedProxy(req, res, target);
  } catch {
    json(res, 503, { erro: "configuracao_dev_indisponivel" });
  }
}
