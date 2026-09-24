import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.ts";
import { pool, localUrl } from "../src/persistence/database.ts";
import { seedFixture } from "../scripts/seed.ts";
import { digest } from "../src/domain/core.ts";

let app: FastifyInstance, db: pg.Pool, admin: pg.Pool;
let f: Awaited<ReturnType<typeof seedFixture>>, foreign: typeof f;
let presentation: string, local: string;
const post = (
  path: string,
  body: Record<string, unknown>,
  key = randomUUID(),
  token = f.adminToken,
) =>
  app.inject({
    method: "POST",
    url: `/v1${path}`,
    payload: body,
    headers: { authorization: `Bearer ${token}`, "idempotency-key": key },
  });
const get = (path: string, token = f.adminToken) =>
  app.inject({
    url: `/v1${path}`,
    headers: { authorization: `Bearer ${token}` },
  });
async function create(
  path: string,
  body: Record<string, unknown>,
  token = f.adminToken,
) {
  const response = await post(path, body, randomUUID(), token);
  assert.equal(response.statusCode, 200, response.body);
  return response.json().id as string;
}
const entry = () => ({
  unidade_id: f.unit,
  local_id: local,
  lote: {
    apresentacao_id: presentation,
    fabricante: "Fictício",
    codigo: randomUUID(),
    situacao_validade: "conhecida",
    validade: "2099-12-31",
    custo_base: "1.25",
  },
  quantidade_apresentacoes: "2",
  ocorrido_em: "2026-09-01T12:00:00Z",
  motivo: "Entrada sintética",
});
before(async () => {
  const url = localUrl(process.env.TEST_MIGRATION_DATABASE_URL);
  assert.equal(new URL(url).pathname, "/hvb_sistema_test");
  const runtime = localUrl(process.env.TEST_DATABASE_URL);
  assert.equal(new URL(runtime).pathname, "/hvb_sistema_test");
  f = await seedFixture(url);
  foreign = await seedFixture(url);
  db = pool(runtime, 5);
  admin = pool(url, 1);
  app = await buildApp(db);
  const measure = await create("/estoque/unidades", {
    simbolo: randomUUID(),
    dimensao: "contagem",
    fator_referencia: "1",
  });
  const product = await create("/estoque/produtos", {
    nome: "Produto sintético",
    unidade_base_id: measure,
    finalidade: "Teste",
  });
  presentation = await create("/estoque/apresentacoes", {
    produto_id: product,
    codigo: "CX",
    versao: 1,
    unidade_conteudo_id: measure,
    quantidade_conteudo: "10",
    fator_unidade_base: "10",
  });
  local = await create("/locais", {
    unidade_id: f.unit,
    nome: "Local sintético",
    tipo: "armario",
    capacidade: 0,
  });
});
after(async () => {
  await app?.close();
  await Promise.all([db?.end(), admin?.end()]);
});

test("permissões do papel: conteúdo exato, acesso global e isolamento organizacional", async () => {
  const role = await create("/papeis", {
    nome: "Consulta sintética",
    permissoes: ["estoque:ler", "cadastros:ler"],
  });
  const result = await get(`/papeis/${role}/permissoes`);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.json().permissoes, ["cadastros:ler", "estoque:ler"]);
  assert.equal(
    (await get(`/papeis/${role}/permissoes`, f.readerToken)).statusCode,
    403,
  );
  assert.equal(
    (await get(`/papeis/${role}/permissoes`, foreign.adminToken)).statusCode,
    404,
  );
});

test("onboarding cria usuário e atribuições uma vez, sem credencial; replay concorrente", async () => {
  const body = {
    nome: "Pessoa sintética",
    login: `teste.${randomUUID()}`,
    motivo: "Cadastro sintético",
    atribuicoes: [
      { papel_id: f.adminRole },
      { papel_id: f.adminRole, unidade_id: f.unit },
    ],
  };
  const key = randomUUID();
  const results = await Promise.all([
    post("/usuarios/onboarding", body, key),
    post("/usuarios/onboarding", body, key),
  ]);
  for (const result of results)
    assert.equal(result.statusCode, 200, result.body);
  assert.ok(results[0] && results[1]);
  const a = results[0].json(),
    b = results[1].json();
  assert.equal(a.usuario_id, b.usuario_id);
  assert.equal(a.id, a.usuario_id);
  assert.equal(a.atribuicao_ids.length, 2);
  assert.notEqual(a.repetido, b.repetido);
  assert.equal(
    (
      await admin.query("SELECT 1 FROM hvb.credencial WHERE usuario_id=$1", [
        a.id,
      ])
    ).rowCount,
    0,
  );
  assert.equal(
    (await post("/usuarios/onboarding", { ...body, nome: "Diferente" }, key))
      .statusCode,
    409,
  );
});

