import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import { migrate } from "./migrate.ts";
import { seedFixture } from "./seed.ts";
import { documentScenario } from "./document-scenario.ts";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
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
  const s = await documentScenario(app, f.adminToken, f.unit);
  async function post(path: string, body: Record<string, unknown>) {
    const r = await app.inject({
      method: "POST",
      url: `/v1/documentos/${path}`,
      headers: { ...headers, "idempotency-key": randomUUID() },
      payload: { ...s.common, ...body },
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.json().id as string;
  }
  const request = () =>
    post("solicitacoes", { ...s.requestBody, protocolo: randomUUID() });
  const document = (id: string) =>
    post("versoes", {
      solicitacao_id: id,
      modelo_versao_id: s.modelVersion,
      versao_esperada: 0,
      campos: s.fields,
    });
  for (let i = 0; i < 1000; i++) await document(await request());
  const measurements = [];
  for (const mode of ["lista", "redacao", "aprovacao"]) {
    const times: number[] = [],
      counts: number[] = [];
    for (let i = 0; i < 110; i++) {
      let req: string | undefined, doc: string | undefined;
      if (mode !== "lista") req = await request();
      if (mode === "aprovacao") {
        doc = await document(req as string);
        await post("autorizacoes", {
          solicitacao_id: req,
          decisao: "permitida",
          valida_ate: "2099-12-31T23:59:59Z",
          evidencia: "Benchmark fictício",
        });
      }
      const q = queries,
        start = performance.now();
      if (mode === "lista") {
        const r = await app.inject({
          url: `/v1/documentos/versoes?unidade_id=${f.unit}&paciente_id=${s.patient}&limit=50`,
          headers,
        });
        assert.equal(r.statusCode, 200, r.body);
        assert.equal(r.json().items.length, 50);
        assert.equal(r.json().items[0].conteudo, undefined);
      } else if (mode === "redacao") await document(req as string);
      else await post("aprovacoes", { documento_versao_id: doc });
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
      sql_total_max: Math.max(...counts),
    });
  }
  const plans = await transaction(
    db,
    f.org,
    async (tx) =>
      (
        await tx.query(
          "EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) SELECT id,versao,aprovado,substituido FROM documento_versao_consulta WHERE organizacao_id=$1 AND unidade_id=$2 AND paciente_id=$3 ORDER BY id LIMIT 50",
          [f.org, f.unit, s.patient],
        )
      ).rows[0]["QUERY PLAN"],
  );
  const req = await request(),
    doc = await document(req);
  await post("autorizacoes", {
    solicitacao_id: req,
    decisao: "permitida",
    valida_ate: "2099-12-31T23:59:59Z",
    evidencia: "HTTP fictício",
  });
  const approval = await post("aprovacoes", { documento_versao_id: doc });
  const instant = (
    await admin.query(
      "SELECT criada_em::text instante FROM hvb.aprovacao_documento WHERE id=$1",
      [approval],
    )
  ).rows[0].instante;
  const address = await app.listen({ host: "127.0.0.1", port: 0 }),
    httpHeaders = {
      ...headers,
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
    },
    body = JSON.stringify({
      ...s.common,
      documento_versao_id: doc,
      destinatario_id: s.responsible,
      entregue_em: instant,
      canal: "registro_manual_dev",
      evidencia: "Registro fictício; sem envio externo",
      referencia: randomUUID(),
    });
  const first = await fetch(`${address}/v1/documentos/entregas`, {
      method: "POST",
      headers: httpHeaders,
      body,
    }),
    a = (await first.json()) as { id: string };
  const retry = await fetch(`${address}/v1/documentos/entregas`, {
      method: "POST",
      headers: httpHeaders,
      body,
    }),
    b = (await retry.json()) as { id: string; repetido: boolean };
  assert.equal(first.status, 200);
  assert.equal(retry.status, 200);
  assert.equal(a.id, b.id);
  assert.equal(b.repetido, true);
  const content = await fetch(
    `${address}/v1/documentos/conteudos?unidade_id=${f.unit}&documento_versao_id=${doc}`,
    { headers },
  );
  assert.equal(content.status, 200);
  const d = (
    (await content.json()) as {
      items: { conteudo: string; hash_conteudo: string }[];
    }
  ).items[0];
  assert.ok(d);
  assert.equal(
    createHash("sha256").update(d.conteudo).digest("hex"),
    d.hash_conteudo,
  );
  const integrity = (
    await admin.query(
      "SELECT (SELECT count(*)::int FROM hvb.execucao WHERE organizacao_id=$1) AS execucoes,(SELECT count(*)::int FROM hvb.item_conta WHERE organizacao_id=$1) AS cobrancas,(SELECT saldo_base FROM hvb.posicao_estoque WHERE id=$2) AS saldo_fisico,(SELECT count(*)::int FROM hvb.entrega_documento WHERE organizacao_id=$1) AS entregas",
      [f.org, s.position],
    )
  ).rows[0];
  assert.equal(integrity.execucoes, 0);
  assert.equal(integrity.cobrancas, 0);
  assert.equal(integrity.saldo_fisico, "20.000000");
  assert.equal(integrity.entregas, 1);
  const report = {
    executed_at: new Date().toISOString(),
    node: process.version,
    postgres: (await admin.query("SHOW server_version")).rows[0].server_version,
    synthetic_documents: 1000,
    fields_per_document: 3,
    mode: "Fastify inject com PostgreSQL local; um paciente; HTTP separado; sem SLA",
    measurements,
    plans,
    http_smoke: {
      delivery: first.status,
      retry: retry.status,
      same_id: true,
      content: content.status,
      sha256_verified: true,
    },
    integrity,
  };
  await writeFile(
    "docs/evidencias/benchmark-m6c.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    JSON.stringify(
      { measurements, http_smoke: report.http_smoke, integrity },
      null,
      2,
    ),
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
