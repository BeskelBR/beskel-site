import { readFile } from "node:fs/promises";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { pool, localUrl } from "../src/persistence/database.ts";
import {
  hashPassword,
  temporaryPassword,
  verifyPassword,
} from "../src/domain/human-access/password.ts";

// Conformance probe, not a migration installer or a substitute for backend E2E.
// Requires the already provisioned/corrected schema. No DDL or private-table writes.
// Foundation fixtures and canonical-function effects are always rolled back.
const url = localUrl(process.env.TEST_MIGRATION_DATABASE_URL);
if (new URL(url).pathname !== "/hvb_sistema_test")
  throw new Error("Somente banco local de teste");
const sql = await readFile("migrations/077_human_access_cpf.sql", "utf8");
const expected =
  "a7030dde974cf5072d0c9af0eedcb8502664f85fd09aae3c9a43da4f5d494eac";
if (createHash("sha256").update(sql).digest("hex") !== expected)
  throw new Error("Hash canonico 077 divergente");
const db = pool(url, 1),
  tx = await db.connect().catch(async () => {
    await db.end();
    throw new Error(
      "Conexao de teste indisponivel; confira configuracao privada.",
    );
  });
let transactionStarted = false;
let recoveryEvidence:
  | {
      credentialRevoked: boolean;
      sessionClosed: boolean;
      previousTokenRefused: boolean;
    }
  | undefined;
const checks: { check: string; status: string; code?: string }[] = [];
function ensure(ok: boolean) {
  if (!ok)
    throw Object.assign(new Error("expectation_failed"), {
      code: "EXPECTATION_FAILED",
    });
}
async function check(name: string, work: () => Promise<void>, ready = true) {
  if (!ready) {
    checks.push({ check: name, status: "BLOCKED", code: "DEPENDENCY_FAILED" });
    return false;
  }
  await tx.query("SAVEPOINT probe");
  try {
    await work();
    checks.push({ check: name, status: "PASS" });
    return true;
  } catch (error) {
    await tx.query("ROLLBACK TO SAVEPOINT probe");
    const code = (error as { code?: string }).code;
    checks.push({
      check: name,
      status: "FAIL",
      code:
        code && /^(?:[0-9A-Z]{5}|EXPECTATION_FAILED)$/.test(code)
          ? code
          : "REDACTED",
    });
    return false;
  } finally {
    await tx.query("RELEASE SAVEPOINT probe");
  }
}
const org = randomUUID(),
  foreign = randomUUID(),
  user = randomUUID(),
  role = randomUUID();
const temp = temporaryPassword(),
  phc = await hashPassword(temp);
const definitive = await hashPassword(temporaryPassword());
let tempId = "",
  credential = "",
  tokenHash = "",
  sessionId = "";
