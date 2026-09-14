import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { migrate } from "./migrate.ts";
import { seedFixture } from "./seed.ts";
import { financialScenario } from "./financial-scenario.ts";
import { clinicalTime } from "./clinical-scenario.ts";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
const url = process.env.TEST_MIGRATION_DATABASE_URL ?? "";
assert.equal(new URL(url).pathname, "/hvb_sistema_test");
await migrate(url);
const f = await seedFixture(url),
  admin = pool(url, 1),
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
const app = await buildApp(db),
  headers = { authorization: `Bearer ${f.adminToken}` },
  common = {
    unidade_id: f.unit,
    simulacao: true,
    confirmacao_humana: true,
    motivo: "Benchmark financeiro fictício",
  };
async function post(
  path: string,
  body: Record<string, unknown>,
  finance = true,
) {
  const r = await app.inject({
    method: "POST",
    url: `/v1${finance ? "/financeiro" : ""}/${path}`,
    headers: { ...headers, "idempotency-key": randomUUID() },
    payload: finance ? { ...common, ...body } : body,
  });
  assert.equal(r.statusCode, 200, r.body);
  return r.json().id as string;
}
try {
  const s = await financialScenario(app, f.adminToken, f.unit),
    item = await post("itens", {
      conta_id: s.account,
      avaliacao_id: s.evaluation,
      responsabilidades: [{ pagador_id: s.payer, valor: "100.00" }],
    });
  const responsibility = (
    await admin.query(
      "SELECT id FROM hvb.responsabilidade WHERE item_conta_id=$1",
      [item],
    )
  ).rows[0].id;
  const title = await post("titulos", {
    pagador_id: s.payer,
    vencimento: "2026-09-30",
    itens: [{ responsabilidade_id: responsibility, valor: "100.00" }],
  });
  const receiptBody = () => ({
    pagador_id: s.payer,
    meio: "transferencia",
    referencia: randomUUID(),
    recebido_em: clinicalTime,
    valor: "0.01",
    evidencia: "Fictícia, sem operação externa",
  });
  for (let i = 0; i < 1000; i++) {
    await post("recebimentos", receiptBody());
    if ((i + 1) % 250 === 0)
      console.log(`${i + 1} recebimentos fictícios preparados.`);
  }
  const measurements = [];
  for (const mode of ["lista", "avaliacao", "recebimento", "liquidacao"]) {
    const times: number[] = [],
      counts: number[] = [],
      funcs: number[] = [];
    for (let i = 0; i < 110; i++) {
      let event: string | undefined, payment: string | undefined;
      if (mode === "avaliacao") {
        const execution = await post(
          "clinica/execucoes",
          {
            ordem_versao_id: s.version,
            evento_referencia: randomUUID(),
            executada_em: clinicalTime,
            quantidade_aplicada: "1",
            unidade_medida_id: s.measure,
            resultado: "integral",
            situacao_material: "nao_utilizado",
            confirmacao_humana: true,
            motivo: "Execução fictícia",
          },
          false,
        );
        event = await post("eventos", {
          item_comercial_id: s.catalog,
          execucao_id: execution,
          quantidade: "1",
        });
      }
      if (mode === "liquidacao")
        payment = await post("recebimentos", receiptBody());
      const q = queries,
        fn = functional,
        start = performance.now();
      if (mode === "lista") {
        const r = await app.inject({
          url: `/v1/financeiro/recebimentos?unidade_id=${f.unit}&pagador_id=${s.payer}&limit=50`,
          headers,
        });
        assert.equal(r.statusCode, 200, r.body);
      } else if (mode === "avaliacao")
        await post("avaliacoes", {
          evento_id: event,
          versao_esperada: 0,
          preco_id: s.price,
          decisao: "cobravel",
          desconto: "0.00",
        });
      else if (mode === "recebimento")
        await post("recebimentos", receiptBody());
      else
        await post("liquidacoes", {
          titulo_id: title,
          recebimento_id: payment,
          valor: "0.01",
        });
      if (i >= 10) {
        times.push(performance.now() - start);
        counts.push(queries - q);
        funcs.push(functional - fn);
      }
    }
    times.sort((a, b) => a - b);
    measurements.push({
      mode,
      samples: times.length,
      p50_ms: Number(times[49]?.toFixed(2)),
      p95_ms: Number(times[94]?.toFixed(2)),
      sql_total_max: Math.max(...counts),
      sql_functional_max: Math.max(...funcs),
    });
  }
  const plans = await transaction(
    db,
    f.org,
    async (tx) =>
      (
        await tx.query(
          "EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) SELECT id,valor,disponivel,revertido FROM recebimento_consulta WHERE organizacao_id=$1 AND unidade_id=$2 AND pagador_id=$3 ORDER BY id LIMIT 50",
          [f.org, f.unit, s.payer],
        )
      ).rows[0]["QUERY PLAN"],
  );
  const address = await app.listen({ host: "127.0.0.1", port: 0 }),
    httpHeaders = {
      ...headers,
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
    },
    body = JSON.stringify({ ...common, ...receiptBody() });
  const response = await fetch(`${address}/v1/financeiro/recebimentos`, {
      method: "POST",
      headers: httpHeaders,
      body,
    }),
    first = (await response.json()) as { id: string };
  assert.equal(response.status, 200);
  const retry = await fetch(`${address}/v1/financeiro/recebimentos`, {
      method: "POST",
      headers: httpHeaders,
      body,
    }),
    repeated = (await retry.json()) as { id: string; repetido: boolean };
  assert.equal(retry.status, 200);
  assert.equal(first.id, repeated.id);
  assert.equal(repeated.repetido, true);
  const integrity = (
    await admin.query(
      "SELECT (SELECT count(*)::int FROM hvb.titulo_consulta WHERE organizacao_id=$1 AND saldo<0)+(SELECT count(*)::int FROM hvb.recebimento_consulta WHERE organizacao_id=$1 AND disponivel<0) AS saldos_negativos,(SELECT saldo FROM hvb.titulo_consulta WHERE id=$2) AS saldo_titulo,(SELECT saldo_base FROM hvb.posicao_estoque WHERE id=$3) AS saldo_fisico",
      [f.org, title, s.position],
    )
  ).rows[0];
  assert.equal(integrity.saldos_negativos, 0);
  assert.equal(integrity.saldo_titulo, "98.90");
  assert.equal(integrity.saldo_fisico, "20.000000");
  const report = {
    executed_at: new Date().toISOString(),
    node: process.version,
    postgres: (await admin.query("SHOW server_version")).rows[0].server_version,
    synthetic_receipts: 1000,
    mode: "Fastify inject e PostgreSQL local; um pagador/unidade; HTTP separado; sem SLA",
    measurements,
    plans,
    http_smoke: {
      receipt: response.status,
      retry: retry.status,
      same_id: true,
    },
    integrity,
  };
  await writeFile(
    "docs/evidencias/benchmark-m5.json",
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