test("onboarding inválido reverte usuário/atribuições/comando; rejeita privilégios apenas de unidade", async () => {
  const key = randomUUID(),
    login = `teste.${randomUUID()}`;
  const body = {
    nome: "Pessoa rollback",
    login,
    motivo: "Teste",
    atribuicoes: [{ papel_id: f.adminRole }, { papel_id: foreign.adminRole }],
  };
  assert.equal((await post("/usuarios/onboarding", body, key)).statusCode, 409);
  assert.equal(
    (
      await admin.query(
        "SELECT 1 FROM hvb.usuario WHERE organizacao_id=$1 AND login=$2",
        [f.org, login],
      )
    ).rowCount,
    0,
  );
  assert.equal(
    (
      await admin.query(
        "SELECT 1 FROM hvb.comando WHERE organizacao_id=$1 AND chave=$2",
        [f.org, key],
      )
    ).rowCount,
    0,
  );
  const role = await create("/papeis", {
    nome: "Escopo unitário",
    permissoes: [
      "acesso:administrar",
      "estoque:catalogar",
      "estoque:movimentar",
      "estoque:ler",
    ],
  });
  await create("/atribuicoes", {
    usuario_id: f.reader,
    papel_id: role,
    unidade_id: f.unit,
  });
  assert.equal(
    (await post("/usuarios/onboarding", body, randomUUID(), f.readerToken))
      .statusCode,
    403,
  );
  assert.equal(
    (await get(`/papeis/${role}/permissoes`, f.readerToken)).statusCode,
    403,
  );
  assert.equal((await get("/estoque/produtos", f.readerToken)).statusCode, 403);
  assert.equal(
    (
      await post(
        "/estoque/entradas-completas",
        entry(),
        randomUUID(),
        f.readerToken,
      )
    ).statusCode,
    403,
  );
});

test("onboarding com NFC é atômico, idempotente e mantém apenas digest da tag", async () => {
  const role = await create("/papeis", {
    nome: "Acesso Terminal",
    permissoes: ["terminal:acessar"],
  });
  const body = {
    nome: "Pessoa NFC",
    login: `nfc.${randomUUID()}`,
    motivo: "Teste sintético NFC",
    atribuicoes: [{ papel_id: role, unidade_id: f.unit }],
    nfc: { unidade_id: f.unit, tag: randomUUID() },
  };
  const key = randomUUID();
  const responses = await Promise.all([
    post("/usuarios/onboarding", body, key),
    post("/usuarios/onboarding", body, key),
  ]);
  for (const r of responses) assert.equal(r.statusCode, 200, r.body);
  assert.ok(responses[0] && responses[1]);
  const a = responses[0].json(),
    b = responses[1].json();
  assert.equal(a.nfc_id, b.nfc_id);
  assert.notEqual(a.repetido, b.repetido);
  const row = (
    await admin.query(
      "SELECT employee_id,tag_digest,comando_id FROM hvb.tv1_nfc WHERE id=$1",
      [a.nfc_id],
    )
  ).rows[0];
  assert.equal(row.employee_id, a.usuario_id);
  assert.equal(row.tag_digest, digest(body.nfc.tag));
  assert.equal(row.comando_id, a.comando_id);
  assert.equal(JSON.stringify(a).includes(body.nfc.tag), false);
  const persisted = await admin.query(
    "SELECT resultado FROM hvb.comando WHERE id=$1",
    [a.comando_id],
  );
  assert.equal(JSON.stringify(persisted.rows).includes(body.nfc.tag), false);
  assert.equal(
    (
      await admin.query("SELECT 1 FROM hvb.credencial WHERE usuario_id=$1", [
        a.usuario_id,
      ])
    ).rowCount,
    0,
  );
  // A tag already bound cannot leave a second employee or assignments behind.
  const duplicate = { ...body, login: `nfc.${randomUUID()}` };
  assert.equal((await post("/usuarios/onboarding", duplicate)).statusCode, 409);
  assert.equal(
    (
      await admin.query(
        "SELECT 1 FROM hvb.usuario WHERE organizacao_id=$1 AND login=$2",
        [f.org, duplicate.login],
      )
    ).rowCount,
    0,
  );
});

