import { readFile } from "node:fs/promises";
import { resolve, relative, isAbsolute, sep, dirname, join } from "node:path";
import { parseEnv } from "node:util";
import { createHash, randomUUID, randomBytes } from "node:crypto";
import type { TLSSocket } from "node:tls";
import type pg from "pg";
import { pool } from "../src/persistence/database.ts";
import { buildApp } from "../src/api/app.ts";
import {
  hashPassword,
  temporaryPassword,
  verifyPassword,
} from "../src/domain/human-access/password.ts";

// Synthetic runtime test only. No DDL, private-table writes, email or commit.
// Existing private fixture supplies the tenant/admin; new user is rolled back.
const checks: { check: string; status: string; code?: string }[] = [];
let db: pg.Pool | undefined, tx: pg.PoolClient | undefined;
let began = false,
  rolledBack = false,
  stage = "private_configuration";
function check(name: string, valid: boolean) {
  stage = name;
  if (!valid)
    throw Object.assign(new Error("check_failed"), { code: "CHECK_FAILED" });
  checks.push({ check: name, status: "PASS" });
}
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
try {
  if (!process.argv[2]) throw new Error("private_configuration_required");
  const file = resolve(process.argv[2]);
  const inside = relative(process.cwd(), file);
  if (!isAbsolute(inside) && inside !== ".." && !inside.startsWith(`..${sep}`))
    throw new Error("private_configuration_outside_workspace_required");
  const env = parseEnv(await readFile(file, "utf8"));
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0" || process.env.PGOPTIONS)
    throw new Error("unsafe_process_override");
  check(
    "explicit_remote_dev_verify_full",
    env.HVB_DATABASE_MODE === "remote-dev" &&
      env.HVB_DATABASE_TLS === "verify-full",
  );
  const fixture = JSON.parse(
    await readFile(join(dirname(file), "e2e-fixture.json"), "utf8"),
  );
  const a = fixture.tenant_a,
    b = fixture.tenant_b;
  const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  check(
    "private_synthetic_fixture",
    [a?.org, a?.admin, b?.org].every(
      (v) => typeof v === "string" && uuid.test(v),
    ) &&
      a.org !== b.org &&
      /^[a-f0-9]{64}$/.test(a?.adminToken ?? ""),
  );
  db = pool(env.DATABASE_URL ?? "", 1, env);
  db.on("error", () => {
    checks.push({ check: "pool_error", status: "FAIL" });
  });
  stage = "remote_connection";
  tx = await db.connect();
  const client = tx;
  const stream = (tx as unknown as { connection: { stream: TLSSocket } })
    .connection.stream;
  const tls = (
    await tx.query(
      "SELECT ssl,version FROM pg_stat_ssl WHERE pid=pg_backend_pid() ",
    )
  ).rows[0];
  check(
    "real_tls_certificate_hostname",
    stream.encrypted &&
      stream.authorized &&
      tls.ssl &&
      ["TLSv1.2", "TLSv1.3"].includes(tls.version),
  );
  const migration = await tx.query(
    "SELECT hash FROM public.schema_migration WHERE nome='077_human_access_cpf.sql'",
  );
  check(
    "canonical_077",
    migration.rows[0]?.hash ===
      "a7030dde974cf5072d0c9af0eedcb8502664f85fd09aae3c9a43da4f5d494eac",
  );
  const authDefinition = async () =>
    (
      await client.query(
        "SELECT md5(pg_get_functiondef('hvb.autenticar(text)'::regprocedure)) AS hash",
      )
    ).rows[0].hash;
  const authBefore = await authDefinition();
  const auth = async (token: string) =>
    (await client.query("SELECT * FROM hvb.autenticar($1)", [sha(token)]))
      .rows[0];
  check(
    "existing_api_bearer",
    (await auth(a.adminToken))?.usuario_id === a.admin,
  );
  await tx.query("BEGIN");
  began = true;
  await tx.query(
    "SELECT set_config('search_path','hvb,public',true),set_config('hvb.org',$1,true)",
    [a.org],
  );
  const permission = await tx.query(
    "SELECT 1 FROM hvb.atribuicao_consulta a JOIN hvb.papel_permissao pp ON (pp.organizacao_id,pp.papel_id)=(a.organizacao_id,a.papel_id) WHERE a.organizacao_id=$1 AND a.usuario_id=$2 AND a.ativo AND a.unidade_id IS NULL AND pp.permissao='acesso:administrar'",
    [a.org, a.admin],
  );
  check("fixture_admin_permission", Boolean(permission.rowCount));
  const user = randomUUID(),
    cpf = "52998224725";
  const exists = await tx.query(
    "SELECT 1 FROM hvb.usuario WHERE organizacao_id=$1 AND login=$2",
    [a.org, cpf],
  );
  check("synthetic_login_available", !exists.rowCount);
  stage = "synthetic_user";
  await tx.query(
    "INSERT INTO hvb.usuario(id,organizacao_id,nome,login) VALUES($1,$2,'SINTETICO verificacao 077 rollback',$3)",
    [user, a.org, cpf],
  );
  const secret = temporaryPassword(),
    phc = await hashPassword(secret);
  const finalSecret = temporaryPassword(),
    finalPhc = await hashPassword(finalSecret);
  const issue = async (purpose: string) =>
    (
      await client.query(
        "SELECT * FROM hvb.acesso_humano_emitir_senha_temporaria($1,$2,$3,'probe@example.invalid',$4,$5,'argon2id-phc',clock_timestamp()+interval '30 minutes','Verificacao sintetica rollback',$6)",
        [a.org, a.admin, user, purpose, phc, randomUUID()],
      )
    ).rows[0];
  const proof = async (org = a.org) =>
    (
      await client.query("SELECT * FROM hvb.acesso_humano_obter_prova($1,$2)", [
        org,
        cpf,
      ])
    ).rows[0];
  stage = "issue_temporary";
  const temp = await issue("ativacao");
  check(
    "temporary_unavailable_before_delivery",
    !(await proof())?.temporaria_id,
  );
  stage = "confirm_synthetic_delivery";
  // Simulates delivery confirmation in a rolled-back fixture; no actual email.
  await tx.query(
    "SELECT * FROM hvb.acesso_humano_marcar_senha_temporaria_enviada($1,$2,$3)",
    [a.org, temp.senha_temporaria_id, randomUUID()],
  );
  check(
    "temporary_argon2_proof",
    await verifyPassword(secret, (await proof()).temporaria_hash),
  );
  check("tenant_A_B_isolation", !(await proof(b.org)));
  stage = "canonical_consumption";
  await tx.query(
    "SELECT * FROM hvb.acesso_humano_consumir_senha_temporaria($1,$2,$3,$4,'argon2id-phc',$5)",
    [a.org, user, temp.senha_temporaria_id, finalPhc, randomUUID()],
  );
  const active = await proof();
  check(
    "temporary_consumed_final_password_active",
    active.estado === "ativo" &&
      active.senha_versao === 1 &&
      !active.temporaria_id &&
      (await verifyPassword(finalSecret, active.senha_hash)),
  );
  await tx.query("SAVEPOINT retry_consumed");
  let refused = false;
  try {
    await tx.query(
      "SELECT * FROM hvb.acesso_humano_consumir_senha_temporaria($1,$2,$3,$4,'argon2id-phc',$5)",
      [a.org, user, temp.senha_temporaria_id, finalPhc, randomUUID()],
    );
  } catch (e) {
    refused = (e as { code?: string }).code === "23514";
    await tx.query("ROLLBACK TO SAVEPOINT retry_consumed");
  }
  await tx.query("RELEASE SAVEPOINT retry_consumed");
  check("consumed_temporary_cannot_be_reused", refused);
  const token = randomBytes(32).toString("hex");
  stage = "create_human_session";
  const session = (
    await tx.query(
      "SELECT * FROM hvb.acesso_humano_criar_sessao($1,$2,1,$3,clock_timestamp()+interval '15 minutes',$4,$5)",
      [a.org, user, sha(token), sha(randomUUID()), randomUUID()],
    )
  ).rows[0];
  check(
    "human_session_api_credential_authenticates",
    Boolean(session.sessao_id) && (await auth(token))?.usuario_id === user,
  );
  stage = "issue_recovery";
  await issue("recuperacao");
  const credential = (
    await tx.query(
      "SELECT revogada_em IS NOT NULL AS revoked FROM hvb.credencial WHERE organizacao_id=$1 AND id=$2",
      [a.org, session.credencial_id],
    )
  ).rows[0];
  check("recovery_revokes_previous_credential", credential?.revoked === true);
  check("autenticar_refuses_previous_token", !(await auth(token)));
  check(
    "recovery_pending_without_operational_access",
    (await proof()).estado === "recuperacao_pendente",
  );
  check(
    "existing_api_bearer_preserved",
    (await auth(a.adminToken))?.usuario_id === a.admin,
  );
  check(
    "autenticar_definition_preserved",
    (await authDefinition()) === authBefore,
  );
  await tx.query("ROLLBACK");
  began = false;
  rolledBack = true;
  await tx.query("BEGIN");
  began = true;
  await tx.query("SELECT set_config('hvb.org',$1,true)", [a.org]);
  check(
    "synthetic_user_rolled_back",
    !(
      await tx.query(
        "SELECT 1 FROM hvb.usuario WHERE organizacao_id=$1 AND id=$2",
        [a.org, user],
      )
    ).rowCount,
  );
  await tx.query("ROLLBACK");
  began = false;
  tx.release();
  tx = undefined;
  const app = await buildApp(db);
  try {
    check(
      "ready_against_supabase",
      (await app.inject("/ready")).statusCode === 200,
    );
  } finally {
    await app.close();
  }
} catch (e) {
  const code = (e as { code?: string }).code;
  checks.push({
    check: stage,
    status: "FAIL",
    code:
      code && /^(?:[A-Z0-9]{5}|CHECK_FAILED)$/.test(code) ? code : "REDACTED",
  });
} finally {
  if (tx) {
    try {
      if (began) {
        await tx.query("ROLLBACK");
        rolledBack = true;
      }
    } catch {
      checks.push({ check: "rollback", status: "FAIL", code: "REDACTED" });
    } finally {
      tx.release();
    }
  }
  try {
    await db?.end();
  } catch {
    checks.push({ check: "pool_cleanup", status: "FAIL", code: "REDACTED" });
  }
}
console.log(
  JSON.stringify(
    {
      environment: "Supabase DEV Node/pg verify-full",
      humanHttpE2E: false,
      realEmailSent: false,
      rollback: rolledBack,
      passed: checks.filter((c) => c.status === "PASS").length,
      failed: checks.filter((c) => c.status === "FAIL").length,
      checks,
    },
    null,
    2,
  ),
);
if (checks.some((c) => c.status !== "PASS") || !rolledBack)
  process.exitCode = 1;
