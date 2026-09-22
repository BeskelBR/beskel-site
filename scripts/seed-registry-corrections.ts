import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { permissions } from "../src/domain/schemas.ts";
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
  const post = async (
    name: string,
    path: string,
    payload: Record<string, unknown>,
  ) => {
    const r = await app.inject({
      method: "POST",
      url: `/v1${path}`,
      headers: {
        authorization: `Bearer ${f.adminToken}`,
        "idempotency-key": `seed-c13-${name}`,
      },
      payload,
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.json().id as string;
  };
  const common = {
    versao_esperada: 0,
    motivo: "Correção fictícia C13",
    simulacao: true,
    confirmacao_humana: true,
  };
  const patient = await post("paciente", "/pacientes", {
    nome: "Paciente fictício C13 original",
    especie_codigo: "desconhecida",
    estado_vital: "desconhecido",
  });
  await post("revisar-paciente", `/pacientes/${patient}/revisoes`, {
    ...common,
    dados: {
      nome: "Paciente fictício C13 revisado",
      especie_codigo: "canina",
      estado_vital: "vivo",
    },
  });
  const local = await post("local", "/locais", {
    unidade_id: f.unit,
    nome: "Box fictício C13",
    tipo: "box",
    capacidade: 2,
  });
  await post("revisar-local", `/locais/${local}/revisoes`, {
    ...common,
    unidade_id: f.unit,
    dados: { nome: "Box fictício C13 revisado", capacidade: 1 },
  });
  const user = await post("usuario", "/usuarios", {
    nome: "Pessoa fictícia C13",
    login: "correcao.c13.dev",
  });
  const role = await post("papel", "/papeis", {
    nome: "Consulta fictícia C13",
    permissoes: ["cadastros:ler"],
  });
  const assignment = await post("atribuicao", "/atribuicoes", {
    usuario_id: user,
    papel_id: role,
  });
  await post("revogar", `/atribuicoes/${assignment}/revisoes`, {
    ...common,
    ativo: false,
  });
  await post("restaurar", `/atribuicoes/${assignment}/revisoes`, {
    ...common,
    versao_esperada: 1,
    ativo: true,
  });
  for (const [path, count] of [
    [`/pacientes/${patient}/revisoes`, 1],
    [`/locais/${local}/revisoes?unidade_id=${f.unit}`, 1],
    [`/atribuicoes/${assignment}/revisoes`, 2],
  ] as const) {
    const r = await app.inject({
      url: `/v1${path}`,
      headers: { authorization: `Bearer ${f.adminToken}` },
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().versao, count);
    assert.equal(r.json().items.length, count);
  }
  await writeFile(
    ".local/registry-corrections-demo.json",
    `${JSON.stringify({ patient, local, user, role, assignment }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed C13 fictício: paciente e capacidade revisados; atribuição revogada e restaurada com histórico. Retry conserva uma revisão por cadastro e duas transições de acesso.",
  );
} finally {
  await app.close();
  await db.end();
  await admin.end();
}
