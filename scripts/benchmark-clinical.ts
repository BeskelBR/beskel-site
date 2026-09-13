import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { migrate } from "./migrate.ts";
import { seedFixture } from "./seed.ts";
import { clinicalScenario, clinicalTime } from "./clinical-scenario.ts";
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
  headers = { authorization: `Bearer ${f.adminToken}` };
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
  const s = await clinicalScenario(app, f.adminToken, f.unit);
  const schedules: string[] = [];
  for (let i = 0; i < 1000; i++)
    schedules.push(
      await post("/clinica/programacoes", {
        ordem_versao_id: s.version,
        prevista_em: new Date(
          Date.parse("2026-09-01T10:00:00Z") + i * 1000,
        ).toISOString(),
      }),
    );
  console.log(
    "Mil programações fictícias criadas por comandos; medindo mapa, execução e consumo.",
  );
  const measurements = [];
  for (const mode of ["mapa", "execucao", "consumo", "consumo_vinculado"]) {
    const times: number[] = [],
      counts: number[] = [],
      functions: number[] = [];
    for (let i = 0; i < 110; i++) {
      const body = mode.startsWith("consumo")
        ? {
            episodio_id: s.episode,
            evento_referencia: randomUUID(),
            ocorrido_em: clinicalTime,
            finalidade: "Consumo fictício benchmark",
            motivo: "Ensaio técnico",
            itens_confirmados: true,
            itens: [{ posicao_id: s.position, quantidade_base: "0.001" }],
          }
        : {
            ordem_versao_id: s.version,
            programacao_id: schedules[i],
            evento_referencia: randomUUID(),
            executada_em: clinicalTime,
            quantidade_aplicada: "1",
            unidade_medida_id: s.measure,
            resultado: "integral",
            situacao_material: "pendente",
            confirmacao_humana: true,
            motivo: "Execução fictícia benchmark",
          };
      if (mode === "consumo_vinculado")
        Object.assign(body, {
          execucao_id: await post("/clinica/execucoes", {
            ordem_versao_id: s.version,
            evento_referencia: randomUUID(),
            executada_em: clinicalTime,
            quantidade_aplicada: "1",
            unidade_medida_id: s.measure,
            resultado: "integral",
            situacao_material: "pendente",
            confirmacao_humana: true,
            motivo: "Preparação fictícia fora da medição",
          }),
        });
      const q = queries,
        fn = functional,
        start = performance.now();
      if (mode === "mapa") {
        const r = await app.inject({
          url: `/v1/clinica/programacoes?unidade_id=${f.unit}&inicio=2026-09-01T00:00:00Z&fim=2026-09-02T00:00:00Z&limit=50`,
          headers,
        });
        assert.equal(r.statusCode, 200, r.body);
      } else
        await post(
          `/clinica/${mode === "execucao" ? "execucoes" : "consumos"}`,
          body,
        );
      if (i >= 10) {
        times.push(performance.now() - start);
        counts.push(queries - q);
        functions.push(functional - fn);
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
      sql_functional_max: Math.max(...functions),
    });
  }
  const plans = await transaction(
    db,
    f.org,
    async (tx) =>
      (
        await tx.query(
          "EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) SELECT id,episodio_id,ordem_versao_id,prevista_em,estado_execucao FROM programacao_consulta WHERE organizacao_id=$1 AND unidade_id=$2 AND prevista_em>=$3 AND prevista_em<$4 ORDER BY id LIMIT 50",
          [f.org, f.unit, "2026-09-01T00:00:00Z", "2026-09-02T00:00:00Z"],
        )
      ).rows[0]["QUERY PLAN"],
  );
  const address = await app.listen({ host: "127.0.0.1", port: 0 }),
    httpHeaders = {
      ...headers,
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
    };
  const body = JSON.stringify({
    ordem_versao_id: s.version,
    programacao_id: s.schedule,
    evento_referencia: randomUUID(),
    executada_em: clinicalTime,
    quantidade_aplicada: "1",
    unidade_medida_id: s.measure,
    resultado: "integral",
    situacao_material: "pendente",
    confirmacao_humana: true,
    motivo: "Execução sintética em HTTP real",
  });
  const first = await fetch(`${address}/v1/clinica/execucoes`, {
    method: "POST",
    headers: httpHeaders,
    body,
  });
  const e = (await first.json()) as { id: string };
  assert.equal(first.status, 200);
  const retry = await fetch(`${address}/v1/clinica/execucoes`, {
    method: "POST",
    headers: httpHeaders,
    body,
  });
  const repeat = (await retry.json()) as { id: string; repetido: boolean };
  assert.equal(retry.status, 200);
  assert.equal(e.id, repeat.id);
  assert.equal(repeat.repetido, true);
  const reconcile = (
    await admin.query(
      "SELECT count(*)::int AS divergencias FROM hvb.posicao_estoque p WHERE organizacao_id=$1 AND saldo_base<>coalesce((SELECT sum(quantidade_assinada) FROM hvb.lancamento_estoque l WHERE l.organizacao_id=p.organizacao_id AND l.posicao_id=p.id),0)",
      [f.org],
    )
  ).rows[0];
  assert.equal(reconcile.divergencias, 0);
  const report = {
    executed_at: new Date().toISOString(),
    node: process.version,
    postgres: (await admin.query("SHOW server_version")).rows[0].server_version,
    synthetic_schedules: 1000,
    mode: "Fastify inject e PostgreSQL local; HTTP separado; cenário concentrado em um episódio, sem SLA",
    measurements,
    plans,
    http_smoke: { execution: first.status, retry: retry.status, same_id: true },
    reconciliation: reconcile,
  };
  await writeFile(
    "docs/evidencias/benchmark-m3.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    JSON.stringify(
      {
        measurements,
        http_smoke: report.http_smoke,
        reconciliation: reconcile,
      },
      null,
      2,
    ),
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
