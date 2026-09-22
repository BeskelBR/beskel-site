import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { permissions } from "../src/domain/schemas.ts";
import { terminalScenario } from "./terminal-scenario.ts";
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
  const s = await terminalScenario(app, f.adminToken, f.unit, "seed-c5");
  // C14: seed legado demonstra apenas identificação; não cria nova retirada.
  const references = {
    patient: s.patient,
    episode: s.episode,
    device: s.device,
    label: s.label,
    scan: s.scan,
    origin: s.position,
    destination: s.destination,
    legado: true,
    commandKey: "seed-c5-terminal-leitura",
  };
  await writeFile(
    ".local/terminal-demo.json",
    `${JSON.stringify(references, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed legado C5: contexto identificado. Novas retiradas descontinuadas pelo C14; histórico preservado.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
