import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { pricingScenario } from "../scripts/pricing-scenario.ts";
let app: FastifyInstance,
  db: pg.Pool,
  admin: pg.Pool,
  f: Awaited<ReturnType<typeof seedFixture>>,
  foreign: typeof f;
type Scenario = Awaited<ReturnType<typeof pricingScenario>>;
const common = () => ({
  unidade_id: f.unit,
  motivo: "Teste fictício C6",
  simulacao: true,
  confirmacao_humana: true,
});
const post = (
  path: string,
  body: Record<string, unknown>,
  key: string = randomUUID(),
  token = f.adminToken,
) =>
  app.inject({
    method: "POST",
    url: `/v1${path}`,
    headers: { authorization: `Bearer ${token}`, "idempotency-key": key },
    payload: { ...common(), ...body },
  });
async function create(path: string, body: Record<string, unknown>) {
  const r = await post(path, body);
  assert.equal(r.statusCode, 200, r.body);
  return r.json().id as string;
}
async function row(table: string, id: string) {
  return (await admin.query(`SELECT * FROM hvb.${table} WHERE id=$1`, [id]))
    .rows[0];
}
const scenario = () => pricingScenario(app, f.adminToken, f.unit);
const link = (s: Scenario, valor = "100.00") => ({
  precificacao_id: s.pricing,
  obrigacao_id: s.obligation,
  valor,
});
before(async () => {
  const url = process.env.TEST_MIGRATION_DATABASE_URL ?? "";
  assert.equal(new URL(url).pathname, "/hvb_sistema_test");
  await migrate(url);
  f = await seedFixture(url);
  foreign = await seedFixture(url);
  admin = pool(url, 1);
  db = pool(process.env.TEST_DATABASE_URL ?? "", 5);
  app = await buildApp(db);
});
after(async () => {
  await app?.close();
  await db?.end();
  await admin?.end();
});

