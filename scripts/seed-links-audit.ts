import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { permissions } from "../src/domain/schemas.ts";
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
    [f.org, f.adminRole, permissions],
  );
  const s = await scheduleScenario(app, f.adminToken, f.unit, "seed-c12");
  await s.agenda("chegada", "transicoes", {
    agendamento_versao_id: s.appointmentVersion,
    estado_esperado: "planejado",
    estado: "chegou",
    ocorrida_em: "2026-09-01T10:00:00Z",
  });
  const link = await s.agenda("vinculo", "vinculos-episodios", {
    agendamento_versao_id: s.appointmentVersion,
    episodio_id: s.episode,
    episodio_versao_esperada: 1,
  });
  const r = await app.inject({
    url: `/v1/agenda/vinculos-episodios?unidade_id=${f.unit}&agendamento_id=${s.appointment}`,
    headers: { authorization: `Bearer ${f.adminToken}` },
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().items.length, 1);
  assert.equal(r.json().items[0].vigente, true);
  const rows = (
    await admin.query(
      "SELECT usuario_id,rota FROM hvb.leitura_auditada WHERE correlation_id=$1",
      [r.headers["x-correlation-id"]],
    )
  ).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].rota, "/v1/agenda/vinculos-episodios");
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.execucao WHERE episodio_id=$1",
        [s.episode],
      )
    ).rows[0].n,
    0,
  );
  await writeFile(
    ".local/links-audit-demo.json",
    `${JSON.stringify({ patient: s.patient, episode: s.episode, appointment: s.appointment, version: s.appointmentVersion, link: link.id, readCorrelation: r.headers["x-correlation-id"] }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed C12 fictício: um vínculo vigente agenda–episódio, nenhuma execução inferida e uma trilha por consulta. Retry preserva vínculo; nova leitura gera novo evento.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
