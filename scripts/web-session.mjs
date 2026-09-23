import { randomBytes, randomUUID } from "node:crypto";

const cookieName = "hvb_pilot_session";
const idleMs = 15 * 60_000,
  lifetimeMs = 60 * 60_000;
export function createWebSessions(api, { now = Date.now } = {}) {
  const sessions = new Map(),
    attempts = new Map();
  function json(res, status, body) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
  }
  function setCookie(res, id, age = 3600) {
    // HTTP is supported exclusively on loopback in this pilot. TLS hosting is a separate step.
    res.setHeader(
      "Set-Cookie",
      `${cookieName}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}`,
    );
  }
  function remove(req, res) {
    const id = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    if (id) sessions.delete(id);
    setCookie(res, "", 0);
  }
  function get(req) {
    for (const [id, s] of sessions)
      if (s.expires <= now() || s.last + idleMs <= now()) sessions.delete(id);
    const id = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    const session = sessions.get(id);
    if (session) session.last = now();
    return session;
  }
  function allowed(req, res) {
    const host = req.headers.host || "";
    if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)) {
      json(res, 403, { erro: "host_local_obrigatorio" });
      return false;
    }
    if (
      req.headers["sec-fetch-site"] === "cross-site" ||
      (!["GET", "HEAD"].includes(req.method) &&
        req.headers.origin !== `http://${host}`)
    ) {
      json(res, 403, { erro: "origem_nao_permitida" });
      return false;
    }
    return true;
  }
  async function handle(req, res) {
    if (req.method === "DELETE") {
      remove(req, res);
      json(res, 200, { autenticado: false });
      return;
    }
    if (req.method === "GET") {
      const s = get(req);
      if (!s) {
        remove(req, res);
        json(res, 401, { erro: "sessao_expirada" });
        return;
      }
      json(res, 200, {
        autenticado: true,
        view_id: s.view,
        expira_em: new Date(s.expires).toISOString(),
      });
      return;
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST, DELETE");
      json(res, 405, { erro: "metodo_nao_permitido" });
      return;
    }
    const ip = req.socket.remoteAddress;
    for (const [key, value] of attempts)
      if (value.until <= now()) attempts.delete(key);
    const rate = attempts.get(ip) || { count: 0, until: now() + 15 * 60_000 };
    if (rate.count >= 10) {
      res.setHeader(
        "Retry-After",
        String(Math.ceil((rate.until - now()) / 1000)),
      );
      json(res, 429, { erro: "aguarde_antes_de_tentar_novamente" });
      return;
    }
    rate.count++;
    attempts.set(ip, rate);
    if (!req.headers["content-type"]?.startsWith("application/json")) {
      json(res, 415, { erro: "json_obrigatorio" });
      return;
    }
    let payload = "";
    for await (const chunk of req) {
      payload += chunk;
      if (Buffer.byteLength(payload) > 1024) {
        json(res, 413, { erro: "corpo_excessivo" });
        return;
      }
    }
    let token;
    try {
      token = JSON.parse(payload).token;
    } catch {
      /* invalid input */
    }
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
      json(res, 401, { erro: "credencial_invalida" });
      return;
    }
    let response, actor;
    try {
      response = await fetch(`${api}/v1/me`, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      actor = await response.json();
    } catch {
      json(res, 502, { erro: "api_local_indisponivel" });
      return;
    }
    if (!response.ok || !actor.usuario_id || !actor.organizacao_id) {
      json(res, response.status >= 500 ? 502 : 401, {
        erro: "credencial_invalida_ou_api_indisponivel",
      });
      return;
    }
    get(req); // purge expired sessions before enforcing capacity
    if (sessions.size >= 100) {
      json(res, 503, { erro: "limite_de_sessoes" });
      return;
    }
    remove(req, res); // rotate even if the browser already had a valid session
    const id = randomBytes(32).toString("hex"),
      expires = now() + lifetimeMs;
    const view = randomUUID();
    sessions.set(id, { token, view, expires, last: now() });
    attempts.delete(ip);
    setCookie(res, id);
    json(res, 200, {
      autenticado: true,
      view_id: view,
      expira_em: new Date(expires).toISOString(),
    });
  }
  return {
    allowed,
    handle,
    get,
    remove,
    json,
    clear: () => {
      sessions.clear();
      attempts.clear();
    },
  };
}
