import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { preventivePermissions } from "../src/domain/preventive/schemas.ts";
import { preventiveScenario } from "./preventive-scenario.ts";
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
    [f.org, f.adminRole, preventivePermissions],
  );
  const s = await preventiveScenario(app, f.adminToken, f.unit, "seed-m6b");
  const review = await s.preventive("revisao", "revisoes", {
    ocorrencia_id: s.occurrence,
    observada_em: "2026-02-02T12:00:00Z",
    descricao: "Revisão fictícia de atraso, sem aplicação presumida",
  });
  const application = await s.preventive("aplicacao", "aplicacoes", {
    ocorrencia_id: s.occurrence,
    origem: "externa",
    profissional_informado: "Profissional externo fictício",
    ocorrida_em: "2026-09-01T12:00:00Z",
    referencia: "f23cc58c-5528-4d76-bb31-d4a8da90a243",
    lote_declarado: "Lote fictício declarado",
    fabricante_declarado: "Fabricante fictício declarado",
    evidencia: "Declaração fictícia, não verificada externamente",
  });
  const resolution = await s.preventive("resolucao", "resolucoes", {
    revisao_id: review,
    orientacao: "Registro fictício conferido no cenário DEV",
  });
  const { preventive: _, ...references } = s;
  await writeFile(
    ".local/preventive-demo.json",
    `${JSON.stringify({ ...references, review, application, resolution }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed M6B fictício e idempotente: protocolo, ocorrência, revisão e aplicação externa declarada; nenhum ato ou consumo hospitalar criado.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
