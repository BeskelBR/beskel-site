import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { permissions } from "../src/domain/schemas.ts";
import { installmentScenario } from "./installment-scenario.ts";
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
  const s = await installmentScenario(app, f.adminToken, f.unit, "seed-c8");
  const { payment, settlement } = await s.settle("demo");
  const first = await s.payable("alocacao-1", "alocacoes-parcelas", {
    parcela_id: s.installments[0]?.id,
    liquidacao_id: settlement,
    valor: "40.00",
  });
  const second = await s.payable("alocacao-2", "alocacoes-parcelas", {
    parcela_id: s.installments[1]?.id,
    liquidacao_id: settlement,
    valor: "20.00",
  });
  await writeFile(
    ".local/installments-demo.json",
    `${JSON.stringify({ obligation: s.obligation, plan: s.plan, installments: s.installments, payment, settlement, first, second }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed C8 fictício: obrigação 100, parcelas 40/60, liquidação declarada 60 e alocações 40/20. Saldos das parcelas 0/40. Sem pagamento real ou dívida duplicada.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