test("consulta administrativa NFC pagina, acompanha revogação e isola identidade sem expor tag", async () => {
  const body = {
    nome: "Pessoa consulta NFC",
    login: `nfc.${randomUUID()}`,
    motivo: "Teste sintético",
    atribuicoes: [{ papel_id: f.adminRole }],
    nfc: { unidade_id: f.unit, tag: randomUUID() },
  };
  const r = await post("/usuarios/onboarding", body);
  assert.equal(r.statusCode, 200, r.body);
  const user = r.json();
  await create("/terminal/v1/employee-nfc", {
    employee_id: user.id,
    unidade_id: f.unit,
    tag: randomUUID(),
    motivo: "Outro cartão",
  });
  await create(`/terminal/v1/employee-nfc/${user.nfc_id}/revoke`, {
    unidade_id: f.unit,
    motivo: "Cartão perdido",
  });
  const first = await get(`/usuarios/${user.id}/nfc?limit=1`);
  assert.equal(first.statusCode, 200, first.body);
  assert.equal(first.json().items.length, 1);
  assert.ok(first.json().next_cursor);
  const second = await get(
    `/usuarios/${user.id}/nfc?limit=1&cursor=${first.json().next_cursor}`,
  );
  assert.equal(second.statusCode, 200);
  assert.equal(second.json().next_cursor, null);
  const cards = [...first.json().items, ...second.json().items];
  assert.equal(new Set(cards.map((c) => c.id)).size, 2);
  assert.equal(cards.find((c) => c.id === user.nfc_id).revogado, true);
  assert.equal(cards.filter((c) => !c.revogado).length, 1);
  for (const card of cards)
    assert.deepEqual(Object.keys(card).sort(), [
      "id",
      "revogado",
      "unidade_id",
    ]);
  assert.equal((await get(`/usuarios/${foreign.admin}/nfc`)).statusCode, 404);
  assert.equal(
    (await get(`/usuarios/${user.id}/nfc`, f.readerToken)).statusCode,
    403,
  );
  assert.equal(
    (await get(`/usuarios/${user.id}/nfc?limit=101`)).statusCode,
    400,
  );
});

