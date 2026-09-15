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
  const withdrawal = await s.create(
    "retirada",
    "/terminal/retiradas",
    s.withdrawalBody,
    s.device,
  );
  const references = {
    patient: s.patient,
    episode: s.episode,
    device: s.device,
    label: s.label,
    scan: s.scan,
    origin: s.position,
    destination: s.destination,
    withdrawal,
    commandKey: "seed-c5-terminal-retirada",
  };
  await writeFile(
    ".local/terminal-demo.json",
    `${JSON.stringify(references, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed C5 fictício: leitura e retirada confirmada de duas unidades, saldo 18 na origem e 2 no destino; nenhuma execução clínica.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
