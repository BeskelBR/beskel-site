import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { schedulePermissions } from "../src/domain/schedule/schemas.ts";
import { scheduleScenario } from "./schedule-scenario.ts";
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
    [f.org, f.adminRole, schedulePermissions],
  );
  const s = await scheduleScenario(app, f.adminToken, f.unit, "seed-m6d");
  await s.agenda("confirmacao", "transicoes", {
    agendamento_versao_id: s.appointmentVersion,
    estado_esperado: "planejado",
    estado: "confirmado",
    ocorrida_em: "2026-09-01T09:00:00Z",
  });
  const { agenda: _, ...references } = s;
  await writeFile(
    ".local/schedule-demo.json",
    `${JSON.stringify(references, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed M6D fictício e idempotente: recurso, disponibilidade, agendamento e confirmação; sem execução ou envio externo.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
