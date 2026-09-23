import { readFileSync } from "node:fs";
import { resolve, relative, isAbsolute, sep } from "node:path";
import { parseEnv } from "node:util";
import { randomBytes, randomUUID } from "node:crypto";
import type { TLSSocket } from "node:tls";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { pool, transaction } from "../src/persistence/database.ts";
import { buildApp } from "../src/api/app.ts";

// Only controlled status fields leave this process. Never print errors, URLs,
// environment values, response bodies, user IDs, certificate material or tokens.
const results: { check: string; status: string; detail?: string }[] = [];
const record = (check: string, condition: boolean, detail?: string) => {
  results.push({
    check,
    status: condition ? "PASS" : "FAIL",
    ...(detail ? { detail } : {}),
  });
  if (!condition) throw new Error("check_failed");
};
let db: pg.Pool | undefined;
let app: FastifyInstance | undefined;
let stage = "private_configuration";
try {
  const input = process.argv[2];
  if (!input) throw new Error("private_configuration_required");
  const file = resolve(input);
  const withinWorkspace = relative(process.cwd(), file);
  if (
    !isAbsolute(withinWorkspace) &&
    withinWorkspace !== ".." &&
    !withinWorkspace.startsWith(`..${sep}`)
  )
    throw new Error("private_configuration_outside_workspace_required");
  const env = parseEnv(readFileSync(file, "utf8"));
  record(
    "explicit_remote_dev",
    env.HVB_DATABASE_MODE === "remote-dev" &&
      env.HVB_DATABASE_TLS === "verify-full",
  );
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0" || process.env.PGOPTIONS)
    throw new Error("unsafe_process_overrides");
  db = pool(env.DATABASE_URL ?? "", 1, env);
  // No raw pool error is emitted or logged, including errors from idle clients.
  db.on("error", () => {
    results.push({ check: "pool_background_error", status: "FAIL" });
  });
  stage = "postgres_tls_connection";
  const client = await db.connect();
  try {
    const stream = (client as unknown as { connection: { stream: TLSSocket } })
      .connection.stream;
    const ssl = await client.query(
      "SELECT ssl,version FROM pg_stat_ssl WHERE pid=pg_backend_pid()",
    );
    record(
      "tls_certificate_and_hostname",
      stream.encrypted === true && stream.authorized === true,
    );
    const version = ssl.rows[0]?.version;
    record(
      "postgres_tls",
      ssl.rows[0]?.ssl === true && ["TLSv1.2", "TLSv1.3"].includes(version),
      version === "TLSv1.3" ? "TLSv1.3" : "TLSv1.2",
    );
    stage = "runtime_capabilities";
    const result = await client.query(`SELECT
      pg_has_role(current_user,'hvb_app','USAGE') AS inherits,
      has_schema_privilege(current_user,'hvb','USAGE') AS schema_usage,
      has_function_privilege(current_user,'hvb.autenticar(text)','EXECUTE') AS authenticate,
      EXISTS(SELECT 1 FROM public.schema_migration WHERE nome='076_terminal_v1_conservation.sql') AS migration_076,
      NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='hvb_app' AND rolcanlogin) AS logical_role_nologin,
      (SELECT rolcanlogin AND NOT (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
        FROM pg_roles WHERE rolname=current_user) AS restricted_login`);
    record(
      "runtime_capabilities",
      Object.values(result.rows[0]).every((value) => value === true),
    );
  } finally {
    client.release();
  }
  stage = "transaction_local_context";
  const runtimeDb = db;
  const context = async () =>
    (
      await runtimeDb.query(
        "SELECT current_setting('search_path') AS path, coalesce(current_setting('hvb.org',true),'') AS org",
      )
    ).rows[0];
  const before = await context();
  const org = randomUUID();
  await transaction(db, org, async (tx) => {
    const r = await tx.query(
      "SELECT current_setting('search_path') AS path, current_setting('hvb.org') AS org",
    );
    record(
      "transaction_local_values",
      r.rows[0].path === "hvb,public" && r.rows[0].org === org,
    );
  });
  const afterCommit = await context();
  record(
    "context_restored_after_commit",
    before.path === afterCommit.path && before.org === afterCommit.org,
  );
  let rolledBack = false;
  try {
    await transaction(db, org, async (tx) => {
      await tx.query("SELECT 1/0");
    });
  } catch (error) {
    rolledBack = (error as { code?: string }).code === "22012";
  }
  const afterRollback = await context();
  record(
    "rollback_and_context_restoration",
    rolledBack &&
      before.path === afterRollback.path &&
      before.org === afterRollback.org,
  );
  stage = "api_http";
  app = await buildApp(db);
  const base = await app.listen({ host: "127.0.0.1", port: 0 });
  async function request(path: string, token?: string) {
    return fetch(`${base}${path}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
  }
  record("http_health", (await request("/health")).status === 200);
  record("http_ready_remote", (await request("/ready")).status === 200);
  record(
    "http_auth_missing_rejected",
    (await request("/v1/me")).status === 401,
  );
  record(
    "http_auth_unknown_rejected",
    (await request("/v1/me", randomBytes(32).toString("hex"))).status === 401,
  );
  if (env.HVB_E2E_API_TOKEN) {
    stage = "authenticated_identity";
    if (!/^[a-f0-9]{64}$/.test(env.HVB_E2E_API_TOKEN))
      throw new Error("invalid_private_fixture");
    const me = await request("/v1/me", env.HVB_E2E_API_TOKEN);
    const ctx = await request("/v1/me/contexto", env.HVB_E2E_API_TOKEN);
    record(
      "authenticated_http_status",
      me.status === 200 && ctx.status === 200,
    );
    const identity = await me.json(),
      scope = await ctx.json();
    record(
      "authenticated_context",
      Boolean(identity.usuario_id) &&
        identity.usuario_id === scope.usuario_id &&
        identity.organizacao_id === scope.organizacao_id,
    );
  } else {
    results.push({
      check: "authenticated_identity",
      status: "BLOCKED",
      detail: "private_synthetic_hvb_credential_not_provided",
    });
  }
} catch (error) {
  const e = error as { code?: string; message?: string };
  const safeCodes = [
    "ECONNREFUSED",
    "ENETUNREACH",
    "EHOSTUNREACH",
    "ETIMEDOUT",
    "ENOTFOUND",
    "EAI_AGAIN",
    "EACCES",
    "EPERM",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "SELF_SIGNED_CERT_IN_CHAIN",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    "ERR_TLS_CERT_ALTNAME_INVALID",
    "CERT_HAS_EXPIRED",
    "28P01",
    "42501",
    "3D000",
    "42704",
    "42P01",
  ];
  const safeMessages = [
    "check_failed",
    "private_configuration_required",
    "private_configuration_outside_workspace_required",
    "unsafe_process_overrides",
    "invalid_private_fixture",
  ];
  results.push({
    check: stage,
    status: "FAIL",
    detail: safeCodes.includes(e.code ?? "")
      ? e.code
      : safeMessages.includes(e.message ?? "")
        ? e.message
        : "connection_or_configuration_error_redacted",
  });
  process.exitCode = 1;
} finally {
  try {
    await app?.close();
    await db?.end();
  } catch {
    results.push({ check: "cleanup", status: "FAIL" });
    process.exitCode = 1;
  }
  if (results.some((result) => result.status === "FAIL")) process.exitCode = 1;
  console.log(
    JSON.stringify(
      { businessWrites: false, authenticatedReadsAudited: true, results },
      null,
      2,
    ),
  );
}