async function issue(purpose = "ativacao", loginUser = user) {
  return (
    await tx.query(
      "SELECT * FROM hvb.acesso_humano_emitir_senha_temporaria($1,$2,$3,'probe@example.invalid',$4,$5,'argon2id-phc',clock_timestamp()+interval '30 minutes','Probe sintetico rollback',$6)",
      [org, user, loginUser, purpose, phc, randomUUID()],
    )
  ).rows[0];
}
async function proof(organization = org) {
  return (
    await tx.query(
      "SELECT * FROM hvb.acesso_humano_obter_prova($1,'52998224725')",
      [organization],
    )
  ).rows[0];
}
async function session() {
  tokenHash = createHash("sha256")
    .update(randomBytes(32).toString("hex"))
    .digest("hex");
  const row = (
    await tx.query(
      "SELECT * FROM hvb.acesso_humano_criar_sessao($1,$2,1,$3,clock_timestamp()+interval '15 minutes',$4,$5)",
      [org, user, tokenHash, "a".repeat(64), randomUUID()],
    )
  ).rows[0];
  credential = row.credencial_id;
  sessionId = row.sessao_id;
}
async function authenticates() {
  return Boolean(
    (await tx.query("SELECT * FROM hvb.autenticar($1)", [tokenHash])).rowCount,
  );
}
try {
  // A live PostgreSQL data directory must not be synchronized by OneDrive.
  const dataDirectory = (await tx.query("SHOW data_directory")).rows[0]
    .data_directory as string;
  if (/onedrive/i.test(dataDirectory))
    throw Object.assign(new Error("local_database_under_onedrive"), {
      code: "ONEDRIVE_DATABASE",
    });
  await tx.query("BEGIN");
  transactionStarted = true;
  const installed = (
    await tx.query(
      "SELECT to_regclass('hvb.acesso_humano') IS NOT NULL AS present",
    )
  ).rows[0].present;
  if (!installed) {
    throw Object.assign(new Error("canonical_schema_required"), {
      code: "SCHEMA_NOT_READY",
    });
  }
  const ledger = await tx.query(
    "SELECT hash FROM public.schema_migration WHERE nome='077_human_access_cpf.sql'",
  );
  ensure(ledger.rows[0]?.hash === expected);
  await tx.query("SELECT set_config('hvb.org',$1,true)", [org]);
  await tx.query(
    "INSERT INTO hvb.organizacao(id,nome) VALUES($1,'SINTETICO 077 rollback A'),($2,'SINTETICO 077 rollback B')",
    [org, foreign],
  );
  await tx.query(
    "INSERT INTO hvb.usuario(id,organizacao_id,nome,login) VALUES($1,$2,'SINTETICO 077 sem pessoa real','52998224725')",
    [user, org],
  );
  await tx.query(
    "INSERT INTO hvb.papel(id,organizacao_id,nome) VALUES($1,$2,'SINTETICO 077')",
    [role, org],
  );
  await tx.query(
    "INSERT INTO hvb.permissao(codigo) VALUES('acesso:administrar') ON CONFLICT DO NOTHING",
  );
  await tx.query(
    "INSERT INTO hvb.papel_permissao VALUES($1,$2,'acesso:administrar')",
    [org, role],
  );
  await tx.query(
    "INSERT INTO hvb.usuario_papel(id,organizacao_id,usuario_id,papel_id) VALUES($1,$2,$3,$4)",
    [randomUUID(), org, user, role],
  );
  const issued = await check("ativacao_cpf_valido", async () => {
    tempId = (await issue()).senha_temporaria_id;
    ensure(Boolean(tempId));
  });
  await check("recusa_cpf_invalido", async () => {
    const invalid = randomUUID();
    await tx.query(
      "INSERT INTO hvb.usuario(id,organizacao_id,nome,login) VALUES($1,$2,'SINTETICO invalido','11111111111')",
      [invalid, org],
    );
    await tx.query("SAVEPOINT invalid_cpf");
    let rejected = false;
    try {
      await issue("ativacao", invalid);
    } catch (error) {
      rejected = (error as { code: string }).code === "23514";
      await tx.query("ROLLBACK TO SAVEPOINT invalid_cpf");
    }
    await tx.query("RELEASE SAVEPOINT invalid_cpf");
    ensure(rejected);
  });
  await tx.query("SET LOCAL ROLE hvb_app");
  await check(
    "prova_temporaria_ausente_antes_envio",
    async () => {
      ensure(!(await proof()).temporaria_id);
    },
    issued,
  );
  const sent = await check(
    "confirmacao_envio_e_prova",
    async () => {
      await tx.query(
        "SELECT * FROM hvb.acesso_humano_marcar_senha_temporaria_enviada($1,$2,$3)",
        [org, tempId, randomUUID()],
      );
      ensure((await proof()).temporaria_id === tempId);
    },
    issued,
  );
  await check(
    "temporaria_hash_argon_sem_plaintext",
    async () => {
      const row = await proof();
      ensure(row.temporaria_formato === "argon2id-phc");
      ensure(await verifyPassword(temp, row.temporaria_hash));
      ensure(!JSON.stringify(row).includes(temp));
    },
    sent,
  );
  await check("prova_isolada_A_B", async () => {
    ensure(!(await proof(foreign)));
  });
  const consumed = await check(
    "consumo_canonico_temporaria",
    async () => {
      await tx.query(
        "SELECT * FROM hvb.acesso_humano_consumir_senha_temporaria($1,$2,$3,$4,'argon2id-phc',$5)",
        [org, user, tempId, definitive, randomUUID()],
      );
      const p = await proof();
      ensure(
        p.estado === "ativo" &&
          p.senha_versao === 1 &&
          p.senha_hash === definitive &&
          !p.temporaria_id,
      );
      await tx.query("SAVEPOINT consumed_retry");
      let refused = false;
      try {
        await tx.query(
          "SELECT * FROM hvb.acesso_humano_consumir_senha_temporaria($1,$2,$3,$4,'argon2id-phc',$5)",
          [org, user, tempId, definitive, randomUUID()],
        );
      } catch (error) {
        refused = (error as { code?: string }).code === "23514";
        await tx.query("ROLLBACK TO SAVEPOINT consumed_retry");
      }
      await tx.query("RELEASE SAVEPOINT consumed_retry");
      ensure(refused);
    },
    sent,
  );
  const loggedIn = await check(
    "sessao_api_e_autenticar_apos_consumo",
    async () => {
      await session();
      ensure(await authenticates());
    },
    consumed,
  );
  await check(
    "logout_revoga_apos_consumo",
    async () => {
      await tx.query(
        "SELECT hvb.acesso_humano_encerrar_sessao($1,$2,'Logout probe',$3)",
        [org, credential, randomUUID()],
      );
      ensure(!(await authenticates()));
    },
    loggedIn,
  );
  const blocked = await check(
    "bloqueio_revoga_apos_consumo",
    async () => {
      await session();
      await tx.query(
        "SELECT hvb.acesso_humano_bloquear($1,$2,$2,'Bloqueio probe',$3)",
        [org, user, randomUUID()],
      );
      ensure(!(await authenticates()));
    },
    loggedIn,
  );
  const unblocked = await check(
    "desbloqueio_nao_ressuscita_sessao",
    async () => {
      await tx.query(
        "SELECT hvb.acesso_humano_desbloquear($1,$2,$2,'Desbloqueio probe',$3)",
        [org, user, randomUUID()],
      );
      ensure(!(await authenticates()));
    },
    blocked,
  );
  await check(
    "recuperacao_revoga_sessao_ao_emitir",
    async () => {
      await session();
      ensure(await authenticates());
      await issue("recuperacao");
      const previousTokenRefused = !(await authenticates());
      // Inspection with the test administrator, never granting private reads to runtime.
      await tx.query("RESET ROLE");
      try {
        const state = (
          await tx.query(
            `SELECT c.revogada_em IS NOT NULL AS credential_revoked,
                sh.encerrada_em IS NOT NULL AS session_closed
         FROM hvb.credencial c JOIN hvb.sessao_humana sh
         ON (sh.organizacao_id,sh.credencial_id)=(c.organizacao_id,c.id)
         WHERE c.organizacao_id=$1 AND c.id=$2 AND sh.id=$3 AND sh.usuario_id=$4`,
            [org, credential, sessionId, user],
          )
        ).rows[0];
        recoveryEvidence = {
          credentialRevoked: state?.credential_revoked === true,
          sessionClosed: state?.session_closed === true,
          previousTokenRefused,
        };
        ensure(Object.values(recoveryEvidence).every(Boolean));
      } finally {
        await tx.query("SET LOCAL ROLE hvb_app");
      }
    },
    unblocked,
  );
  for (const scope of ["conta", "origem"]) {
    await check(`rate_limit_${scope}`, async () => {
      const key = createHash("sha256").update(randomUUID()).digest("hex");
      for (let i = 0; i < 3; i++)
        await tx.query(
          "SELECT * FROM hvb.limite_acesso_humano_registrar_falha($1,$2,$3,60,3,60)",
          [org, scope, key],
        );
      const row = (
        await tx.query(
          "SELECT * FROM hvb.limite_acesso_humano_consultar($1,$2,$3)",
          [org, scope, key],
        )
      ).rows[0];
      ensure(row.falhas === 3 && row.bloqueado_ate > new Date());
      await tx.query("SELECT hvb.limite_acesso_humano_limpar($1,$2,$3)", [
        org,
        scope,
        key,
      ]);
      ensure(
        !(
          await tx.query(
            "SELECT * FROM hvb.limite_acesso_humano_consultar($1,$2,$3)",
            [org, scope, key],
          )
        ).rowCount,
      );
    });
  }
} catch (error) {
  const code = (error as { code?: string }).code;
  checks.push({
    check: "setup",
    status: "FAIL",
    code:
      code &&
      (/^[0-9A-Z]{5}$/.test(code) ||
        ["ONEDRIVE_DATABASE", "SCHEMA_NOT_READY"].includes(code))
        ? code
        : "REDACTED",
  });
} finally {
  if (transactionStarted) await tx.query("ROLLBACK");
  tx.release();
  await db.end();
}
console.log(
  JSON.stringify(
    {
      environment: "local PostgreSQL test",
      canonicalHash: expected,
      rollback: transactionStarted,
      recoveryEvidence: recoveryEvidence ?? null,
      backendE2E: false,
      targetChecks: 14,
      passed: checks.filter((c) => c.status === "PASS").length,
      failed: checks.filter((c) => c.status === "FAIL").length,
      blocked: checks.filter((c) => c.status === "BLOCKED").length,
      checks,
    },
    null,
    2,
  ),
);
if (checks.length !== 14 || checks.some((c) => c.status !== "PASS"))
  process.exitCode = 1;
