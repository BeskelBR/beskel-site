import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { createFrontendServer } from "../scripts/frontend.mjs";
import { loginWeb } from "./web-session-helper.mjs";

async function setup(t) {
  let time = Date.now(),
    revoked = false;
  const seen = [];
  const api = createServer((req, res) => {
    seen.push({
      authorization: req.headers.authorization,
      cookie: req.headers.cookie,
    });
    res.writeHead(
      revoked || req.headers.authorization !== `Bearer ${"a".repeat(64)}`
        ? 401
        : 200,
      { "Content-Type": "application/json" },
    );
    res.end(
      JSON.stringify({
        usuario_id: "usuario-sintetico",
        organizacao_id: "org-sintetica",
      }),
    );
  });
  const listen = (s) => new Promise((done) => s.listen(0, "127.0.0.1", done));
  await listen(api);
  const server = createFrontendServer(
    `http://127.0.0.1:${api.address().port}`,
    { now: () => time },
  );
  await listen(server);
  t.after(async () => {
    for (const s of [server, api])
      await new Promise((done) => {
        s.closeAllConnections();
        s.close(done);
      });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    seen,
    advance: (ms) => {
      time += ms;
    },
    revoke: () => {
      revoked = true;
    },
    login: () => loginWeb(base, "a".repeat(64)),
  };
}
test("sessão: cookie protegido, credencial fora da resposta e logout invalida replay", async (t) => {
  const s = await setup(t),
    login = await s.login();
  assert.match(
    login.response.headers.get("set-cookie"),
    /HttpOnly; SameSite=Strict/,
  );
  assert.ok(!login.cookie.includes("a".repeat(64)));
  assert.ok(!JSON.stringify(login.body).includes("a".repeat(64)));
  const me = await login.fetcher(`${s.base}/v1/me`, {
    headers: { Authorization: `Bearer ${"b".repeat(64)}` },
  });
  assert.equal(me.status, 200);
  assert.equal(s.seen.at(-1).authorization, `Bearer ${"a".repeat(64)}`);
  assert.equal(s.seen.at(-1).cookie, undefined);
  assert.equal(
    (await login.fetcher(`${s.base}/session`, { method: "DELETE" })).status,
    200,
  );
  assert.equal((await login.fetcher(`${s.base}/v1/me`)).status, 401);
  assert.equal(
    (
      await fetch(`${s.base}/v1/me`, {
        headers: { Authorization: `Bearer ${"a".repeat(64)}` },
      })
    ).status,
    401,
  );
});
test("sessão: origem/host e contexto de outra aba são recusados antes de chamar API", async (t) => {
  const s = await setup(t),
    login = await s.login(),
    before = s.seen.length;
  for (const headers of [
    { ...login.headers, Origin: "http://outro.local" },
    { Cookie: login.cookie, "X-HVB-View": login.body.view_id },
  ])
    assert.equal(
      (
        await fetch(`${s.base}/v1/pacientes`, {
          method: "POST",
          headers,
          body: "{}",
        })
      ).status,
      403,
    );
  const badHost = await new Promise((done, reject) => {
    const req = request(
      `${s.base}/v1/me`,
      { headers: { ...login.headers, Host: "host-invasor.test:3200" } },
      (res) => {
        res.resume();
        res.on("end", () => done(res.statusCode));
      },
    );
    req.on("error", reject);
    req.end();
  });
  assert.equal(badHost, 403);
  assert.equal(
    (
      await fetch(`${s.base}/v1/me`, {
        headers: { ...login.headers, "Sec-Fetch-Site": "cross-site" },
      })
    ).status,
    403,
  );
  const changed = await fetch(`${s.base}/v1/me`, {
    headers: { ...login.headers, "X-HVB-View": "outra-sessao" },
  });
  assert.equal(changed.status, 409);
  assert.equal(changed.headers.get("x-hvb-session-reset"), "1");
  assert.equal(s.seen.length, before);
  assert.equal((await login.fetcher(`${s.base}/v1/me`)).status, 200);
});
test("sessão: inatividade, limite absoluto e revogação do backend", async (t) => {
  const s = await setup(t);
  let login = await s.login();
  s.advance(15 * 60_000);
  assert.equal((await login.fetcher(`${s.base}/v1/me`)).status, 401);
  login = await s.login();
  for (let i = 0; i < 5; i++) {
    s.advance(10 * 60_000);
    assert.equal((await login.fetcher(`${s.base}/v1/me`)).status, 200);
  }
  s.advance(10 * 60_000);
  assert.equal((await login.fetcher(`${s.base}/v1/me`)).status, 401);
  login = await s.login();
  s.revoke();
  const revoked = await login.fetcher(`${s.base}/v1/me`);
  assert.equal(revoked.status, 401);
  assert.match(revoked.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal((await login.fetcher(`${s.base}/session`)).status, 401);
});
test("sessão: troca de entrada rotaciona cookie e tentativas inválidas têm limite", async (t) => {
  const s = await setup(t),
    old = await s.login();
  const next = await old.fetcher(`${s.base}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "a".repeat(64) }),
  });
  assert.equal(next.status, 200);
  assert.notEqual(next.headers.get("set-cookie").split(";")[0], old.cookie);
  assert.equal((await old.fetcher(`${s.base}/v1/me`)).status, 401);
  for (let i = 0; i < 10; i++)
    await assert.rejects(loginWeb(s.base, "b".repeat(64)), { status: 401 });
  await assert.rejects(s.login(), { status: 429 });
  s.advance(15 * 60_000);
  await s.login();
});
test("sessão: destino externo e URL com credencial são recusados", () => {
  for (const url of [
    "https://api.exemplo.test",
    "http://127.0.0.1:3100/rota",
    "http://usuario:senha@localhost:3100",
  ])
    assert.throws(() => createFrontendServer(url), /loopback/);
});
