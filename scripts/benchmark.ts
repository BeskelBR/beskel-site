import { performance } from "node:perf_hooks";
import { mkdir, writeFile } from "node:fs/promises";
import { seedFixture } from "./seed.ts";
import { migrate } from "./migrate.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { buildApp } from "../src/api/app.ts";

const url = process.env.TEST_MIGRATION_DATABASE_URL ?? "";
if (new URL(url).pathname !== "/hvb_sistema_test")
  throw new Error("Benchmark somente em TEST.");
await migrate(url);
const f = await seedFixture(url),
  admin = pool(url, 1),
  db = pool(process.env.TEST_DATABASE_URL ?? "", 5);
const app = await buildApp(db);
try {
  await admin.query(
    `INSERT INTO hvb.paciente(id,organizacao_id,nome,especie_codigo)
    SELECT gen_random_uuid(),$1,'Paciente Fictício Benchmark '||n,'canina' FROM generate_series(1,10000) n`,
    [f.org],
  );
  await admin.query(
    `INSERT INTO hvb.episodio(id,organizacao_id,unidade_id,paciente_id,tipo,admitido_em,autor_id)
    SELECT gen_random_uuid(),$1,$2,id,'internacao',now()-interval '1 hour',$3 FROM hvb.paciente
    WHERE organizacao_id=$1 LIMIT 2000`,
    [f.org, f.unit, f.admin],
  );
  await admin.query("ANALYZE hvb.paciente");
  await admin.query("ANALYZE hvb.episodio");
  const headers = { authorization: `Bearer ${f.adminToken}` };
  const measurements = [];
  for (const route of [
    "/v1/pacientes?limit=50",
    `/v1/episodios?unidade_id=${f.unit}&ativos=true&limit=50`,
  ]) {
    const times: number[] = [];
    let maxBytes = 0;
    for (let i = 0; i < 110; i++) {
      const start = performance.now();
      const result = await app.inject({ url: route, headers });
      if (result.statusCode !== 200) throw new Error(result.body);
      if (i >= 10) times.push(performance.now() - start);
      maxBytes = Math.max(maxBytes, Buffer.byteLength(result.body));
    }
    times.sort((a, b) => a - b);
    measurements.push({
      route: route.replace(f.unit, "UNIT_ID"),
      requests: times.length,
      p50_ms: Number(times[49]?.toFixed(2)),
      p95_ms: Number(times[94]?.toFixed(2)),
      max_response_bytes: maxBytes,
    });
  }
  const plans = await transaction(db, f.org, async (tx) => ({
    patients: (
      await tx.query(
        "EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id,nome FROM paciente WHERE organizacao_id=$1 ORDER BY id LIMIT 50",
        [f.org],
      )
    ).rows[0]["QUERY PLAN"],
    episodes: (
      await tx.query(
        "EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id,paciente_id FROM episodio WHERE organizacao_id=$1 AND unidade_id=$2 AND encerrado_em IS NULL ORDER BY id LIMIT 50",
        [f.org, f.unit],
      )
    ).rows[0]["QUERY PLAN"],
  }));
  await mkdir("docs/evidencias", { recursive: true });
  const report = {
    executed_at: new Date().toISOString(),
    node: process.version,
    postgres: (await admin.query("SHOW server_version")).rows[0].server_version,
    kind: "Fastify inject + PostgreSQL real local; sem rede HTTP/TLS e sem carga hospitalar real",
    synthetic_patients: 10000,
    synthetic_episodes: 2000,
    measurements,
    plans,
  };
  await writeFile(
    "docs/evidencias/benchmark-m1.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(measurements, null, 2));
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
