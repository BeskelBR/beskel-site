import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import { migrate } from "./migrate.ts";
import { seedFixture } from "./seed.ts";
import { preventiveScenario } from "./preventive-scenario.ts";
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
  const s = await preventiveScenario(app, f.adminToken, f.unit);
  async function post(path: string, body: Record<string, unknown>) {
    const r = await app.inject({
      method: "POST",
      url: `/v1/protocolos/${path}`,
      headers: { ...headers, "idempotency-key": randomUUID() },
      payload: { ...s.common, ...body },
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.json().id as string;
  }
  // Two enrollments of a fictional daily structure; every occurrence remains a plan.
  const version = await post("versoes", {
    ...s.versionBody,
    versao: 2,
    etapas: [{ ...s.versionBody.etapas[1], intervalo: 1 }],
  });
  await post("aprovacoes", { protocolo_versao_id: version });
  const stage = (
    await admin.query(
      "SELECT id FROM hvb.etapa_protocolo WHERE protocolo_versao_id=$1",
      [version],
    )
  ).rows[0].id as string;
  const enrollments: string[] = [];
  for (let i = 0; i < 2; i++)
    enrollments.push(
      await post("adesoes", {
        paciente_id: s.patient,
        protocolo_versao_id: version,
        inicio_data: "2024-01-01",
        referencia: randomUUID(),
      }),
    );
  const occurrenceBody = (p: string, seq: number) => ({
    protocolo_paciente_id: p,
    etapa_id: stage,
    sequencia: seq,
    prevista_data: new Date(Date.UTC(2024, 0, seq)).toISOString().slice(0, 10),
  });
  const occurrences: string[] = [];
  for (const p of enrollments)
    for (let i = 1; i <= 500; i++)
      occurrences.push(await post("ocorrencias", occurrenceBody(p, i)));
  const applicationBody = (occurrence: string) => ({
    ocorrencia_id: occurrence,
    origem: "externa",
    profissional_informado: "Profissional fictício",
    ocorrida_em: "2026-09-01T12:00:00Z",
    referencia: randomUUID(),
    lote_declarado: "Fictício",
    fabricante_declarado: "Fictício",
    evidencia: "Benchmark fictício",
  });
  const measurements = [];
  for (const mode of ["lista", "ocorrencia", "aplicacao"]) {
    const times: number[] = [],
      counts: number[] = [];
    for (let i = 0; i < 110; i++) {
      const q = queries,
        start = performance.now();
      if (mode === "lista") {
        const r = await app.inject({
          url: `/v1/protocolos/ocorrencias?unidade_id=${f.unit}&paciente_id=${s.patient}&limit=50`,
          headers,
        });
        assert.equal(r.statusCode, 200, r.body);
        assert.equal(r.json().items.length, 50);
      } else if (mode === "ocorrencia")
        await post(
          "ocorrencias",
          occurrenceBody(enrollments[0] as string, 501 + i),
        );
      else await post("aplicacoes", applicationBody(occurrences[i] as string));
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
          "EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) SELECT id,prevista_data,situacao FROM ocorrencia_preventiva_consulta WHERE organizacao_id=$1 AND unidade_id=$2 AND paciente_id=$3 ORDER BY id LIMIT 50",
          [f.org, f.unit, s.patient],
        )
      ).rows[0]["QUERY PLAN"],
  );
  const address = await app.listen({ host: "127.0.0.1", port: 0 }),
    httpHeaders = {
      ...headers,
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
    },
    body = JSON.stringify({
      ...s.common,
      ...applicationBody(occurrences[110] as string),
    });
  const first = await fetch(`${address}/v1/protocolos/aplicacoes`, {
      method: "POST",
      headers: httpHeaders,
      body,
    }),
    a = (await first.json()) as { id: string };
  const second = await fetch(`${address}/v1/protocolos/aplicacoes`, {
      method: "POST",
      headers: httpHeaders,
      body,
    }),
    b = (await second.json()) as { id: string; repetido: boolean };
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(a.id, b.id);
  assert.equal(b.repetido, true);
  const integrity = (
    await admin.query(
      "SELECT (SELECT count(*)::int FROM hvb.execucao WHERE organizacao_id=$1) AS execucoes,(SELECT count(*)::int FROM hvb.item_conta WHERE organizacao_id=$1) AS cobrancas,(SELECT saldo_base FROM hvb.posicao_estoque WHERE id=$2) AS saldo_fisico,(SELECT count(*)::int FROM hvb.aplicacao_preventiva WHERE organizacao_id=$1) AS aplicacoes",
      [f.org, s.position],
    )
  ).rows[0];
  assert.equal(integrity.execucoes, 0);
  assert.equal(integrity.cobrancas, 0);
  assert.equal(integrity.saldo_fisico, "20.000000");
  assert.equal(integrity.aplicacoes, 111);
  const report = {
    executed_at: new Date().toISOString(),
    node: process.version,
    postgres: (await admin.query("SHOW server_version")).rows[0].server_version,
    synthetic_occurrences: 1000,
    mode: "Fastify inject com PostgreSQL local; um paciente e duas adesões; HTTP separado; sem SLA",
    measurements,
    plans,
    http_smoke: { status: first.status, retry: second.status, same_id: true },
    integrity,
  };
  await writeFile(
    "docs/evidencias/benchmark-m6b.json",
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
