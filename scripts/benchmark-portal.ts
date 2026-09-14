import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import { migrate } from "./migrate.ts";
import { seedFixture } from "./seed.ts";
import { portalScenario } from "./portal-scenario.ts";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { digest } from "../src/domain/core.ts";
const url = process.env.TEST_MIGRATION_DATABASE_URL ?? "";
assert.equal(new URL(url).pathname, "/hvb_sistema_test");
await migrate(url);
const f = await seedFixture(url),
  admin = pool(url, 1),
  db = pool(process.env.TEST_DATABASE_URL ?? "", 5);
let queries = 0;
db.on("connect", (client) => {
  const original = client.query.bind(client);
  client.query = ((...args: unknown[]) => {
    queries++;
    return Reflect.apply(original, client, args);
  }) as typeof client.query;
});
const app = await buildApp(db),
  headers = { authorization: `Bearer ${f.adminToken}` };
try {
  const s = await portalScenario(app, f.adminToken, f.unit),
    token = randomBytes(32).toString("hex"),
    portalHeaders = { authorization: `Bearer ${token}` };
  await admin.query(
    "INSERT INTO hvb.credencial_portal(id,organizacao_id,conta_portal_id,token_hash,expira_em) VALUES($1,$2,$3,$4,now()+interval '1 day')",
    [randomUUID(), f.org, s.account, digest(token)],
  );
  async function post(path: string, body: Record<string, unknown>) {
    const r = await app.inject({
      method: "POST",
      url: `/v1/comunicacao/${path}`,
      headers: { ...headers, "idempotency-key": randomUUID() },
      payload: { ...s.common, ...body },
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.json().id as string;
  }
  const message = () =>
    post("mensagens", { ...s.body, referencia: randomUUID() });
  async function deliver(id: string) {
    const t = await post("tentativas", {
      mensagem_id: id,
      sequencia_esperada: 0,
    });
    await post("retornos", {
      tentativa_id: t,
      sequencia_esperada: 0,
      estado: "entregue",
      ocorrido_em: new Date().toISOString(),
      referencia: randomUUID(),
      evidencia: "Simulação fictícia local",
    });
  }
  for (let i = 0; i < 1000; i++) await deliver(await message());
  const measurements = [];
  for (const mode of ["caixa", "preparar", "tentativa"]) {
    const times: number[] = [],
      counts: number[] = [];
    for (let i = 0; i < 110; i++) {
      const id = mode === "tentativa" ? await message() : undefined,
        q = queries,
        start = performance.now();
      if (mode === "caixa") {
        const r = await app.inject({
          url: "/v1/portal/caixa?limit=50",
          headers: portalHeaders,
        });
        assert.equal(r.statusCode, 200, r.body);
        assert.equal(r.json().items.length, 50);
      } else if (mode === "preparar") await message();
      else await post("tentativas", { mensagem_id: id, sequencia_esperada: 0 });
      if (i >= 10) {
        times.push(performance.now() - start);
        counts.push(queries - q);
      }
    }
    times.sort((a, b) => a - b);
    measurements.push({
      mode,
      samples: 100,
      p50_ms: Number(times[49]?.toFixed(2)),
      p95_ms: Number(times[94]?.toFixed(2)),
      sql_statements: [...new Set(counts)],
    });
  }
  const address = await app.listen({ host: "127.0.0.1", port: 0 }),
    httpHeaders = {
      ...headers,
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
    },
    body = JSON.stringify({ ...s.common, ...s.body, referencia: randomUUID() });
  const first = await fetch(`${address}/v1/comunicacao/mensagens`, {
      method: "POST",
      headers: httpHeaders,
      body,
    }),
    a = (await first.json()) as { id: string };
  const retry = await fetch(`${address}/v1/comunicacao/mensagens`, {
      method: "POST",
      headers: httpHeaders,
      body,
    }),
    b = (await retry.json()) as { id: string; repetido: boolean };
  assert.equal(first.status, 200);
  assert.equal(retry.status, 200);
  assert.equal(a.id, b.id);
  assert.equal(b.repetido, true);
  await deliver(a.id);
  const content = await fetch(`${address}/v1/portal/mensagens/${a.id}`, {
    headers: portalHeaders,
  });
  assert.equal(content.status, 200);
  const value = (await content.json()) as {
    documentos: { id: string; conteudo: string; hash_conteudo: string }[];
  };
  const d = value.documentos[0];
  assert.ok(d);
  assert.equal(d.id, s.document);
  assert.equal(
    createHash("sha256").update(d.conteudo).digest("hex"),
    d.hash_conteudo,
  );
  const integrity = (
    await admin.query(
      "SELECT (SELECT count(*)::int FROM hvb.execucao WHERE organizacao_id=$1) execucoes,(SELECT count(*)::int FROM hvb.item_conta WHERE organizacao_id=$1) cobrancas,(SELECT saldo_base FROM hvb.posicao_estoque WHERE id=$2) saldo_fisico,(SELECT count(*)::int FROM hvb.entrega_documento WHERE organizacao_id=$1) entregas_documentais",
      [f.org, s.position],
    )
  ).rows[0];
  assert.equal(integrity.execucoes, 0);
  assert.equal(integrity.cobrancas, 0);
  assert.equal(integrity.saldo_fisico, "20.000000");
  assert.equal(integrity.entregas_documentais, 0);
  const plans = await transaction(
    db,
    f.org,
    async (tx) =>
      (
        await tx.query(
          "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id,paciente_id,finalidade,titulo,situacao,criada_em FROM mensagem_portal_consulta WHERE conta_portal_id=$1 AND acesso_vigente AND situacao IN ('entregue','lido') ORDER BY id LIMIT 50",
          [s.account],
        )
      ).rows[0]["QUERY PLAN"],
  );
  const report = {
    plans,
    executed_at: new Date().toISOString(),
    node: process.version,
    postgres: (await admin.query("SHOW server_version")).rows[0].server_version,
    synthetic_messages: 1000,
    mode: "Fastify inject e PostgreSQL local; um responsável, um documento por mensagem; HTTP separado; sem SLA",
    measurements,
    http_smoke: {
      create: first.status,
      retry: retry.status,
      same_id: true,
      portal_content: content.status,
      sha256_verified: true,
    },
    integrity,
  };
  await writeFile(
    "docs/evidencias/benchmark-m6e.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
