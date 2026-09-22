import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { permissions } from "../src/domain/schemas.ts";
import { clinicalScenario, clinicalTime } from "./clinical-scenario.ts";
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
  const s = await clinicalScenario(app, f.adminToken, f.unit, "seed-c15");
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
        "idempotency-key": `seed-c15-${name}`,
      },
      payload,
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.json().id as string;
  };
  const originalBody = {
    ordem_versao_id: s.version,
    programacao_id: s.schedule,
    evento_referencia: "c1500000-0000-4000-8000-000000000001",
    executada_em: clinicalTime,
    quantidade_aplicada: "1",
    unidade_medida_id: s.measure,
    resultado: "integral",
    situacao_material: "pendente",
    confirmacao_humana: true,
    motivo: "Demonstração fictícia C15",
  };
  const original = await create(
    "execucao-original",
    "/clinica/execucoes",
    originalBody,
  );
  const successor = await create(
    "contexto",
    `/clinica/execucoes/${original}/corrigir-contexto`,
    {
      ...originalBody,
      evento_referencia: "c1500000-0000-4000-8000-000000000002",
      programacao_id: null,
      executor_id: f.nurse,
      simulacao: true,
    },
  );
  const annulment = await create(
    "anulacao",
    `/clinica/execucoes/${successor}/anular`,
    {
      motivo: "Registro sucessor também declarado indevido — exemplo DEV",
      confirmacao_humana: true,
      simulacao: true,
    },
  );
  const revisions = (
    await admin.query(
      "SELECT count(*)::int n FROM hvb.revisao_execucao WHERE organizacao_id=$1 AND execucao_id=ANY($2::uuid[])",
      [f.org, [original, successor]],
    )
  ).rows[0].n;
  assert.equal(revisions, 2);
  assert.equal(
    (
      await admin.query(
        "SELECT saldo_base FROM hvb.posicao_estoque WHERE id=$1",
        [s.position],
      )
    ).rows[0].saldo_base,
    "20.000000",
  );
  assert.equal(
    (
      await admin.query(
        "SELECT conciliacao_material FROM hvb.execucao_consulta WHERE id=$1",
        [successor],
      )
    ).rows[0].conciliacao_material,
    "anulada",
  );
  await writeFile(
    ".local/clinical-corrections-demo.json",
    `${JSON.stringify({ original, successor, annulment, episode: s.episode, position: s.position }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "C15 DEV: contexto corrigido e sucessora anulada; duas revisões preservadas, saldo 20, repetição pelos mesmos comandos sem duplicação.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
