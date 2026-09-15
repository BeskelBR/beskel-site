import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { permissions } from "../src/domain/schemas.ts";
import { coreJourney } from "./core-journey.ts";
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
  const s = await coreJourney(app, f.adminToken, f.unit, "seed-c3");
  const references = {
    patient: s.daily.patient,
    episode: s.daily.episode,
    position: s.position,
    execution: s.financial.execution,
    consumption: s.consumption,
    coverage: s.coverage,
    billingItem: s.item,
    evolutionVersion: s.medical.evolutionVersion,
    document: s.portal.document,
    message: s.message,
  };
  await writeFile(
    ".local/core-journey-demo.json",
    `${JSON.stringify(references, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed C3 fictício: mesmo paciente/episódio, consumo com custo, cobertura sem dívida, evolução e documento. Mensagem apenas preparada localmente.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
