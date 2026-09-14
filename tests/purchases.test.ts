import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { purchaseScenario } from "../scripts/purchase-scenario.ts";
import { purchaseLists } from "../src/domain/purchases/service.ts";
let app: FastifyInstance,
  db: pg.Pool,
  admin: pg.Pool,
  f: Awaited<ReturnType<typeof seedFixture>>,
  foreign: typeof f;
type Scenario = Awaited<ReturnType<typeof purchaseScenario>>;
const post = (
  path: string,
  body: Record<string, unknown>,
  key = randomUUID(),
  token = f.adminToken,
) =>
  app.inject({
    method: "POST",
    url: `/v1${path}`,
    headers: { authorization: `Bearer ${token}`, "idempotency-key": key },
    payload: body,
  });
const common = () => ({
  unidade_id: f.unit,
  motivo: "Teste compra fictícia",
  simulacao: true,
  confirmacao_humana: true,
});
const buy = (
  path: string,
  body: Record<string, unknown>,
  key = randomUUID(),
  token = f.adminToken,
) => post(`/compras/${path}`, { ...common(), ...body }, key, token);
async function create(path: string, body: Record<string, unknown>) {
  const r = await buy(path, body);
  assert.equal(r.statusCode, 200, r.body);
  return r.json().id as string;
}
const scenario = () => purchaseScenario(app, f.adminToken, f.unit);
const approve = (s: Scenario) =>
  create("decisoes", {
    pedido_id: s.purchaseOrder,
    estado_esperado: "rascunho",
    estado: "aprovado",
  });