test("NFC recusa falta de acesso ao Terminal e unidade de outra organização sem cadastro parcial", async () => {
  const role = await create("/papeis", {
    nome: "Terminal unitário",
    permissoes: ["terminal:acessar"],
  });
  for (const sample of [
    { papel: f.readerRole, unidade: f.unit, expected: 403 },
    { papel: role, unidade: foreign.unit, expected: 403 },
  ]) {
    const login = `nfc.${randomUUID()}`,
      key = randomUUID();
    const r = await post(
      "/usuarios/onboarding",
      {
        nome: "Pessoa rollback NFC",
        login,
        motivo: "Teste sintético",
        atribuicoes: [{ papel_id: sample.papel, unidade_id: f.unit }],
        nfc: { unidade_id: sample.unidade, tag: randomUUID() },
      },
      key,
    );
    assert.equal(r.statusCode, sample.expected, r.body);
    assert.equal(
      (
        await admin.query(
          "SELECT 1 FROM hvb.usuario WHERE organizacao_id=$1 AND login=$2",
          [f.org, login],
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await admin.query(
          "SELECT 1 FROM hvb.comando WHERE organizacao_id=$1 AND chave=$2",
          [f.org, key],
        )
      ).rowCount,
      0,
    );
  }
});

test("entrada completa cria lote/custódia/posição/ledger atomicamente e reutiliza custódia", async () => {
  const body = entry(),
    key = randomUUID();
  const responses = await Promise.all([
    post("/estoque/entradas-completas", body, key),
    post("/estoque/entradas-completas", body, key),
  ]);
  for (const response of responses)
    assert.equal(response.statusCode, 200, response.body);
  assert.ok(responses[0] && responses[1]);
  const result = responses[0].json();
  assert.equal(result.transacao_id, responses[1].json().transacao_id);
  assert.equal(
    (
      await admin.query(
        "SELECT saldo_base FROM hvb.posicao_estoque WHERE id=$1",
        [result.posicao_id],
      )
    ).rows[0].saldo_base,
    "20.000000",
  );
  assert.equal(
    (
      await admin.query(
        "SELECT sum(quantidade_assinada)::text AS total FROM hvb.lancamento_estoque WHERE posicao_id=$1",
        [result.posicao_id],
      )
    ).rows[0].total,
    "20.000000",
  );
  const another = await post("/estoque/entradas-completas", entry());
  assert.equal(another.statusCode, 200, another.body);
  assert.equal(another.json().custodia_id, result.custodia_id);
  assert.equal(
    (
      await post(
        "/estoque/entradas-completas",
        { ...body, quantidade_apresentacoes: "3" },
        key,
      )
    ).statusCode,
    409,
  );
});

test("falha tardia de entrada reverte lote e posição; recusa unidade incompatível", async () => {
  const body = { ...entry(), quantidade_apresentacoes: "0" };
  const result = await post("/estoque/entradas-completas", body);
  assert.equal(result.statusCode, 400, result.body);
  assert.equal(
    (
      await admin.query(
        "SELECT 1 FROM hvb.lote WHERE organizacao_id=$1 AND codigo=$2",
        [f.org, body.lote.codigo],
      )
    ).rowCount,
    0,
  );
  assert.equal(
    (
      await post("/estoque/entradas-completas", {
        ...entry(),
        unidade_id: foreign.unit,
      })
    ).statusCode,
    404,
  );
});

test("lote novo vinculado a pedido reutiliza recebimento e bloqueia pedido não aprovado", async () => {
  const common = {
    unidade_id: f.unit,
    motivo: "Teste compra",
    simulacao: true,
    confirmacao_humana: true,
  };
  const supplier = await create("/compras/fornecedores", {
    ...common,
    nome: "Fornecedor sintético",
    referencia: randomUUID(),
  });
  const order = await create("/compras/pedidos", {
    ...common,
    fornecedor_id: supplier,
    referencia: randomUUID(),
    observacao: "Teste",
    itens: [{ apresentacao_id: presentation, quantidade_apresentacoes: "5" }],
  });
  const items = await get(
    `/compras/itens?unidade_id=${f.unit}&pedido_id=${order}`,
  );
  assert.equal(items.statusCode, 200);
  const body = {
    ...entry(),
    compra: {
      pedido_id: order,
      item_pedido_id: items.json().items[0].id,
      referencia: randomUUID(),
      documento_fornecedor: "Fictício",
      simulacao: true,
      confirmacao_humana: true,
    },
  };
  const key = randomUUID();
  assert.equal(
    (await post("/estoque/entradas-completas", body, key)).statusCode,
    409,
  );
  assert.equal(
    (
      await admin.query(
        "SELECT 1 FROM hvb.lote WHERE organizacao_id=$1 AND codigo=$2",
        [f.org, body.lote.codigo],
      )
    ).rowCount,
    0,
  );
  await create("/compras/decisoes", {
    ...common,
    pedido_id: order,
    estado_esperado: "rascunho",
    estado: "aprovado",
  });
  const result = await post("/estoque/entradas-completas", body, key);
  assert.equal(result.statusCode, 200, result.body);
  const receipt = await admin.query(
    "SELECT recebimento_id FROM hvb.recebimento_compra_item WHERE id=$1",
    [result.json().transacao_id],
  );
  assert.equal(receipt.rows[0].recebimento_id, result.json().recebimento_id);
  assert.equal(
    (await post("/estoque/entradas-completas", body, key)).json().repetido,
    true,
  );
});

test("busca de pacientes é server-side, literal e paginada, com isolamento e UUID", async () => {
  const name = `Luna_${randomUUID()}`;
  const body = { nome: name, especie_codigo: "felina", estado_vital: "vivo" };
  const ids = [
    await create("/pacientes", body),
    await create("/pacientes", body),
  ];
  await create("/pacientes", body, foreign.adminToken);
  const first = await get(`/pacientes?q=${name.toUpperCase()}&limit=1`);
  assert.equal(first.statusCode, 200);
  assert.equal(first.json().items.length, 1);
  assert.ok(first.json().next_cursor);
  const second = await get(
    `/pacientes?q=${name}&limit=1&cursor=${first.json().next_cursor}`,
  );
  assert.equal(second.json().items.length, 1);
  assert.equal(second.json().next_cursor, null);
  assert.deepEqual(
    [first.json().items[0].id, second.json().items[0].id].sort(),
    ids.sort(),
  );
  assert.equal(
    (await get(`/pacientes?q=${ids[0]}`)).json().items[0].id,
    ids[0],
  );
  assert.equal((await get("/pacientes?q=%25")).json().items.length, 0);
  assert.equal((await get("/pacientes?q=%20%20")).statusCode, 400);
  assert.equal(
    (await get("/pacientes?q=%27%20OR%20true--")).json().items.length,
    0,
  );
});
