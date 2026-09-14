import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { purchasePermissions } from "../src/domain/purchases/schemas.ts";
import { purchaseScenario } from "./purchase-scenario.ts";
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
    [f.org, f.adminRole, purchasePermissions],
  );
  const s = await purchaseScenario(app, f.adminToken, f.unit, "seed-c1");
  await s.purchase("aprovacao", "decisoes", {
    pedido_id: s.purchaseOrder,
    estado_esperado: "rascunho",
    estado: "aprovado",
  });
  const receipt = await s.purchase("recebimento", "recebimentos", {
    pedido_id: s.purchaseOrder,
    referencia: s.ref("recebimento"),
    documento_fornecedor: "Comprovante fictício, sem documento fiscal real",
    ocorrido_em: "2026-09-01T12:00:00Z",
    itens: [
      {
        item_pedido_id: s.purchaseItem,
        posicao_id: s.purchasePosition,
        quantidade_apresentacoes: "2",
      },
    ],
  });
  const { purchase: _, ref: __, ...references } = s;
  await writeFile(
    ".local/purchases-demo.json",
    `${JSON.stringify({ ...references, receipt }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed C1 fictício: pedido de cinco caixas, recebimento parcial de duas, 20 unidades físicas na custódia hospitalar; nenhum pagamento ou envio externo.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
