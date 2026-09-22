import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { permissions } from "../src/domain/schemas.ts";
import { dailyScenario } from "./daily-scenario.ts";
const f = JSON.parse(await readFile(".local/dev-access.json", "utf8")) as {
  org: string;
  unit: string;
  adminRole: string;
  adminToken: string;
  nurse: string;
};
const admin = pool(process.env.MIGRATION_DATABASE_URL ?? "", 1),
  db = pool(process.env.DATABASE_URL ?? "", 5),
  app = await buildApp(db);
try {
  assert.equal(
    (await admin.query("SELECT nome FROM hvb.organizacao WHERE id=$1", [f.org]))
      .rows[0]?.nome,
    "Hospital Fictício DEV — sem dados reais",
  );
  await admin.query(
    "INSERT INTO hvb.papel_permissao(organizacao_id,papel_id,permissao) SELECT $1,$2,unnest($3::text[]) ON CONFLICT DO NOTHING",
    [f.org, f.adminRole, permissions],
  );
  const s = await dailyScenario(app, f.adminToken, f.unit, "seed-c16");
  const create = async (
    name: string,
    path: string,
    payload: Record<string, unknown>,
  ) => {
    const r = await app.inject({
      method: "POST",
      url: `/v1${path}`,
      headers: {
        authorization: `Bearer ${f.adminToken}`,
        "idempotency-key": `seed-c16-${name}`,
      },
      payload,
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.json().id as string;
  };

  const common = {
    motivo: "Correção fictícia C16",
    simulacao: true,
    confirmacao_humana: true,
  };
  const successorPeriod = await create(
    "periodo-corrigido",
    `/diarias/periodos/${s.period}/corrigir`,
    {
      ...common,
      pacote_episodio_id: s.association,
      classificacao_episodio_id: s.assignment,
      inicio: "2026-09-01T10:00:00Z",
      fim: "2026-09-01T17:00:00Z",
    },
  );
  await create(
    "periodo-cancelado",
    `/diarias/periodos/${successorPeriod}/cancelar`,
    common,
  );
  const successorAssociation = await create(
    "associacao-corrigida",
    `/diarias/pacotes-episodio/${s.association}/corrigir`,
    {
      ...common,
      pacote_versao_id: s.pkg,
      inicio: "2026-09-01T08:00:00Z",
      fim: "2026-09-02T08:00:00Z",
    },
  );
  await create(
    "associacao-cancelada",
    `/diarias/pacotes-episodio/${successorAssociation}/cancelar`,
    common,
  );
  for (const table of ["revisao_periodo_diaria", "revisao_pacote_episodio"]) {
    assert.equal(
      (
        await admin.query(
          `SELECT count(*)::int n FROM hvb.${table} WHERE episodio_id=$1`,
          [s.episode],
        )
      ).rows[0].n,
      2,
    );
  }
  assert.equal(
    (
      await admin.query(
        "SELECT saldo_base FROM hvb.posicao_estoque WHERE id=$1",
        [s.position],
      )
    ).rows[0].saldo_base,
    "20.000000",
  );
  await writeFile(
    ".local/daily-corrections-demo.json",
    `${JSON.stringify(
      {
        episode: s.episode,
        originalPeriod: s.period,
        successorPeriod,
        originalAssociation: s.association,
        successorAssociation,
        position: s.position,
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  console.log(
    "C16 DEV: associação e período corrigidos e cancelados; quatro revisões, saldo 20, comandos repetíveis sem duplicação.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
