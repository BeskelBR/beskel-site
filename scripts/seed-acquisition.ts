import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { permissions } from "../src/domain/schemas.ts";
import { acquisitionScenario } from "./acquisition-scenario.ts";
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
  const s = await acquisitionScenario(app, f.adminToken, f.unit, "seed-c7");
  const first = await s.receipt("parcial", "2"),
    second = await s.receipt("final", "3");
  const firstCost = await s.purchase("custo-parcial", "custos-recebimentos", {
    item_rateio_id: s.allocationItem,
    recebimento_item_id: first,
    valor: "42.00",
  });
  const secondCost = await s.purchase("custo-final", "custos-recebimentos", {
    item_rateio_id: s.allocationItem,
    recebimento_item_id: second,
    valor: "63.00",
  });
  await writeFile(
    ".local/acquisition-demo.json",
    `${JSON.stringify({ purchaseOrder: s.purchaseOrder, pricing: s.pricing, allocation: s.allocation, allocationItem: s.allocationItem, first, second, firstCost, secondCost }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed C7 fictício: rateio 105, duas entradas de 2 e 3 caixas, custos atribuídos 42 e 63. Quantidade física 50 unidades; custo original do lote 1,25 preservado. Sem operação externa.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