test("preço por apresentação e componentes fecham total sem reescrever dívida ou custo", async () => {
  const s = await scenario();
  assert.equal((await row("precificacao_compra", s.pricing)).total, "105.00");
  assert.equal(
    (await row("obrigacao_fornecedor", s.obligation)).valor,
    "100.00",
  );
  assert.equal(
    (await row("obrigacao_valor_compra_consulta", s.obligation)).nao_vinculado,
    "100.00",
  );
  const cost = (await row("lote", s.purchaseLot)).custo_base;
  await create("/compras/vinculos-valores", link(s));
  assert.equal(
    (await row("precificacao_compra_consulta", s.pricing)).saldo_vincular,
    "5.00",
  );
  assert.equal(
    (await row("obrigacao_valor_compra_consulta", s.obligation)).nao_vinculado,
    "0.00",
  );
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", s.obligation)).saldo,
    "100.00",
  );
  assert.equal((await row("lote", s.purchaseLot)).custo_base, cost);
  assert.equal(
    (await row("posicao_estoque", s.purchasePosition)).saldo_base,
    "0.000000",
  );
});
test("precificação cobre todos os itens uma vez e falha não deixa versão parcial", async () => {
  const s = await scenario();
  for (const itens of [
    [...s.priceBody.itens, ...s.priceBody.itens],
    [{ item_pedido_id: randomUUID(), preco_apresentacao: "20.00" }],
  ])
    assert.equal(
      (
        await post("/compras/precificacoes", {
          ...s.priceBody,
          versao_esperada: 1,
          itens,
        })
      ).statusCode,
      409,
    );
  const order = await s.purchase("dois-itens", "pedidos", {
    ...s.body,
    referencia: randomUUID(),
    itens: [
      ...s.body.itens,
      { apresentacao_id: s.presentation, quantidade_apresentacoes: "1" },
    ],
  });
  const items = (
    await admin.query(
      "SELECT id FROM hvb.item_pedido_compra WHERE pedido_id=$1",
      [order],
    )
  ).rows;
  assert.equal(
    (
      await post("/compras/precificacoes", {
        ...s.priceBody,
        pedido_id: order,
        itens: [{ item_pedido_id: items[0].id, preco_apresentacao: "20.00" }],
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.precificacao_compra WHERE pedido_id=$1",
        [order],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (await row("precificacao_compra_consulta", s.pricing)).atual,
    true,
  );
});
test("centavos exatos rejeitam arredondamento, números JSON e desconto excessivo", async () => {
  const s = await scenario();
  assert.equal(
    (
      await post("/compras/precificacoes", {
        ...s.priceBody,
        versao_esperada: 1,
        frete: 1.25,
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await post("/compras/precificacoes", {
        ...s.priceBody,
        versao_esperada: 1,
        desconto: "200.00",
      })
    ).statusCode,
    409,
  );
  const order = await s.purchase("fracionado", "pedidos", {
    ...s.body,
    referencia: randomUUID(),
    itens: [
      {
        apresentacao_id: s.purchasePresentation,
        quantidade_apresentacoes: "0.5",
      },
    ],
  });
  const item = (
    await admin.query(
      "SELECT id FROM hvb.item_pedido_compra WHERE pedido_id=$1",
      [order],
    )
  ).rows[0].id;
  assert.equal(
    (
      await post("/compras/precificacoes", {
        ...s.priceBody,
        pedido_id: order,
        itens: [{ item_pedido_id: item, preco_apresentacao: "1.25" }],
      })
    ).statusCode,
    409,
  );
});
test("versões concorrentes têm uma sucessora e preço anterior permanece consultável", async () => {
  const s = await scenario(),
    body = { ...s.priceBody, versao_esperada: 1, frete: "15.00" };
  const rs = await Promise.all([
    post("/compras/precificacoes", body),
    post("/compras/precificacoes", body),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal(
    (await row("precificacao_compra_consulta", s.pricing)).atual,
    false,
  );
  assert.equal((await row("precificacao_compra", s.pricing)).total, "105.00");
  assert.equal(
    (await post("/compras/vinculos-valores", link(s))).statusCode,
    409,
  );
});
test("retry e vínculos concorrentes respeitam orçamento e obrigação sem criar pagamento", async () => {
  const s = await scenario(),
    body = link(s, "60.00"),
    key = randomUUID();
  const rs = await Promise.all([
    post("/compras/vinculos-valores", body, key),
    post("/compras/vinculos-valores", body, key),
  ]);
  for (const r of rs) assert.equal(r.statusCode, 200, r.body);
  assert.equal(rs[0]?.json().id, rs[1]?.json().id);
  const competing = await Promise.all([
    post("/compras/vinculos-valores", link(s, "30.00")),
    post("/compras/vinculos-valores", link(s, "30.00")),
  ]);
  assert.deepEqual(competing.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal(
    (await row("obrigacao_valor_compra_consulta", s.obligation)).nao_vinculado,
    "10.00",
  );
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.pagamento_fornecedor WHERE fornecedor_id=$1",
        [s.supplier],
      )
    ).rows[0].n,
    0,
  );
});
test("limite do pedido agrega versões e baixa de total exige rever conciliação", async () => {
  const s = await scenario();
  await create("/compras/vinculos-valores", link(s, "60.00"));
  const body = {
    ...s.priceBody,
    versao_esperada: 1,
    frete: "0.00",
    acrescimo: "0.00",
    desconto: "0.00",
    itens: [{ item_pedido_id: s.purchaseItem, preco_apresentacao: "10.00" }],
  };
  assert.equal((await post("/compras/precificacoes", body)).statusCode, 409);
  const next = await create("/compras/precificacoes", {
    ...body,
    itens: [{ item_pedido_id: s.purchaseItem, preco_apresentacao: "16.00" }],
  });
  assert.equal(
    (
      await post("/compras/vinculos-valores", {
        ...link(s, "30.00"),
        precificacao_id: next,
      })
    ).statusCode,
    409,
  );
  await create("/compras/vinculos-valores", {
    ...link(s, "20.00"),
    precificacao_id: next,
  });
  assert.equal(
    (await row("precificacao_compra_consulta", next)).saldo_vincular,
    "0.00",
  );
});
test("reversão de vínculo libera conciliação e reversão de dívida preserva vínculo histórico inativo", async () => {
  const s = await scenario(),
    id = await create("/compras/vinculos-valores", link(s));
  await create("/compras/reversoes-valores", { vinculo_id: id });
  assert.equal(
    (await row("precificacao_compra_consulta", s.pricing)).saldo_vincular,
    "105.00",
  );
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", s.obligation)).saldo,
    "100.00",
  );
  const next = await create("/compras/vinculos-valores", link(s));
  await s.payable("reverter-obrigacao", "reversoes", {
    obrigacao_id: s.obligation,
  });
  assert.equal((await row("vinculo_valor_compra_consulta", next)).ativo, false);
  assert.equal(
    (await row("precificacao_compra_consulta", s.pricing)).saldo_vincular,
    "105.00",
  );
  assert.equal(
    (await post("/compras/vinculos-valores", link(s))).statusCode,
    409,
  );
});
test("contexto, RLS e permissões de conciliação impedem associações cruzadas", async () => {
  const s = await scenario(),
    other = await scenario();
  assert.equal(
    (
      await post("/compras/vinculos-valores", {
        ...link(s),
        obrigacao_id: other.obligation,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await post("/compras/vinculos-valores", {
        ...link(s),
        unidade_id: f.otherUnit,
      })
    ).statusCode,
    404,
  );
  await transaction(db, foreign.org, async (tx) =>
    assert.equal(
      (
        await tx.query("SELECT id FROM precificacao_compra WHERE id=$1", [
          s.pricing,
        ])
      ).rowCount,
      0,
    ),
  );
  await admin.query(
    "INSERT INTO hvb.papel_permissao(organizacao_id,papel_id,permissao) VALUES($1,$2,'compras:conciliar_valores')",
    [f.org, f.readerRole],
  );
  assert.equal(
    (
      await post(
        "/compras/vinculos-valores",
        link(s),
        randomUUID(),
        f.readerToken,
      )
    ).statusCode,
    403,
  );
  for (const path of [
    `/compras/precificacoes?pedido_id=${s.purchaseOrder}`,
    `/compras/precos-itens?precificacao_id=${s.pricing}`,
    "/compras/vinculos-valores?limit=1",
    "/compras/reversoes-valores?limit=1",
    `/a-pagar/conciliacao-compras?fornecedor_id=${s.supplier}`,
  ]) {
    const r = await app.inject({
      url: `/v1${path}&unidade_id=${f.unit}`,
      headers: { authorization: `Bearer ${f.adminToken}` },
    });
    assert.equal(r.statusCode, 200, r.body);
  }
  await assert.rejects(
    admin.query("UPDATE hvb.precificacao_compra SET total=1 WHERE id=$1", [
      s.pricing,
    ]),
  );
  await assert.rejects(
    admin.query(
      "INSERT INTO hvb.preco_item_compra(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,precificacao_id,item_pedido_id,preco_apresentacao,subtotal) SELECT gen_random_uuid(),organizacao_id,unidade_id,autor_id,comando_id,motivo,precificacao_id,item_pedido_id,preco_apresentacao,subtotal FROM hvb.preco_item_compra WHERE precificacao_id=$1",
      [s.pricing],
    ),
    /Comando de exame ausente ou concluido/,
  );
});
