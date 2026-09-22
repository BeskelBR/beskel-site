import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { permissions } from "../src/domain/schemas.ts";
import { bankCorrectionsScenario } from "./bank-corrections-scenario.ts";
const f = JSON.parse(await readFile(".local/dev-access.json", "utf8")) as {
  org: string;
  unit: string;
  adminRole: string;
  adminToken: string;
  nurse: string;
};
const admin = pool(process.env.MIGRATION_DATABASE_URL ?? "", 1),
  db = pool(process.env.DATABASE_URL ?? "", 5),
  app = await buildApp(db);
try {
  assert.equal(
    (await admin.query("SELECT nome FROM hvb.organizacao WHERE id=$1", [f.org]))
      .rows[0]?.nome,
    "Hospital Fictício DEV — sem dados reais",
  );
  await admin.query(
    "INSERT INTO hvb.papel_permissao(organizacao_id,papel_id,permissao) SELECT $1,$2,unnest($3::text[]) ON CONFLICT DO NOTHING",
    [f.org, f.adminRole, permissions],
  );
  const s = await bankCorrectionsScenario(
    app,
    f.adminToken,
    f.unit,
    "seed-c17",
  );
  const c = await s.fin("conciliacao", "conciliacoes", {
    deposito_id: s.deposit,
    extrato_id: s.statement,
    valor: "97.00",
    evidencia: "Conferência fictícia",
  });
  await s.fin("reverter-conciliacao", "reversoes", { conciliacao_id: c });
  const reopened = await s.fin(
    "refazer-conciliacao",
    `conciliacoes/${c}/refazer`,
    { valor: "90.00", evidencia: "Conferência refeita" },
  );
  await s.fin("reverter-refeita", "reversoes", { conciliacao_id: reopened });
  const a = await s.fin("alocacao", "alocacoes-deposito", {
    deposito_id: s.deposit,
    parcela_id: s.parcel,
    valor: "97.00",
  });
  await s.fin("reverter-alocacao", "reversoes", { alocacao_deposito_id: a });
  const reallocated = await s.fin(
    "refazer-alocacao",
    `alocacoes-deposito/${a}/refazer`,
    { valor: "90.00" },
  );
  await s.fin("reverter-refeita-alocacao", "reversoes", {
    alocacao_deposito_id: reallocated,
  });
  const deposit = await s.fin(
    "corrigir-deposito",
    `depositos/${s.deposit}/corrigir`,
    { ...s.depositBody, valor: "90.00" },
  );
  const statement = await s.fin(
    "corrigir-extrato",
    `extrato/${s.statement}/corrigir`,
    { ...s.statementBody, valor: "90.00" },
  );
  await s.fin("cancelar-deposito", `depositos/${deposit}/cancelar`, {});
  await s.fin("cancelar-extrato", `extrato/${statement}/cancelar`, {});
  for (const [table, field, ids] of [
    ["revisao_deposito_adquirente", "deposito_id", [s.deposit, deposit]],
    ["revisao_item_extrato", "extrato_id", [s.statement, statement]],
  ] as const) {
    assert.equal(
      (
        await admin.query(
          `SELECT count(*)::int n FROM hvb.${table} WHERE ${field}=ANY($1::uuid[])`,
          [ids],
        )
      ).rows[0].n,
      2,
    );
  }
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.vinculo_conciliacao WHERE deposito_id=$1",
        [s.deposit],
      )
    ).rows[0].n,
    2,
  );
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.alocacao_deposito WHERE deposito_id=$1",
        [s.deposit],
      )
    ).rows[0].n,
    2,
  );
  assert.equal(
    (
      await admin.query(
        "SELECT saldo FROM hvb.parcela_adquirente_consulta WHERE id=$1",
        [s.parcel],
      )
    ).rows[0].saldo,
    "97.00",
  );
  assert.equal(
    (
      await admin.query(
        "SELECT disponivel FROM hvb.recebimento_consulta WHERE id=$1",
        [s.payment],
      )
    ).rows[0].disponivel,
    "100.00",
  );
  await writeFile(
    ".local/financial-corrections-demo.json",
    `${JSON.stringify({ originalDeposit: s.deposit, originalStatement: s.statement, deposit, statement, reopened, reallocated, payment: s.payment, parcel: s.parcel }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "C17 DEV: quatro revisões; conciliação e alocação refeitas com histórico; parcela 97 e recebimento 100 preservados, sem duplicação.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
