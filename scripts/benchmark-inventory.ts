import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { seedFixture } from "./seed.ts";
import { migrate } from "./migrate.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { buildApp } from "../src/api/app.ts";
const url = process.env.TEST_MIGRATION_DATABASE_URL ?? "";
assert.equal(new URL(url).pathname, "/hvb_sistema_test");
await migrate(url);
const f = await seedFixture(url);
const admin = pool(url, 1),
  db = pool(process.env.TEST_DATABASE_URL ?? "", 5);
let queries = 0,
  functional = 0;
db.on("connect", (client) => {
  const original = client.query.bind(client);
  client.query = ((...args: unknown[]) => {
    queries++;
    const sql = typeof args[0] === "string" ? args[0] : "";
    if (!/^(BEGIN|COMMIT|ROLLBACK|SELECT set_config)/.test(sql)) functional++;
    return Reflect.apply(original, client, args);
  }) as typeof client.query;
});
const app = await buildApp(db);
const headers = { authorization: `Bearer ${f.adminToken}` };
async function post(path: string, body: unknown) {
  const r = await app.inject({
    method: "POST",
    url: `/v1${path}`,
    headers: { ...headers, "idempotency-key": randomUUID() },
    payload: body as Record<string, unknown>,
  });
  assert.equal(r.statusCode, 200, r.body);
  return r.json().id as string;
}
try {
  const unit = await post("/estoque/unidades", {
    simbolo: "UN-FICTICIA-BENCH",
    dimensao: "contagem",
    fator_referencia: "1",
  });
  const product = await post("/estoque/produtos", {
    nome: "Produto Fictício Benchmark",
    unidade_base_id: unit,
    finalidade: "Benchmark DEV",
  });
  const presentation = await post("/estoque/apresentacoes", {
    produto_id: product,
    codigo: "FICTICIO-10",
    versao: 1,
    unidade_conteudo_id: unit,
    quantidade_conteudo: "10",
    fator_unidade_base: "10",
  });
  const lot = await post("/estoque/lotes", {
    apresentacao_id: presentation,
    fabricante: "Fictício",
    codigo: "TEST",
    situacao_validade: "isenta",
    custo_base: "1.25",
  });
  const custody = await post("/estoque/custodias", { tipo: "hospital" });
  // Bulk synthetic identity fixtures; all stock quantities still enter through commands/ledger.
  await admin.query(
    "INSERT INTO hvb.local(id,organizacao_id,unidade_id,nome,tipo,capacidade) SELECT gen_random_uuid(),$1,$2,'Armario Ficticio Benchmark '||n,'armario',0 FROM generate_series(1,1000)n",
    [f.org, f.unit],
  );
  const positions = (
    await admin.query(
      "INSERT INTO hvb.posicao_estoque(id,organizacao_id,unidade_id,local_id,lote_id,custodia_id) SELECT gen_random_uuid(),$1,$2,id,$3,$4 FROM hvb.local WHERE organizacao_id=$1 RETURNING id",
      [f.org, f.unit, lot, custody],
    )
  ).rows as { id: string }[];
  const movement = {
    motivo: "Movimento fictício benchmark",
    ocorrido_em: "2026-01-01T12:00:00Z",
  };
  for (let i = 0; i < positions.length; i += 10)
    await Promise.all(
      positions.slice(i, i + 10).map((p) =>
        post("/estoque/entradas", {
          posicao_id: p.id,
          quantidade_apresentacoes: "1",
          ...movement,
        }),
      ),
    );
  console.log(
    "Benchmark M2: 1.000 posições abastecidas por comandos e lançamentos reais.",
  );
  const origin = positions[0]?.id,
    destination = positions[1]?.id;
  assert.ok(origin && destination);
  const measurements = [];
  for (const mode of ["lista", "transferencia"]) {
    const times: number[] = [],
      counts: number[] = [],
      functionalCounts: number[] = [];
    for (let i = 0; i < 110; i++) {
      const q = queries,
        fun = functional,
        start = performance.now();
      if (mode === "lista") {
        const r = await app.inject({
          url: `/v1/estoque/posicoes?unidade_id=${f.unit}&produto_id=${product}&disponiveis=true&limit=50`,
          headers,
        });
        assert.equal(r.statusCode, 200, r.body);
      } else
        await post("/estoque/transferencias", {
          origem_id: origin,
          destino_id: destination,
          quantidade_base: "0.001",
          ...movement,
        });
      if (i >= 10) {
        times.push(performance.now() - start);
        counts.push(queries - q);
        functionalCounts.push(functional - fun);
      }
    }
    times.sort((a, b) => a - b);
    measurements.push({
      mode,
      samples: times.length,
      p50_ms: Number(times[49]?.toFixed(2)),
      p95_ms: Number(times[94]?.toFixed(2)),
      sql_total_min: Math.min(...counts),
      sql_total_max: Math.max(...counts),
      sql_functional_max: Math.max(...functionalCounts),
    });
  }
  const plans = await transaction(
    db,
    f.org,
    async (tx) =>
      (
        await tx.query(
          `EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) SELECT id,local_id,lote_id,saldo_base,reservado_base,disponivel_base FROM posicao_estoque WHERE organizacao_id=$1 AND unidade_id=$2 AND lote_id IN(SELECT id FROM lote WHERE organizacao_id=$1 AND produto_id=$3) AND disponivel_base>0 ORDER BY id LIMIT 50`,
          [f.org, f.unit, product],
        )
      ).rows[0]["QUERY PLAN"],
  );
  const address = await app.listen({ host: "127.0.0.1", port: 0 });
  const payload = JSON.stringify({
    origem_id: origin,
    destino_id: destination,
    quantidade_base: "1",
    ...movement,
  });
  const httpHeaders = {
    ...headers,
    "content-type": "application/json",
    "idempotency-key": randomUUID(),
  };
  const response = await fetch(`${address}/v1/estoque/retiradas`, {
    method: "POST",
    headers: httpHeaders,
    body: payload,
  });
  assert.equal(response.status, 200);
  const created = (await response.json()) as { id: string };
  const repeat = await fetch(`${address}/v1/estoque/retiradas`, {
    method: "POST",
    headers: httpHeaders,
    body: payload,
  });
  assert.equal(repeat.status, 200);
  const repeated = (await repeat.json()) as { id: string; repetido: boolean };
  assert.equal(created.id, repeated.id);
  assert.equal(repeated.repetido, true);
  const reconciliation = await admin.query(
    `SELECT count(*)::int AS divergencias FROM (SELECT p.id FROM hvb.posicao_estoque p LEFT JOIN hvb.lancamento_estoque l ON(p.organizacao_id,p.id)=(l.organizacao_id,l.posicao_id) WHERE p.organizacao_id=$1 GROUP BY p.id HAVING p.saldo_base<>coalesce(sum(l.quantidade_assinada),0))x`,
    [f.org],
  );
  assert.equal(reconciliation.rows[0].divergencias, 0);
  const report = {
    executed_at: new Date().toISOString(),
    node: process.version,
    postgres: (await admin.query("SHOW server_version")).rows[0].server_version,
    synthetic_positions: positions.length,
    mode: "Fastify inject + PostgreSQL real local; HTTP real separado no smoke; não é SLA",
    measurements,
    plans,
    http_smoke: {
      withdraw: response.status,
      replay: repeat.status,
      same_id: true,
    },
    reconciliation: reconciliation.rows[0],
  };
  await writeFile(
    "docs/evidencias/benchmark-m2.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    JSON.stringify(
      {
        measurements,
        http_smoke: report.http_smoke,
        reconciliation: report.reconciliation,
      },
      null,
      2,
    ),
  );
} finally {
  await app.close();
  await admin.end();
  await db.end();
}
