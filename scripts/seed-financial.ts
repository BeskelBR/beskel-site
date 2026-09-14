import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { financialPermissions } from "../src/domain/financial/schemas.ts";
import { financialScenario } from "./financial-scenario.ts";
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
    [f.org, f.adminRole, financialPermissions],
  );
  const s = await financialScenario(app, f.adminToken, f.unit, "seed-m5");
  const item = await s.fin("item-conta", "itens", {
    conta_id: s.account,
    avaliacao_id: s.evaluation,
    responsabilidades: [{ pagador_id: s.payer, valor: "100.00" }],
  });
  const responsibility = (
    await admin.query(
      "SELECT id FROM hvb.responsabilidade WHERE organizacao_id=$1 AND item_conta_id=$2",
      [f.org, item],
    )
  ).rows[0].id;
  const title = await s.fin("titulo", "titulos", {
    pagador_id: s.payer,
    vencimento: "2026-09-30",
    itens: [{ responsabilidade_id: responsibility, valor: "100.00" }],
  });
  const receipt = await s.fin("recebimento", "recebimentos", {
    pagador_id: s.payer,
    meio: "transferencia",
    referencia: "14be6508-c299-4de6-8609-82fcae456501",
    recebido_em: "2026-09-02T12:00:00Z",
    valor: "120.00",
    evidencia: "Somente simulação; nenhum dinheiro transferido",
  });
  const settlement = await s.fin("liquidacao", "liquidacoes", {
    titulo_id: title,
    recebimento_id: receipt,
    valor: "100.00",
  });
  const credit = await s.fin("credito", "creditos", {
    pagador_id: s.payer,
    recebimento_id: receipt,
    valor: "20.00",
  });
  const { fin: _, ...references } = s;
  await writeFile(
    ".local/financial-demo.json",
    `${JSON.stringify({ ...references, item, responsibility, title, receipt, settlement, credit }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed M5 fictício e idempotente: título 100, recebimento simulado 120, liquidação 100 e crédito 20. Nenhuma transação externa.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
