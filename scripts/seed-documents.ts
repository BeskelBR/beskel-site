import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { documentPermissions } from "../src/domain/documents/schemas.ts";
import { documentScenario } from "./document-scenario.ts";
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
    [f.org, f.adminRole, documentPermissions],
  );
  const s = await documentScenario(app, f.adminToken, f.unit, "seed-m6c");
  const authorization = await s.doc("autorizacao", "autorizacoes", {
    solicitacao_id: s.request,
    decisao: "permitida",
    valida_ate: "2099-12-31T23:59:59Z",
    evidencia: "Autorização fictícia para simulação",
  });
  const document = await s.doc("versao", "versoes", {
    solicitacao_id: s.request,
    modelo_versao_id: s.modelVersion,
    versao_esperada: 0,
    campos: s.fields,
  });
  const approval = await s.doc("aprovacao", "aprovacoes", {
    documento_versao_id: document,
  });
  const time = (
    await admin.query(
      "SELECT criada_em::text instante FROM hvb.aprovacao_documento WHERE id=$1",
      [approval],
    )
  ).rows[0].instante;
  const delivery = await s.doc("entrega", "entregas", {
    documento_versao_id: document,
    destinatario_id: s.responsible,
    entregue_em: time,
    canal: "registro_manual_dev",
    evidencia: "Entrega fictícia registrada; nenhum envio externo",
    referencia: "ee14e91a-c1b8-4b0d-99a0-591fdd0e9f5d",
  });
  const { doc: _, ...references } = s;
  await writeFile(
    ".local/documents-demo.json",
    `${JSON.stringify({ ...references, authorization, document, approval, delivery }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed M6C fictício e idempotente: solicitação, autorização, documento e entrega simulada; conteúdo privado, sem assinatura validada ou envio externo.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
