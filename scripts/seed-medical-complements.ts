import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { permissions } from "../src/domain/schemas.ts";
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
    [f.org, f.adminRole, permissions],
  );
  const s = await medicalScenario(app, f.adminToken, f.unit, "seed-c11");
  const post = async (path: string, body: Record<string, unknown>) => {
    const r = await app.inject({
      method: "POST",
      url: `/v1/prontuario/${path}`,
      headers: {
        authorization: `Bearer ${f.adminToken}`,
        "idempotency-key": `seed-c11-${path}`,
      },
      payload: { ...s.common, ...body },
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.json();
  };
  const model = await post("modelos", {
    codigo: "modelo_ficticio_c11",
    nome: "Relato estruturado fictício",
    tipo: "evolucao",
    versao_esperada: 0,
    campos: [
      { codigo: "relato", rotulo: "Relato fictício", obrigatorio: true },
    ],
  });
  const evolution = await post("evolucoes-modeladas", {
    paciente_id: s.patient,
    episodio_id: s.episode,
    modelo_versao_id: model.id,
    referencia: "c1100000-0000-4000-8000-000000000011",
    ocorrida_em: s.body.ocorrida_em,
    respostas: [
      {
        codigo: "relato",
        valor: "Demonstração sintética violeta. Sem atendimento real.",
      },
    ],
  });
  const note = await app.inject({
    url: `/v1/prontuario/versoes/${evolution.evolucao_versao_id}?unidade_id=${f.unit}`,
    headers: { authorization: `Bearer ${f.adminToken}` },
  });
  assert.equal(note.statusCode, 200, note.body);
  const attachment = await post("anexos", {
    evolucao_versao_id: evolution.evolucao_versao_id,
    hash_evolucao: note.json().hash_conteudo,
    nome: "pixel-ficticio.png",
    mime: "image/png",
    conteudo_base64:
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1kAAAAASUVORK5CYII=",
  });
  const search = await app.inject({
    url: `/v1/prontuario/busca?unidade_id=${f.unit}&paciente_id=${s.patient}&q=violeta`,
    headers: { authorization: `Bearer ${f.adminToken}` },
  });
  assert.equal(search.statusCode, 200, search.body);
  assert.equal(search.json().items.length, 1);
  assert.equal(search.json().items[0].id, evolution.evolucao_versao_id);
  const counts = (
    await admin.query(
      "SELECT (SELECT count(*)::int FROM hvb.preenchimento_modelo_evolucao WHERE evolucao_versao_id=$1) preenchimentos,(SELECT count(*)::int FROM hvb.anexo_evolucao WHERE evolucao_versao_id=$1) anexos",
      [evolution.evolucao_versao_id],
    )
  ).rows[0];
  assert.deepEqual(counts, { preenchimentos: 1, anexos: 1 });
  await writeFile(
    ".local/medical-complements-demo.json",
    `${JSON.stringify({ patient: s.patient, episode: s.episode, model: model.id, evolution: evolution.id, version: evolution.evolucao_versao_id, attachment: attachment.id }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed C11 fictício: modelo, evolução original, um preenchimento e um anexo privado; busca encontrou a versão esperada. Retry preserva os mesmos registros.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
