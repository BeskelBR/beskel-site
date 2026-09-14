import { createHash, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { migrate } from "./migrate.ts";
import { seedFixture } from "./seed.ts";
import { examScenario } from "./exam-scenario.ts";
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
try {
  const s = await examScenario(app, f.adminToken, f.unit);
  async function post(path: string, body: Record<string, unknown>) {
    const r = await app.inject({
      method: "POST",
      url: `/v1/exames/${path}`,
      headers: { ...headers, "idempotency-key": randomUUID() },
      payload: { ...s.common, ...body },
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.json().id as string;
  }
  async function newItem() {
    const request = await post("solicitacoes", {
      episodio_id: s.episode,
      solicitada_em: "2026-09-01T10:00:00Z",
      referencia: randomUUID(),
      indicacao: "Benchmark fictício",
      itens: [{ exame_versao_id: s.examVersion }],
    });
    const r = await app.inject({
      url: `/v1/exames/itens?unidade_id=${f.unit}&solicitacao_id=${request}`,
      headers,
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.json().items[0].id as string;
  }
  const resultBody = (item: string) => ({
    item_exame_id: item,
    versao_esperada: 0,
    produzido_em: "2026-09-01T12:00:00Z",
    referencia: randomUUID(),
    origem_idade: "desconhecida",
    observacao: "Somente benchmark fictício",
    valores: s.values,
  });
  for (let i = 0; i < 1000; i++) {
    await post("resultados", resultBody(await newItem()));
    if ((i + 1) % 250 === 0)
      console.log(`${i + 1} resultados fictícios preparados.`);
  }
  const measurements = [];
  for (const mode of ["lista", "resultado", "liberacao"]) {
    const times: number[] = [],
      counts: number[] = [],
      funcs: number[] = [];
    for (let i = 0; i < 110; i++) {
      let item: string | undefined, result: string | undefined;
      if (mode !== "lista") item = await newItem();
      if (mode === "liberacao")
        result = await post("resultados", resultBody(item as string));
      const q = queries,
        fn = functional,
        start = performance.now();
      if (mode === "lista") {
        const r = await app.inject({
          url: `/v1/exames/resultados?unidade_id=${f.unit}&episodio_id=${s.episode}&limit=50`,
          headers,
        });
        assert.equal(r.statusCode, 200, r.body);
        assert.equal(r.json().items.length, 50);
      } else if (mode === "resultado")
        await post("resultados", resultBody(item as string));
      else
        await post("liberacoes", {
          resultado_id: result,
          pendencias_confirmadas: true,
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
          "EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) SELECT id,versao,liberado,substituido,ha_versao_pendente,faltam_obrigatorios,tem_pendencias,necessita_revisao FROM resultado_exame_consulta WHERE organizacao_id=$1 AND unidade_id=$2 AND episodio_id=$3 ORDER BY id LIMIT 50",
          [f.org, f.unit, s.episode],
        )
      ).rows[0]["QUERY PLAN"],
  );
  const item = await newItem(),
    address = await app.listen({ host: "127.0.0.1", port: 0 }),
    httpHeaders = {
      ...headers,
      "content-type": "application/json",
      "idempotency-key": randomUUID(),
    },
    body = JSON.stringify({ ...s.common, ...resultBody(item) });
  const response = await fetch(`${address}/v1/exames/resultados`, {
      method: "POST",
      headers: httpHeaders,
      body,
    }),
    first = (await response.json()) as { id: string };
  assert.equal(response.status, 200);
  const retry = await fetch(`${address}/v1/exames/resultados`, {
      method: "POST",
      headers: httpHeaders,
      body,
    }),
    repeated = (await retry.json()) as { id: string; repetido: boolean };
  assert.equal(retry.status, 200);
  assert.equal(first.id, repeated.id);
  assert.equal(repeated.repetido, true);
  await post("liberacoes", {
    resultado_id: first.id,
    pendencias_confirmadas: true,
  });
  const document = await fetch(
    `${address}/v1/exames/documentos?unidade_id=${f.unit}&resultado_id=${first.id}`,
    { headers },
  );
  assert.equal(document.status, 200);
  const doc = (
    (await document.json()) as {
      items: { conteudo_json: string; hash_conteudo: string }[];
    }
  ).items[0];
  assert.ok(doc);
  assert.equal(
    createHash("sha256").update(doc.conteudo_json).digest("hex"),
    doc.hash_conteudo,
  );
  const integrity = (
    await admin.query(
      "SELECT (SELECT count(*)::int FROM hvb.execucao WHERE organizacao_id=$1) AS execucoes,(SELECT count(*)::int FROM hvb.item_conta WHERE organizacao_id=$1) AS cobrancas,(SELECT saldo_base FROM hvb.posicao_estoque WHERE id=$2) AS saldo_fisico,(SELECT count(*)::int FROM hvb.resultado_versao WHERE organizacao_id=$1) AS resultados,(SELECT count(*)::int FROM hvb.liberacao_resultado WHERE organizacao_id=$1) AS liberacoes",
      [f.org, s.position],
    )
  ).rows[0];
  assert.equal(integrity.execucoes, 0);
  assert.equal(integrity.cobrancas, 0);
  assert.equal(integrity.saldo_fisico, "20.000000");
  assert.equal(integrity.resultados, 1221);
  assert.equal(integrity.liberacoes, 111);
  const report = {
    executed_at: new Date().toISOString(),
    node: process.version,
    postgres: (await admin.query("SHOW server_version")).rows[0].server_version,
    synthetic_results: 1000,
    values_per_result: 3,
    mode: "Fastify inject e PostgreSQL local; um episódio/unidade; HTTP separado; sem SLA",
    measurements,
    plans,
    http_smoke: {
      result: response.status,
      retry: retry.status,
      same_id: true,
      document: document.status,
      sha256_verified: true,
    },
    integrity,
  };
  await writeFile(
    "docs/evidencias/benchmark-m6a.json",
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
