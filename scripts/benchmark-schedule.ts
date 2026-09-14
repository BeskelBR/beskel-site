import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import { migrate } from "./migrate.ts";
import { seedFixture } from "./seed.ts";
import { scheduleScenario } from "./schedule-scenario.ts";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
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
  const s = await scheduleScenario(app, f.adminToken, f.unit);
  async function post(path: string, body: Record<string, unknown>) {
    const r = await app.inject({
      method: "POST",
      url: `/v1/agenda/${path}`,
      headers: { ...headers, "idempotency-key": randomUUID() },
      payload: { ...s.common, ...body },
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.json();
  }
  await post("disponibilidades", {
    recurso_id: s.resource,
    tipo: "disponivel",
    inicio: "2026-09-02T00:00:00Z",
    fim: "2026-12-01T00:00:00Z",
  });
  let slot = 0;
  function interval() {
    const start = Date.parse("2026-09-02T00:00:00Z") + slot++ * 1800000;
    return {
      inicio: new Date(start).toISOString(),
      fim: new Date(start + 1800000).toISOString(),
    };
  }
  const booking = () => ({
    ...s.body,
    referencia: randomUUID(),
    ...interval(),
  });
  for (let i = 0; i < 1000; i++) await post("agendamentos", booking());
  const map = `/v1/agenda/mapa?unidade_id=${f.unit}&inicio=2026-09-02T00:00:00Z&fim=2026-09-09T00:00:00Z&recurso_id=${s.resource}&limit=50`;
  const measurements = [];
  for (const mode of ["mapa", "agendar", "reprogramar"]) {
    const times: number[] = [],
      counts: number[] = [];
    for (let i = 0; i < 110; i++) {
      const previous =
        mode === "reprogramar"
          ? await post("agendamentos", booking())
          : undefined;
      const body = booking(),
        q = queries,
        start = performance.now();
      if (mode === "mapa") {
        const r = await app.inject({ url: map, headers });
        assert.equal(r.statusCode, 200, r.body);
        assert.equal(r.json().items.length, 50);
      } else if (mode === "agendar") await post("agendamentos", body);
      else
        await post("versoes", {
          agendamento_id: previous.id,
          versao_esperada: 1,
          inicio: body.inicio,
          fim: body.fim,
          recursos: body.recursos,
          observacao: "Reprogramação fictícia benchmark",
        });
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
    body = JSON.stringify({ ...s.common, ...booking() });
  const first = await fetch(`${address}/v1/agenda/agendamentos`, {
      method: "POST",
      headers: httpHeaders,
      body,
    }),
    a = (await first.json()) as { id: string };
  const retry = await fetch(`${address}/v1/agenda/agendamentos`, {
      method: "POST",
      headers: httpHeaders,
      body,
    }),
    b = (await retry.json()) as { id: string; repetido: boolean };
  assert.equal(first.status, 200);
  assert.equal(retry.status, 200);
  assert.equal(a.id, b.id);
  assert.equal(b.repetido, true);
  const mapResponse = await fetch(`${address}${map}`, { headers });
  assert.equal(mapResponse.status, 200);
  const integrity = (
    await admin.query(
      "SELECT (SELECT count(*)::int FROM hvb.execucao WHERE organizacao_id=$1) execucoes,(SELECT count(*)::int FROM hvb.item_conta WHERE organizacao_id=$1) cobrancas,(SELECT saldo_base FROM hvb.posicao_estoque WHERE id=$2) saldo_fisico",
      [f.org, s.position],
    )
  ).rows[0];
  assert.equal(integrity.execucoes, 0);
  assert.equal(integrity.cobrancas, 0);
  assert.equal(integrity.saldo_fisico, "20.000000");
  const report = {
    executed_at: new Date().toISOString(),
    node: process.version,
    postgres: (await admin.query("SHOW server_version")).rows[0].server_version,
    synthetic_appointments: 1000,
    mode: "Fastify inject e PostgreSQL local; um recurso, slots 30 minutos; HTTP separado; sem SLA",
    measurements,
    http_smoke: {
      create: first.status,
      retry: retry.status,
      same_id: true,
      map: mapResponse.status,
    },
    integrity,
  };
  await writeFile(
    "docs/evidencias/benchmark-m6d.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
