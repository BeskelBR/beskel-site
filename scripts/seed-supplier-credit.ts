import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { permissions } from "../src/domain/schemas.ts";
import { supplierCreditScenario } from "./supplier-credit-scenario.ts";
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
  const s = await supplierCreditScenario(app, f.adminToken, f.unit, "seed-c9");
  const application = await s.payable(
    "aplicar",
    "aplicacoes-creditos",
    s.applicationBody,
  );
  const allocation = await s.payable("alocar", "alocacoes-parcelas", {
    parcela_id: s.installments[0]?.id,
    liquidacao_id: application,
    valor: "40.00",
  });
  await writeFile(
    ".local/supplier-credit-demo.json",
    `${JSON.stringify({ supplier: s.supplier, obligation: s.obligation, credit: s.credit, application, allocation, plan: s.plan }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed C9 fictício: crédito 60, aplicação 40 na obrigação e na primeira parcela. Saldo de crédito 20, dívida 60; nenhum pagamento bancário criado.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
