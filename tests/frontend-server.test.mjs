import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { createFrontendServer } from "../scripts/frontend.mjs";
let server, api, origin;
const requests = [];
const listen = (s) => new Promise((done) => s.listen(0, "127.0.0.1", done));
const close = (s) =>
  new Promise((done) => {
    s.closeAllConnections();
    s.close(done);
  });
before(async () => {
  api = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requests.push({
      url: req.url,
      authorization: req.headers.authorization,
      body: Buffer.concat(chunks).toString(),
    });
    res.writeHead(req.url === "/v1/negado" ? 403 : 200, {
      "Content-Type": "application/json",
      "Cache-Control": "public",
    });
    res.end(JSON.stringify({ ok: true }));
  });
  await listen(api);
  server = createFrontendServer(`http://127.0.0.1:${api.address().port}`);
  await listen(server);
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await close(server);
  if (api) await close(api);
});
test("serve a interface existente e assets com no-store; HEAD não entrega corpo", async () => {
  const index = await fetch(origin);
  assert.equal(index.status, 200);
  assert.match(await index.text(), /HVB/);
  const asset = await fetch(`${origin}/assets/system.js`);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get("content-type"), /javascript/);
  assert.equal(asset.headers.get("cache-control"), "no-store");
  const head = await fetch(origin, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});
test("não expõe arquivos privados, fonte do servidor, caminhos arbitrários ou traversal", async () => {
  for (const path of [
    "/.env",
    "/.local/dev-access.json",
    "/package.json",
    "/scripts/frontend.mjs",
    "/assets/%2e%2e/.env",
    "/assets/..%5c.env",
    "/assets/.env",
    "/.git/config",
  ]) {
    const r = await fetch(`${origin}${path}`);
    assert.equal(r.status, 404, path);
    assert.equal(await r.text(), "Not found");
  }
  assert.equal(
    (await fetch(origin, { method: "POST", body: "x" })).status,
    405,
  );
  const malformed = await new Promise((done, reject) => {
    const r = request(`${origin}/%E0%A4%A`, (res) => {
      res.resume();
      res.on("end", () => done(res.statusCode));
    });
    r.on("error", reject);
    r.end();
  });
  assert.equal(malformed, 400);
  assert.equal((await fetch(origin)).status, 200);
});
test("proxy preserva identidade, conteúdo, query e recusa; limita corpo", async () => {
  const r = await fetch(`${origin}/v1/pacientes?limit=1`, {
    method: "POST",
    headers: {
      authorization: "Bearer TESTE_FICTICIO",
      "Content-Type": "application/json",
    },
    body: '{"nome":"Paciente fictício"}',
  });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.deepEqual(requests.at(-1), {
    url: "/v1/pacientes?limit=1",
    authorization: "Bearer TESTE_FICTICIO",
    body: '{"nome":"Paciente fictício"}',
  });
  assert.equal((await fetch(`${origin}/v1/negado`)).status, 403);
  assert.equal((await fetch(`${origin}/ready`)).status, 200);
  const before = requests.length;
  assert.equal(
    (
      await fetch(`${origin}/v1/grande`, {
        method: "POST",
        body: "x".repeat(512001),
      })
    ).status,
    413,
  );
  assert.equal(requests.length, before);
});
