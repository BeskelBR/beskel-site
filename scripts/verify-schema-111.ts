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
const results: {
  check: string;
  status: string;
  detail?: string;
  method?: string;
  endpoint?: string;
  expected_http?: number;
  observed_http?: number;
  sqlstate?: string | null;
}[] = [];
let sqlstate: string | null = null;
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
  const query = async (sql: string, values?: unknown[]) => {
    try {
      return await client.query(sql, values);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code && /^[A-Z0-9]{5}$/.test(code)) sqlstate = code;
      throw error;
    }
  };
  const socket = (client as unknown as { connection: { stream: TLSSocket } })
    .connection.stream;
  record("tls_verify_full", socket.encrypted && socket.authorized);
  const ledger = (
    await client.query(
      "SELECT nome,hash FROM public.schema_migration ORDER BY nome",
    )
  ).rows;
  record("canonical_count_111", ledger.length === 111);
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
  record("all_111_hashes", bad.length === 0);
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
    query,
    connect: async () => ({
      release() {},
      async query(sql: string, values?: unknown[]) {
        if (sql === "BEGIN") return client.query("SAVEPOINT api_transaction");
        if (sql === "COMMIT") {
          // Force deferred constraints before reporting request success.
          await query("SET CONSTRAINTS ALL IMMEDIATE");
          await query("SET CONSTRAINTS ALL DEFERRED");
          return client.query("RELEASE SAVEPOINT api_transaction");
        }
        if (sql === "ROLLBACK") {
          await client.query("ROLLBACK TO SAVEPOINT api_transaction");
          return client.query("RELEASE SAVEPOINT api_transaction");
        }
        return query(sql, values);
      },
    }),
  } as unknown as pg.Pool;
  const app = await buildApp(guardedPool);
  try {
    const headers = { authorization: `Bearer ${fixture.tenant_a.adminToken}` };
    async function request(
      check: string,
      method: "GET" | "POST",
      endpoint: string,
      expected: number,
      payload?: object,
    ) {
      sqlstate = null;
      const response = await app.inject({
        method,
        url: endpoint,
        headers: {
          ...headers,
          ...(method === "POST" ? { "idempotency-key": randomUUID() } : {}),
        },
        ...(payload ? { payload } : {}),
      });
      results.push({
        check,
        method,
        endpoint: endpoint.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "{uuid}"),
        expected_http: expected,
        observed_http: response.statusCode,
        sqlstate,
        status: response.statusCode === expected ? "PASS" : "FAIL",
      });
      return response;
    }
    const ready = await request("ready_111", "GET", "/ready", 200);
    record("ready_reports_111", ready.json().migration === 111);
    const me = await request("existing_bearer_login", "GET", "/v1/me", 200);
    record(
      "fixture_identity",
      me.statusCode === 200 &&
        me.json().usuario_id === fixture.tenant_a.admin &&
        me.json().organizacao_id === fixture.tenant_a.org,
    );
    await client.query("SELECT set_config('hvb.org',$1,true)", [
      fixture.tenant_a.org,
    ]);
    record(
      "fixture_login_natural_key",
      (
        await client.query(
          "SELECT login FROM hvb.usuario WHERE id=$1 AND organizacao_id=$2",
          [fixture.tenant_a.admin, fixture.tenant_a.org],
        )
      ).rows[0]?.login === "admin.remote.dev.a",
    );
    for (const [check, url] of [
      ["responsible_read", "/v1/responsaveis"],
      ["patient_read", "/v1/pacientes"],
      ["relationship_read", "/v1/vinculos"],
      ["episode_read", `/v1/episodios?unidade_id=${fixture.tenant_a.unit}`],
      ["occupancy_read", `/v1/ocupacoes?unidade_id=${fixture.tenant_a.unit}`],
    ])
      await request(check as string, "GET", url as string, 200);
    const a = await request(
      "global_assignments",
      "GET",
      "/v1/atribuicoes?limit=100",
      200,
    );
    record(
      "synthetic_admin_global",
      a.statusCode === 200 &&
        a
          .json()
          .items.some(
            (v: { usuario_id: string; escopo: string; unidade_id: unknown }) =>
              v.usuario_id === fixture.tenant_a.admin &&
              v.escopo === "global" &&
              v.unidade_id === null,
          ),
    );
    const marker = `SINTETICO-111-${randomUUID()}`;
    const ownerNull = await request(
      "responsible_null_cpf",
      "POST",
      "/v1/responsaveis",
      200,
      { nome: marker, cpf: null, cep: "01001-000", numero: "12A" },
    );
    // Generate a valid synthetic CPF, using only ephemeral random digits.
    const digits = Array.from(
      randomUUID().replaceAll("-", "").slice(0, 9),
      (v) => Number.parseInt(v, 16) % 10,
    );
    for (let n = 9; n < 11; n++) {
      const sum = digits.reduce((acc, v, i) => acc + v * (n + 1 - i), 0);
      digits.push(((sum * 10) % 11) % 10);
    }
    const cpf = digits.join("");
    await request("responsible_valid_cpf", "POST", "/v1/responsaveis", 200, {
      nome: `${marker} CPF`,
      cpf,
    });
    await request("responsible_invalid_cpf", "POST", "/v1/responsaveis", 409, {
      nome: `${marker} INVALID`,
      cpf: "11111111111",
    });
    record("invalid_cpf_constraint", sqlstate === "23514");
    if (ownerNull.statusCode !== 200)
      throw Error("responsible prerequisite failed");
    const ownerId = ownerNull.json().id;
    const patient = await request(
      "patient_create",
      "POST",
      "/v1/pacientes",
      200,
      {
        nome: marker,
        especie_codigo: "canina",
        estado_vital: "vivo",
        responsavel_id: ownerId,
        papel_responsavel: "legal",
        microchip: null,
      },
    );
    if (patient.statusCode !== 200) throw Error("patient prerequisite failed");
    const patientId = patient.json().id;
    const read = await request(
      "patient_lookup",
      "GET",
      `/v1/pacientes?q=${patientId}`,
      200,
    );
    record(
      "microchip_null",
      read.statusCode === 200 &&
        read
          .json()
          .items.some(
            (p: { id: string; microchip: unknown }) =>
              p.id === patientId && p.microchip === null,
          ),
    );
    for (const [field, id] of [
      ["paciente_id", patientId],
      ["responsavel_id", ownerId],
    ]) {
      const links = await request(
        `relationship_by_${field}`,
        "GET",
        `/v1/vinculos?${field}=${id}`,
        200,
      );
      record(
        `relationship_active_${field}`,
        links.statusCode === 200 &&
          links
            .json()
            .items.some(
              (v: {
                paciente_id: string;
                responsavel_id: string;
                estado: string;
              }) =>
                v.paciente_id === patientId &&
                v.responsavel_id === ownerId &&
                v.estado === "ativo",
            ),
      );
    }
    const episode = await request(
      "episode_create",
      "POST",
      "/v1/episodios",
      200,
      {
        paciente_id: patientId,
        unidade_id: fixture.tenant_a.unit,
        tipo: "internacao",
        admitido_em: new Date().toISOString(),
      },
    );
    if (episode.statusCode !== 200) throw Error("episode prerequisite failed");
    const episodeId = episode.json().id;
    const local = await request("local_create", "POST", "/v1/locais", 200, {
      nome: marker,
      unidade_id: fixture.tenant_a.unit,
      tipo: "box",
      capacidade: 1,
    });
    if (local.statusCode !== 200) throw Error("local prerequisite failed");
    const occupancy = await request(
      "occupancy_create",
      "POST",
      "/v1/ocupacoes",
      200,
      {
        episodio_id: episodeId,
        local_id: local.json().id,
        vaga: 1,
        inicio: new Date().toISOString(),
      },
    );
    const er = await request(
      "episode_read_created",
      "GET",
      `/v1/episodios?unidade_id=${fixture.tenant_a.unit}&paciente_id=${patientId}`,
      200,
    );
    record(
      "episode_state",
      er.statusCode === 200 &&
        er
          .json()
          .items.some(
            (e: { id: string; estado: string }) =>
              e.id === episodeId && e.estado === "ativo",
          ),
    );
    const oc = await request(
      "occupancy_read_created",
      "GET",
      `/v1/ocupacoes?unidade_id=${fixture.tenant_a.unit}&episodio_id=${episodeId}`,
      200,
    );
    record(
      "occupancy_state",
      oc.statusCode === 200 &&
        occupancy.statusCode === 200 &&
        oc
          .json()
          .items.some(
            (o: { id: string; estado: string }) =>
              o.id === occupancy.json().id && o.estado === "ativa",
          ),
    );
    await client.query("SELECT set_config('hvb.org',$1,true)", [
      fixture.tenant_b.org,
    ]);
    record(
      "tenant_b_cannot_read_created_patient",
      (
        await client.query("SELECT id FROM hvb.paciente WHERE id=$1", [
          patientId,
        ])
      ).rowCount === 0,
    );
    await client.query("SELECT set_config('hvb.org',$1,true)", [
      fixture.tenant_a.org,
    ]);
    record(
      "tenant_a_reads_created_patient",
      (
        await client.query("SELECT id FROM hvb.paciente WHERE id=$1", [
          patientId,
        ])
      ).rowCount === 1,
    );
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
