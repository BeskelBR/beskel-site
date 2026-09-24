import { readFile } from "node:fs/promises";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { pool, localUrl } from "../src/persistence/database.ts";
import {
  hashPassword,
  temporaryPassword,
  verifyPassword,
} from "../src/domain/human-access/password.ts";

// Conformance probe, not a migration installer or a substitute for backend E2E.
// All schema/fixtures/roles created here are in ONE transaction, always rolled back.
const url = localUrl(process.env.TEST_MIGRATION_DATABASE_URL);
if (new URL(url).pathname !== "/hvb_sistema_test")
  throw new Error("Somente banco local de teste");
const sql = await readFile("migrations/077_human_access_cpf.sql", "utf8");
const expected =
  "a7030dde974cf5072d0c9af0eedcb8502664f85fd09aae3c9a43da4f5d494eac";
if (createHash("sha256").update(sql).digest("hex") !== expected)
  throw new Error("Hash canonico 077 divergente");
const db = pool(url, 1),
  tx = await db.connect();
const checks: { check: string; status: string; code?: string }[] = [];
function ensure(ok: boolean) {
  if (!ok)
    throw Object.assign(new Error("expectation_failed"), {
      code: "EXPECTATION_FAILED",
    });
}
async function check(name: string, work: () => Promise<void>) {
  await tx.query("SAVEPOINT probe");
  try {
    await work();
    checks.push({ check: name, status: "PASS" });
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
  tokenHash = "";
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
  tokenHash = createHash("sha256").update(randomBytes(32)).digest("hex");
  const row = (
    await tx.query(
      "SELECT * FROM hvb.acesso_humano_criar_sessao($1,$2,1,$3,clock_timestamp()+interval '15 minutes',$4,$5)",
      [org, user, tokenHash, "a".repeat(64), randomUUID()],
    )
  ).rows[0];
  credential = row.credencial_id;
}
async function authenticates() {
  return Boolean(
    (await tx.query("SELECT * FROM hvb.autenticar($1)", [tokenHash])).rowCount,
  );
}
try {
  await tx.query("BEGIN");
  const installed = (
    await tx.query(
      "SELECT to_regclass('hvb.acesso_humano') IS NOT NULL AS present",
    )
  ).rows[0].present;
  if (!installed) {
    for (const name of ["anon", "authenticated", "service_role"]) {
      if (
        !(await tx.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [name]))
          .rowCount
      )
        await tx.query(`CREATE ROLE ${name} NOLOGIN`);
    }
    await tx.query(sql);
  }
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
  await check("ativacao_cpf_valido", async () => {
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
  await check("temporaria_hash_argon_sem_plaintext", async () => {
    const row = (
      await tx.query(
        "SELECT senha_hash,senha_formato FROM hvb.senha_temporaria_humana WHERE id=$1",
        [tempId],
      )
    ).rows[0];
    ensure(await verifyPassword(temp, row.senha_hash));
    ensure(!JSON.stringify(row).includes(temp));
  });
  await tx.query("SET LOCAL ROLE hvb_app");
  await check("prova_temporaria_ausente_antes_envio", async () => {
    ensure(!(await proof()).temporaria_id);
  });
  await check("confirmacao_envio_e_prova", async () => {
    await tx.query(
      "SELECT * FROM hvb.acesso_humano_marcar_senha_temporaria_enviada($1,$2,$3)",
      [org, tempId, randomUUID()],
    );
    ensure((await proof()).temporaria_id === tempId);
  });
  await check("prova_isolada_A_B", async () => {
    ensure(!(await proof(foreign)));
  });
  await check("consumo_canonico_temporaria", async () => {
    await tx.query(
      "SELECT * FROM hvb.acesso_humano_consumir_senha_temporaria($1,$2,$3,$4,'argon2id-phc',$5)",
      [org, user, tempId, definitive, randomUUID()],
    );
    ensure((await proof()).estado === "ativo");
  });
  await tx.query("RESET ROLE");
  // Explicit direct fixture for independent session-function checks. Not proof of activation E2E.
  await tx.query(
    "UPDATE hvb.acesso_humano SET senha_hash=$1,senha_formato='argon2id-phc',senha_versao=1,senha_definida_em=now(),estado='ativo' WHERE organizacao_id=$2 AND usuario_id=$3",
    [definitive, org, user],
  );
  await tx.query("SET LOCAL ROLE hvb_app");
  await check("sessao_api_e_autenticar_fixture_direta", async () => {
    await session();
    ensure(await authenticates());
  });
  await check("logout_revoga_fixture_direta", async () => {
    await tx.query(
      "SELECT hvb.acesso_humano_encerrar_sessao($1,$2,'Logout probe',$3)",
      [org, credential, randomUUID()],
    );
    ensure(!(await authenticates()));
  });
  await check("bloqueio_revoga_fixture_direta", async () => {
    await session();
    await tx.query(
      "SELECT hvb.acesso_humano_bloquear($1,$2,$2,'Bloqueio probe',$3)",
      [org, user, randomUUID()],
    );
    ensure(!(await authenticates()));
  });
  await check("desbloqueio_nao_ressuscita_sessao", async () => {
    await tx.query(
      "SELECT hvb.acesso_humano_desbloquear($1,$2,$2,'Desbloqueio probe',$3)",
      [org, user, randomUUID()],
    );
    ensure(!(await authenticates()));
  });
  await check("recuperacao_revoga_sessao_ao_emitir", async () => {
    await session();
    await issue("recuperacao");
    ensure(!(await authenticates()));
  });
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
    code: code && /^[0-9A-Z]{5}$/.test(code) ? code : "REDACTED",
  });
} finally {
  await tx.query("ROLLBACK");
  tx.release();
  await db.end();
}
console.log(
  JSON.stringify(
    {
      environment: "local PostgreSQL test",
      canonicalHash: expected,
      rollback: true,
      backendE2E: false,
      checks,
    },
    null,
    2,
  ),
);
if (checks.some((c) => c.status === "FAIL")) process.exitCode = 1;
