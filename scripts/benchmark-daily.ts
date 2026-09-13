import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { migrate } from "./migrate.ts";
import { seedFixture } from "./seed.ts";
import { dailyScenario } from "./daily-scenario.ts";
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
  const s = await dailyScenario(
    app,
    f.adminToken,
    f.unit,
    randomUUID(),
    "100000",
  );
  async function event() {
    const e = await post("/clinica/execucoes", {
      ordem_versao_id: s.version,
      evento_referencia: randomUUID(),
      executada_em: clinicalTime,
      quantidade_aplicada: "1",
      unidade_medida_id: s.measure,
      resultado: "integral",
      situacao_material: "nao_utilizado",
      confirmacao_humana: true,
      motivo: "Execução fictícia de benchmark",
    });
    return post("/diarias/eventos", {
      execucao_id: e,
      motivo: "Evento fictício de benchmark",
    });
  }
  const evaluate = (id: string, version = 0) =>
    post(`/diarias/eventos/${id}/avaliar`, {
      periodo_diaria_id: s.period,
      versao_esperada: version,
      motivo: "Avaliação fictícia sem preço ou cobrança",
    });
  for (let i = 0; i < 1000; i++) {
    await evaluate(await event());
    if ((i + 1) % 250 === 0)
      console.log(`${i + 1} avaliações fictícias preparadas por comandos.`);
  }
  const measurements = [];
  for (const mode of ["lista", "avaliacao", "reavaliacao"]) {
    const times: number[] = [],
      counts: number[] = [],
      funcs: number[] = [];
    let fixed: string | undefined;
    if (mode === "reavaliacao") {
      fixed = await event();
      await evaluate(fixed);
    }
    for (let i = 0; i < 110; i++) {
      const id = mode === "avaliacao" ? await event() : fixed;
      const q = queries,
        fn = functional,
        start = performance.now();
      if (mode === "lista") {
        const r = await app.inject({
          url: `/v1/diarias/avaliacoes?unidade_id=${f.unit}&episodio_id=${s.episode}&limit=50`,
          headers,
        });
        assert.equal(r.statusCode, 200, r.body);
      } else {
        assert.ok(id);
        await evaluate(id, mode === "reavaliacao" ? i + 1 : 0);
      }
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
          "EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) SELECT id,evento_id,resultado,incluida,excedente,situacao_atual FROM avaliacao_cobertura_consulta WHERE organizacao_id=$1 AND unidade_id=$2 AND episodio_id=$3 ORDER BY id LIMIT 50",
          [f.org, f.unit, s.episode],
        )
      ).rows[0]["QUERY PLAN"],
  );
  const ev = await event(),
    address = await app.listen({ host: "127.0.0.1", port: 0 }),
    httpHeaders = {
      ...headers,
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
    },
    body = JSON.stringify({
      periodo_diaria_id: s.period,
      versao_esperada: 0,
      motivo: "Avaliação fictícia HTTP",
    });
  const first = await fetch(`${address}/v1/diarias/eventos/${ev}/avaliar`, {
      method: "POST",
      headers: httpHeaders,
      body,
    }),
    created = (await first.json()) as { id: string };
  assert.equal(first.status, 200);
  const retry = await fetch(`${address}/v1/diarias/eventos/${ev}/avaliar`, {
      method: "POST",
      headers: httpHeaders,
      body,
    }),
    repeated = (await retry.json()) as { id: string; repetido: boolean };
  assert.equal(retry.status, 200);
  assert.equal(created.id, repeated.id);
  assert.equal(repeated.repetido, true);
  const integrity = await transaction(
    admin,
    f.org,
    async (tx) =>
      (
        await tx.query(
          "SELECT count(*)::int AS limites_excedidos FROM uso_cobertura u JOIN regra_pacote r ON r.organizacao_id=u.organizacao_id AND r.id=u.regra_id CROSS JOIN LATERAL compromisso_cobertura(u.id,NULL) c WHERE u.organizacao_id=$1 AND r.limite_quantidade IS NOT NULL AND c.total>r.limite_quantidade",
          [f.org],
        )
      ).rows[0],
  );
  assert.equal(integrity.limites_excedidos, 0);
  const stock = (
    await admin.query(
      "SELECT saldo_base::text FROM hvb.posicao_estoque WHERE id=$1",
      [s.position],
    )
  ).rows[0].saldo_base;
  assert.equal(stock, "20.000000");
  const report = {
    executed_at: new Date().toISOString(),
    node: process.version,
    postgres: (await admin.query("SHOW server_version")).rows[0].server_version,
    synthetic_evaluations: 1000,
    mode: "Fastify inject com PostgreSQL local; um episódio/pacote/regra; HTTP separado; sem SLA",
    measurements,
    plans,
    http_smoke: {
      evaluation: first.status,
      retry: retry.status,
      same_id: true,
    },
    integrity: { ...integrity, saldo_fisico_preservado: stock },
  };
  await writeFile(
    "docs/evidencias/benchmark-m4.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    JSON.stringify(
      {
        measurements,
        http_smoke: report.http_smoke,
        integrity: report.integrity,
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
