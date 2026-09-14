import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { examPermissions } from "../src/domain/exams/schemas.ts";
import { examScenario } from "./exam-scenario.ts";
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
    [f.org, f.adminRole, examPermissions],
  );
  const s = await examScenario(app, f.adminToken, f.unit, "seed-m6a");
  const result = await s.exam("resultado", "resultados", {
    item_exame_id: s.examItem,
    versao_esperada: 0,
    produzido_em: "2026-09-01T12:00:00Z",
    referencia: "254be9d4-c8cf-49d3-a80e-eebf63f69d51",
    origem_idade: "desconhecida",
    observacao: "Resultado fictício, sem aplicação clínica",
    valores: s.values,
  });
  const release = await s.exam("liberacao", "liberacoes", {
    resultado_id: result,
    pendencias_confirmadas: true,
  });
  const { exam: _, ...references } = s;
  await writeFile(
    ".local/exams-demo.json",
    `${JSON.stringify({ ...references, result, release }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed M6A fictício e idempotente: resultado estruturado e liberação técnica com referência pendente, sem interpretação clínica ou envio externo.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
