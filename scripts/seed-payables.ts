import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { permissions } from "../src/domain/schemas.ts";
import { payableScenario } from "./payable-scenario.ts";
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
  const s = await payableScenario(app, f.adminToken, f.unit, "seed-c4");
  const payment = await s.payable("pagamento", "pagamentos", {
    fornecedor_id: s.supplier,
    conta_financeira_id: s.account,
    referencia: s.ref("pagamento"),
    pago_em: "2026-09-02T12:00:00Z",
    valor: "60.00",
    evidencia: "Pagamento fictício, sem movimentação externa",
  });
  const settlement = await s.payable("liquidacao", "liquidacoes", {
    obrigacao_id: s.obligation,
    pagamento_id: payment,
    liquidada_em: "2026-09-02T13:00:00Z",
    valor: "60.00",
  });
  const references = {
    supplier: s.supplier,
    purchaseOrder: s.purchaseOrder,
    obligation: s.obligation,
    payment,
    settlement,
    account: s.account,
  };
  await writeFile(
    ".local/payables-demo.json",
    `${JSON.stringify(references, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed C4 fictício: obrigação de 100, pagamento declarado de 60 e liquidação parcial; saldo a pagar 40. Nenhum pagamento real ou entrada física.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