const receipt = (s: Scenario, q = "2") => ({
  pedido_id: s.purchaseOrder,
  referencia: randomUUID(),
  documento_fornecedor: "Comprovante fictício sem emissão fiscal",
  ocorrido_em: "2026-09-01T12:00:00Z",
  itens: [
    {
      item_pedido_id: s.purchaseItem,
      posicao_id: s.purchasePosition,
      quantidade_apresentacoes: q,
    },
  ],
});
async function balance(s: Scenario) {
  return (
    await admin.query(
      "SELECT saldo_base FROM hvb.posicao_estoque WHERE id=$1",
      [s.purchasePosition],
    )
  ).rows[0].saldo_base;
}
const get = (path: string, query = "", token = f.adminToken) =>
  app.inject({
    url: `/v1/compras/${path}?unidade_id=${f.unit}&${query}`,
    headers: { authorization: `Bearer ${token}` },
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
test("pedido e aprovação não geram estoque, pagamento ou compra externa", async () => {
  const s = await scenario();
  assert.equal(await balance(s), "0.000000");
  assert.equal((await buy("recebimentos", receipt(s))).statusCode, 409);
  await approve(s);
  assert.equal(await balance(s), "0.000000");
  assert.equal(
    (await buy("pedidos", { ...s.body, itens: [] })).statusCode,
    400,
  );
  assert.equal(
    (
      await buy("pedidos", {
        ...s.body,
        referencia: randomUUID(),
        itens: [s.body.itens[0], s.body.itens[0]],
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.item_conta WHERE organizacao_id=$1",
        [f.org],
      )
    ).rows[0].n,
    0,
  );
});
test("recebimento parcial usa a mesma transação física, fator e retry", async () => {
  const s = await scenario();
  await approve(s);
  const b = receipt(s),
    key = randomUUID(),
    rs = await Promise.all([
      buy("recebimentos", b, key),
      buy("recebimentos", b, key),
    ]);
  for (const r of rs) assert.equal(r.statusCode, 200, r.body);
  assert.equal(rs[0]?.json().id, rs[1]?.json().id);
  assert.equal(await balance(s), "20.000000");
  const rows = (
    await get("recebimentos-itens", `recebimento_id=${rs[0]?.json().id}`)
  ).json().items;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].quantidade_apresentacoes, "2.000000");
  assert.equal(rows[0].quantidade_base, "20.000000");
  assert.equal(rows[0].fator_snapshot, "10.000000");
  const t = (
    await admin.query(
      "SELECT t.id,(SELECT count(*)::int FROM hvb.lancamento_estoque l WHERE l.transacao_id=t.id) pares FROM hvb.transacao_estoque t WHERE t.id=$1",
      [rows[0].id],
    )
  ).rows[0];
  assert.equal(t.pares, 2);
  assert.equal((await buy("recebimentos", b)).statusCode, 409);
  assert.equal(await balance(s), "20.000000");
  assert.equal(
    (await get("itens", `pedido_id=${s.purchaseOrder}`)).json().items[0]
      .recebido_apresentacoes,
    "2.000000",
  );
});
test("concorrência não ultrapassa quantidade solicitada", async () => {
  const s = await scenario();
  await approve(s);
  const rs = await Promise.all([
    buy("recebimentos", receipt(s, "4")),
    buy("recebimentos", receipt(s, "4")),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal(await balance(s), "40.000000");
  await create("recebimentos", receipt(s, "1"));
  assert.equal(await balance(s), "50.000000");
});
test("falha posterior desfaz o lote inteiro de entradas e permite correção", async () => {
  const s = await scenario();
  await approve(s);
  const b = receipt(s, "3");
  b.itens.push({ ...(b.itens[0] as (typeof b.itens)[number]) });
  const r = await buy("recebimentos", b);
  assert.equal(r.statusCode, 409, r.body);
  assert.equal(await balance(s), "0.000000");
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.recebimento_compra WHERE referencia=$1",
        [b.referencia],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.transacao_estoque WHERE destino_id=$1",
        [s.purchasePosition],
      )
    ).rows[0].n,
    0,
  );
  await create("recebimentos", receipt(s, "5"));
});
test("compra não aceita outra apresentação, custódia de tutor ou item de outro pedido", async () => {
  const s = await scenario(),
    other = await scenario();
  await approve(s);
  const tutor = await post("/estoque/posicoes", {
    local_id: s.local,
    lote_id: s.purchaseLot,
    custodia_id: s.custody,
  });
  assert.equal(tutor.statusCode, 200, tutor.body);
  for (const pos of [s.position, tutor.json().id]) {
    const b = receipt(s);
    assert.ok(b.itens[0]);
    b.itens[0].posicao_id = pos;
    assert.equal((await buy("recebimentos", b)).statusCode, 409);
  }
  const b = receipt(s);
  assert.ok(b.itens[0]);
  b.itens[0].item_pedido_id = other.purchaseItem;
  assert.equal((await buy("recebimentos", b)).statusCode, 409);
  assert.equal(await balance(s), "0.000000");
});
test("cancelamento preserva recebimento parcial e impede novas entradas", async () => {
  const s = await scenario();
  await approve(s);
  await create("recebimentos", receipt(s));
  await create("decisoes", {
    pedido_id: s.purchaseOrder,
    estado_esperado: "aprovado",
    estado: "cancelado",
  });
  assert.equal(await balance(s), "20.000000");
  assert.equal((await buy("recebimentos", receipt(s))).statusCode, 409);
  assert.equal(
    (
      await buy("decisoes", {
        pedido_id: s.purchaseOrder,
        estado_esperado: "rascunho",
        estado: "aprovado",
      })
    ).statusCode,
    409,
  );
});
test("reversão física preserva recibo e libera quantidade do pedido sem crédito fictício", async () => {
  const s = await scenario();
  await approve(s);
  const id = await create("recebimentos", receipt(s));
  const item = (await get("recebimentos-itens", `recebimento_id=${id}`)).json()
    .items[0];
  const r = await post(`/estoque/transacoes/${item.id}/reverter`, {
    ocorrido_em: "2026-09-01T13:00:00Z",
    motivo: "Estorno fictício do recebimento",
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(await balance(s), "0.000000");
  assert.equal(
    (await get("recebimentos-itens", `recebimento_id=${id}`)).json().items[0]
      .revertido,
    true,
  );
  assert.equal(
    (await get("itens", `pedido_id=${s.purchaseOrder}`)).json().items[0]
      .recebido_apresentacoes,
    "0.000000",
  );
  await create("recebimentos", receipt(s, "5"));
  assert.equal(await balance(s), "50.000000");
});
test("escopo, permissão de estoque e SQL imutável impedem atalhos", async () => {
  const s = await scenario();
  await approve(s);
  assert.equal(
    (await buy("recebimentos", { ...receipt(s), unidade_id: f.otherUnit }))
      .statusCode,
    404,
  );
  assert.equal(
    (await buy("recebimentos", receipt(s), randomUUID(), foreign.adminToken))
      .statusCode,
    404,
  );
  await admin.query(
    "INSERT INTO hvb.papel_permissao(organizacao_id,papel_id,permissao) VALUES($1,$2,'compras:receber')",
    [f.org, f.readerRole],
  );
  assert.equal(
    (await buy("recebimentos", receipt(s), randomUUID(), f.readerToken))
      .statusCode,
    403,
  );
  await transaction(db, foreign.org, async (tx) =>
    assert.equal(
      (
        await tx.query("SELECT id FROM pedido_compra WHERE id=$1", [
          s.purchaseOrder,
        ])
      ).rowCount,
      0,
    ),
  );
  await assert.rejects(
    admin.query(
      "UPDATE hvb.item_pedido_compra SET quantidade_apresentacoes=10 WHERE id=$1",
      [s.purchaseItem],
    ),
  );
  await assert.rejects(
    admin.query(
      "INSERT INTO hvb.item_pedido_compra(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,pedido_id,apresentacao_id,quantidade_apresentacoes) SELECT gen_random_uuid(),organizacao_id,unidade_id,autor_id,comando_id,'teste',pedido_id,apresentacao_id,1 FROM hvb.item_pedido_compra WHERE id=$1",
      [s.purchaseItem],
    ),
    /Comando de exame ausente ou concluido/,
  );
});
test("contratos paginados e datas/quantidades inválidas não alteram saldo", async () => {
  const s = await scenario();
  await approve(s);
  assert.equal(
    (
      await buy("recebimentos", {
        ...receipt(s),
        ocorrido_em: "2099-01-01T00:00:00Z",
      })
    ).statusCode,
    409,
  );
  const b = receipt(s) as Record<string, unknown>;
  b.itens = [
    {
      item_pedido_id: s.purchaseItem,
      posicao_id: s.purchasePosition,
      quantidade_apresentacoes: 2,
    },
  ];
  assert.equal((await buy("recebimentos", b)).statusCode, 400);
  assert.equal(
    (await buy("recebimentos", { ...receipt(s), simulacao: false })).statusCode,
    400,
  );
  assert.equal(await balance(s), "0.000000");
  await create("recebimentos", receipt(s));
  for (const list of purchaseLists) {
    const r = await get(list.path.replace("/compras/", ""), "limit=2");
    assert.equal(r.statusCode, 200, r.body);
    assert.ok(r.json().items.length <= 2);
  }
});
