import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { inventoryPermissions } from "../src/domain/inventory/schemas.ts";
const f = JSON.parse(await readFile(".local/dev-access.json", "utf8")) as {
  org: string;
  unit: string;
  adminRole: string;
  adminToken: string;
};
const admin = pool(process.env.MIGRATION_DATABASE_URL ?? "", 1),
  db = pool(process.env.DATABASE_URL ?? "", 5);
const app = await buildApp(db);
try {
  const org = await admin.query(
    "SELECT nome FROM hvb.organizacao WHERE id=$1",
    [f.org],
  );
  if (org.rows[0]?.nome !== "Hospital Fictício DEV — sem dados reais")
    throw new Error("Seed somente sobre organização fictícia original.");
  await admin.query(
    "INSERT INTO hvb.papel_permissao(organizacao_id,papel_id,permissao) SELECT $1,$2,unnest($3::text[]) ON CONFLICT DO NOTHING",
    [f.org, f.adminRole, inventoryPermissions],
  );
  async function create(name: string, path: string, body: unknown) {
    const r = await app.inject({
      method: "POST",
      url: `/v1${path}`,
      headers: {
        authorization: `Bearer ${f.adminToken}`,
        "idempotency-key": `seed-m2-${name}`,
      },
      payload: body as Record<string, unknown>,
    });
    if (r.statusCode !== 200) throw new Error(`${name}: ${r.body}`);
    return r.json().id as string;
  }
  const unit = await create("unidade", "/estoque/unidades", {
    simbolo: "un-ficticia-m2",
    dimensao: "contagem",
    fator_referencia: "1",
  });
  const product = await create("produto", "/estoque/produtos", {
    nome: "Material Fictício M2",
    unidade_base_id: unit,
    finalidade: "Simulação de rastreabilidade",
  });
  const presentation = await create("apresentacao", "/estoque/apresentacoes", {
    produto_id: product,
    codigo: "CAIXA-FICTICIA-10",
    versao: 1,
    unidade_conteudo_id: unit,
    quantidade_conteudo: "10",
    fator_unidade_base: "10",
  });
  const lot = await create("lote", "/estoque/lotes", {
    apresentacao_id: presentation,
    fabricante: "Fabricante Fictício DEV",
    codigo: "LOTE-FICTICIO-M2-001",
    situacao_validade: "conhecida",
    validade: "2099-12-31",
    custo_base: "1.25",
  });
  const custody = await create("custodia", "/estoque/custodias", {
    tipo: "hospital",
  });
  const storage = await create("armario", "/locais", {
    nome: "Armário Fictício M2",
    unidade_id: f.unit,
    tipo: "armario",
    capacidade: 0,
  });
  const tray = await create("bandeja", "/locais", {
    nome: "Bandeja Fictícia M2",
    unidade_id: f.unit,
    tipo: "armario",
    capacidade: 0,
  });
  const origin = await create("origem", "/estoque/posicoes", {
    local_id: storage,
    lote_id: lot,
    custodia_id: custody,
  });
  const destination = await create("destino", "/estoque/posicoes", {
    local_id: tray,
    lote_id: lot,
    custodia_id: custody,
  });
  const entry = await create("entrada", "/estoque/entradas", {
    posicao_id: origin,
    quantidade_apresentacoes: "2",
    ocorrido_em: "2026-09-01T12:00:00Z",
    motivo: "Entrada fictícia de demonstração M2",
  });
  await writeFile(
    ".local/inventory-demo.json",
    `${JSON.stringify({ unit_id: f.unit, product, presentation, lot, custody, origin, destination, entry }, null, 2)}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Seed M2 fictício pronto. Repetição idempotente; referências em .local/inventory-demo.json.",
  );
} finally {
  await app.close();
  await admin.end();
  await db.end();
}
