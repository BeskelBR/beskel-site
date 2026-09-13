import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { dailyPermissions } from "../src/domain/daily/schemas.ts";
import { dailyScenario } from "./daily-scenario.ts";
import { clinicalTime } from "./clinical-scenario.ts";
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
    [f.org, f.adminRole, dailyPermissions],
  );
  const s = await dailyScenario(app, f.adminToken, f.unit, "seed-m4");
  let reference: string;
  try {
    reference = (
      JSON.parse(await readFile(".local/daily-demo.json", "utf8")) as {
        reference: string;
      }
    ).reference;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    reference = randomUUID();
    await writeFile(".local/daily-demo.json", JSON.stringify({ reference }), {
      mode: 0o600,
    });
  }
  async function create(name: string, path: string, body: unknown) {
    const r = await app.inject({
      method: "POST",
      url: `/v1${path}`,
      headers: {
        authorization: `Bearer ${f.adminToken}`,
        "idempotency-key": `seed-m4-${name}`,
      },
      payload: body as Record<string, unknown>,
    });
    if (r.statusCode !== 200) throw new Error(r.body);
    return r.json().id as string;
  }
  const execution = await create("execucao", "/clinica/execucoes", {
    ordem_versao_id: s.version,
    programacao_id: s.schedule,
    evento_referencia: reference,
    executada_em: clinicalTime,
    quantidade_aplicada: "1",
    unidade_medida_id: s.measure,
    resultado: "integral",
    situacao_material: "nao_utilizado",
    confirmacao_humana: true,
    motivo: "Execução simulada por seed; sem ato assistencial real",
  });
  const event = await create("evento", "/diarias/eventos", {
    execucao_id: execution,
    motivo: "Origem fictícia para avaliação",
  });
  const evaluation = await create(
    "avaliacao",
    `/diarias/eventos/${event}/avaliar`,
    {
      periodo_diaria_id: s.period,
      versao_esperada: 0,
      motivo: "Inclusão fictícia sem preço ou cobrança",
    },
  );
  await writeFile(
    ".local/daily-demo.json",
    `${JSON.stringify({ ...s, reference, execution, event, evaluation }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed M4 fictício pronto e idempotente. Cobertura somente simulada, sem preço/cobrança. Referências em .local/daily-demo.json.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
