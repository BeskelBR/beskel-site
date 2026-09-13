import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { clinicalPermissions } from "../src/domain/clinical/schemas.ts";
import { clinicalScenario, clinicalTime } from "./clinical-scenario.ts";
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
    throw new Error("Seed restrito à organização fictícia DEV");
  await admin.query(
    "INSERT INTO hvb.papel_permissao(organizacao_id,papel_id,permissao) SELECT $1,$2,unnest($3::text[]) ON CONFLICT DO NOTHING",
    [f.org, f.adminRole, clinicalPermissions],
  );
  const s = await clinicalScenario(app, f.adminToken, f.unit, "seed-m3");
  // Stable event identity is distinct from the transport idempotency key.
  let event: string;
  try {
    event = (
      JSON.parse(await readFile(".local/clinical-demo.json", "utf8")) as {
        event: string;
      }
    ).event;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    event = randomUUID();
    await writeFile(".local/clinical-demo.json", JSON.stringify({ event }), {
      mode: 0o600,
    });
  }
  const r = await app.inject({
    method: "POST",
    url: "/v1/clinica/execucoes",
    headers: {
      authorization: `Bearer ${f.adminToken}`,
      "idempotency-key": "seed-m3-execucao",
    },
    payload: {
      ordem_versao_id: s.version,
      programacao_id: s.schedule,
      evento_referencia: event,
      executada_em: clinicalTime,
      quantidade_aplicada: "1",
      unidade_medida_id: s.measure,
      resultado: "integral",
      situacao_material: "pendente",
      confirmacao_humana: true,
      motivo:
        "Confirmação simulada por seed fictício, sem ato assistencial real",
    },
  });
  if (r.statusCode !== 200) throw new Error(r.body);
  await writeFile(
    ".local/clinical-demo.json",
    `${JSON.stringify({ ...s, event, execution: r.json().id }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed M3 fictício pronto; execução simulada e conciliação de material pendente. Referências privadas em .local/clinical-demo.json.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
