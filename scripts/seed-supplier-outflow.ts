import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { permissions } from "../src/domain/schemas.ts";
import { supplierOutflowScenario } from "./supplier-outflow-scenario.ts";
const f = JSON.parse(await readFile(".local/dev-access.json", "utf8")) as {
  org: string;
  unit: string;
  adminRole: string;
  adminToken: string;
};
const admin = pool(process.env.MIGRATION_DATABASE_URL ?? "", 1),
  db = pool(process.env.DATABASE_URL ?? "", 5),
  app = await buildApp(db);
try {
  const org = await admin.query(
    "SELECT nome FROM hvb.organizacao WHERE id=$1",
    [f.org],
  );
  if (org.rows[0]?.nome !== "Hospital Fictício DEV — sem dados reais")
    throw new Error("Seed restrito à organização sintética original");
  await admin.query(
    "INSERT INTO hvb.papel_permissao(organizacao_id,papel_id,permissao) SELECT $1,$2,unnest($3::text[]) ON CONFLICT DO NOTHING",
    [f.org, f.adminRole, permissions],
  );
  const s = await supplierOutflowScenario(
    app,
    f.adminToken,
    f.unit,
    "seed-c10",
  );
  const reconciliation = await s.payable(
    "conciliar",
    "conciliacoes-saidas",
    s.reconciliationBody,
  );
  await writeFile(
    ".local/supplier-outflow-demo.json",
    `${JSON.stringify({ supplier: s.supplier, obligation: s.obligation, payment: s.payment, outflow: s.outflow, reconciliation, account: s.account }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed C10 fictício: pagamento 60, saída de extrato 100, conciliação 60. Restam 40 no extrato; dívida continua 100, sem liquidação inferida nem operação bancária.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
