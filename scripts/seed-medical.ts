import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { medicalPermissions } from "../src/domain/medical-record/schemas.ts";
import { medicalScenario } from "./medical-scenario.ts";
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
    [f.org, f.adminRole, medicalPermissions],
  );
  const s = await medicalScenario(app, f.adminToken, f.unit, "seed-c2");
  const response = await app.inject({
    method: "POST",
    url: "/v1/prontuario/versoes",
    headers: {
      authorization: `Bearer ${f.adminToken}`,
      "idempotency-key": "seed-c2-retificacao",
    },
    payload: {
      ...s.common,
      evolucao_id: s.evolution,
      versao_esperada: 1,
      estado: "registrada",
      ocorrida_em: s.body.ocorrida_em,
      conteudo:
        "Retificação fictícia: informação complementar preservando a versão anterior.",
      motivo: "Complementação fictícia DEV",
    },
  });
  if (response.statusCode !== 200) throw new Error(response.body);
  const references = {
    patient: s.patient,
    episode: s.episode,
    evolution: s.evolution,
    firstVersion: s.evolutionVersion,
    currentVersion: response.json().id,
  };
  await writeFile(
    ".local/medical-record-demo.json",
    `${JSON.stringify(references, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed C2 fictício: evolução e retificação com versões preservadas, sem representar atendimento real.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
