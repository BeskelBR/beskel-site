import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { resolve, relative, isAbsolute, sep, dirname, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type pg from "pg";
import type { TLSSocket } from "node:tls";
import { pool } from "../src/persistence/database.ts";
import { buildApp } from "../src/api/app.ts";

// Runtime API probe held inside one outer rollback. API transactions map to
// savepoints; this tests handlers/SQL, not independent network transactions.
const results: { check: string; status: string; detail?: string }[] = [];
let db: pg.Pool | undefined,
  c: pg.PoolClient | undefined,
  begun = false,
  rollback = false;
const record = (check: string, ok: boolean, detail?: string) =>
  results.push({
    check,
    status: ok ? "PASS" : "FAIL",
    ...(detail ? { detail } : {}),
  });
try {
  if (!process.argv[2]) throw Error("private config required");
  const file = resolve(process.argv[2]),
    rel = relative(process.cwd(), file);
  if (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`))
    throw Error("private config outside workspace required");
  const env = parseEnv(await readFile(file, "utf8"));
  if (
    env.HVB_DATABASE_MODE !== "remote-dev" ||
    env.HVB_DATABASE_TLS !== "verify-full" ||
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0" ||
    process.env.PGOPTIONS
  )
    throw Error("unsafe configuration");
  const fixture = JSON.parse(
    await readFile(join(dirname(file), "e2e-fixture.json"), "utf8"),
  );
  db = pool(env.DATABASE_URL ?? "", 1, env);
  db.on("error", () => record("pool_background_error", false));
  c = await db.connect();
  const client = c;
  const socket = (client as unknown as { connection: { stream: TLSSocket } })
    .connection.stream;
  record("tls_verify_full", socket.encrypted && socket.authorized);
  const ledger = (
    await client.query(
      "SELECT nome,hash FROM public.schema_migration ORDER BY nome",
    )
  ).rows;
  record("canonical_count_102", ledger.length === 102);
  const bad: string[] = [];
  for (const row of ledger) {
    if (!/^\d{3}_[a-z0-9_]+\.sql$/.test(row.nome))
      throw Error("invalid filename");
    if (
      createHash("sha256")
        .update(await readFile(`migrations/${row.nome}`))
        .digest("hex") !== row.hash
    )
      bad.push(row.nome);
  }
  record("all_102_hashes", bad.length === 0);
  const authBefore = (
    await client.query(
      "SELECT md5(pg_get_functiondef('hvb.autenticar(text)'::regprocedure)) AS hash",
    )
  ).rows[0].hash;
  const views = (
    await client.query(
      "SELECT c.relname,c.reloptions FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='hvb' AND c.relname=ANY($1::text[])",
      [
        [
          "paciente_responsavel_consulta",
          "episodio_consulta",
          "ocupacao_consulta",
          "atribuicao_consulta",
        ],
      ],
    )
  ).rows;
  record(
    "four_security_invoker_views",
    views.length === 4 &&
      views.every((v) => v.reloptions?.includes("security_invoker=true")),
  );
  record(
    "runtime_execute_cpf_valido",
    (
      await client.query(
        "SELECT has_function_privilege(current_user,'hvb.cpf_valido(text)','EXECUTE') AS ok",
      )
    ).rows[0].ok === true,
  );
  await client.query("BEGIN");
  begun = true;
  const guardedPool = {
    query: client.query.bind(client),
    connect: async () => ({
      release() {},
      async query(sql: string, values?: unknown[]) {
        if (sql === "BEGIN") return client.query("SAVEPOINT api_transaction");
        if (sql === "COMMIT")
          return client.query("RELEASE SAVEPOINT api_transaction");
        if (sql === "ROLLBACK") {
          await client.query("ROLLBACK TO SAVEPOINT api_transaction");
          return client.query("RELEASE SAVEPOINT api_transaction");
        }
        return client.query(sql, values);
      },
    }),
  } as unknown as pg.Pool;
  const app = await buildApp(guardedPool);
  try {
    record("ready_102", (await app.inject("/ready")).statusCode === 200);
    const headers = { authorization: `Bearer ${fixture.tenant_a.adminToken}` };
    for (const [name, url] of [
      ["api_bearer", "/v1/me"],
      ["responsible_read", "/v1/responsaveis?q=SINTETICO"],
      ["patient_read", "/v1/pacientes?q=SINTETICO"],
      ["relationship_read", "/v1/vinculos"],
      ["episode_read", `/v1/episodios?unidade_id=${fixture.tenant_a.unit}`],
      ["occupancy_read", `/v1/ocupacoes?unidade_id=${fixture.tenant_a.unit}`],
    ]) {
      const r = await app.inject({ url, headers });
      record(name as string, r.statusCode === 200, `HTTP_${r.statusCode}`);
    }
    const assignments = await app.inject({
      url: "/v1/atribuicoes?limit=100",
      headers,
    });
    record(
      "synthetic_admin_global",
      assignments.statusCode === 200 &&
        assignments
          .json()
          .items.some(
            (v: { usuario_id: string; escopo: string; unidade_id: unknown }) =>
              v.usuario_id === fixture.tenant_a.admin &&
              v.escopo === "global" &&
              v.unidade_id === null,
          ),
    );
    const create = await app.inject({
      method: "POST",
      url: "/v1/responsaveis",
      headers: { ...headers, "idempotency-key": randomUUID() },
      payload: {
        nome: "SINTETICO 102 rollback",
        cpf: null,
        cep: "01001-000",
        numero: "12A",
      },
    });
    record(
      "runtime_responsible_creation",
      create.statusCode === 200,
      `HTTP_${create.statusCode}`,
    );
    if (create.statusCode !== 200)
      results.push({
        check: "remote_registration_journey",
        status: "BLOCKED",
        detail: "responsible_creation_failed",
      });
    else {
      const patient = await app.inject({
        method: "POST",
        url: "/v1/pacientes",
        headers: { ...headers, "idempotency-key": randomUUID() },
        payload: {
          nome: "SINTETICO paciente rollback",
          especie_codigo: "canina",
          estado_vital: "vivo",
          responsavel_id: create.json().id,
          papel_responsavel: "legal",
          microchip: null,
        },
      });
      record("patient_with_initial_relationship", patient.statusCode === 200);
    }
  } finally {
    await app.close();
  }
  record(
    "autenticar_preserved",
    (
      await client.query(
        "SELECT md5(pg_get_functiondef('hvb.autenticar(text)'::regprocedure)) AS hash",
      )
    ).rows[0].hash === authBefore,
  );
} catch (e) {
  const code = (e as { code?: string }).code;
  results.push({
    check: "execution",
    status: "FAIL",
    detail: code && /^[A-Z0-9]{5}$/.test(code) ? code : "REDACTED",
  });
} finally {
  try {
    if (c && begun) {
      await c.query("ROLLBACK");
      rollback = true;
    }
  } catch {
    record("rollback", false);
  }
  c?.release();
  try {
    await db?.end();
  } catch {
    record("pool_cleanup", false);
  }
}
console.log(
  JSON.stringify(
    {
      environment: "Supabase DEV Node/pg, API inject with rollback savepoints",
      rollback,
      passed: results.filter((r) => r.status === "PASS").length,
      failed: results.filter((r) => r.status === "FAIL").length,
      blocked: results.filter((r) => r.status === "BLOCKED").length,
      results,
    },
    null,
    2,
  ),
);
if (!rollback || results.some((r) => r.status !== "PASS")) process.exitCode = 1;
