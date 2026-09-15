import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { acquisitionScenario } from "../scripts/acquisition-scenario.ts";
let app: FastifyInstance,
  db: pg.Pool,
  admin: pg.Pool,
  f: Awaited<ReturnType<typeof seedFixture>>,
  foreign: typeof f;
type Scenario = Awaited<ReturnType<typeof acquisitionScenario>>;
const common = () => ({
  unidade_id: f.unit,
  motivo: "Teste fictício C7",
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
    url: `/v1/compras/${path}`,
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
const scenario = () => acquisitionScenario(app, f.adminToken, f.unit);
const cost = (s: Scenario, receipt: string, valor = "42.00") => ({
  item_rateio_id: s.allocationItem,
  recebimento_item_id: receipt,
  valor,
});
const reverseStock = (id: string) =>
  app.inject({
    method: "POST",
    url: `/v1/estoque/transacoes/${id}/reverter`,
    headers: {
      authorization: `Bearer ${f.adminToken}`,
      "idempotency-key": randomUUID(),
    },
    payload: {
      motivo: "Estorno fictício C7",
      ocorrido_em: "2026-09-01T13:00:00Z",
    },
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

test("custo de aquisição fecha recebimentos parciais e preserva custo físico e dívida", async () => {
  const s = await scenario(),
    r1 = await s.receipt("parcial", "2"),
    r2 = await s.receipt("final", "3");
  const id = await create("custos-recebimentos", cost(s, r1));
  let item = await row("item_rateio_aquisicao_consulta", s.allocationItem);
  assert.equal(item.saldo_atribuir, "63.00");
  assert.equal(item.quantidade_pendente, "3.000000");
  assert.equal(
    (await row("custo_recebimento_consulta", id)).quantidade_base,
    "20.000000",
  );
  await create("custos-recebimentos", cost(s, r2, "63.00"));
  item = await row("item_rateio_aquisicao_consulta", s.allocationItem);
  assert.equal(item.valor_atribuido, "105.00");
  assert.equal(item.quantidade_pendente, "0.000000");
  assert.equal((await row("lote", s.purchaseLot)).custo_base, "1.250000");
  assert.equal(
    (await row("transacao_estoque", r1)).custo_base_snapshot,
    "1.250000",
  );
  assert.equal(
    (await row("posicao_estoque", s.purchasePosition)).saldo_base,
    "50.000000",
  );
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", s.obligation)).saldo,
    "100.00",
  );
});
test("rateio incompleto, duplicado ou com componente divergente desfaz toda a versão", async () => {
  const s = await scenario(),
    b = { ...s.allocationBody, versao_esperada: 1 };
  for (const itens of [
    [{ ...b.itens[0], frete: "9.00" }],
    [...b.itens, ...b.itens],
    [{ ...b.itens[0], item_pedido_id: randomUUID() }],
    [{ ...b.itens[0], desconto: "200.00" }],
  ])
    assert.equal(
      (await post("rateios-custo", { ...b, itens })).statusCode,
      409,
    );
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.rateio_aquisicao WHERE pedido_id=$1",
        [s.purchaseOrder],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await post("rateios-custo", {
        ...b,
        itens: [{ ...b.itens[0], frete: 10 }],
      })
    ).statusCode,
    400,
  );
});
test("rateio distribui cada componente entre itens distintos e conserva total do preço", async () => {
  const s = await scenario();
  const order = await s.purchase("multi", "pedidos", {
    ...s.body,
    referencia: randomUUID(),
    itens: [
      {
        apresentacao_id: s.purchasePresentation,
        quantidade_apresentacoes: "1",
      },
      { apresentacao_id: s.presentation, quantidade_apresentacoes: "1" },
    ],
  });
  const items = (
    await admin.query(
      "SELECT id FROM hvb.item_pedido_compra WHERE pedido_id=$1 ORDER BY id",
      [order],
    )
  ).rows;
  const pricing = await create("precificacoes", {
    pedido_id: order,
    versao_esperada: 0,
    frete: "3.00",
    acrescimo: "1.00",
    desconto: "2.00",
    itens: items.map((i, n) => ({
      item_pedido_id: i.id,
      preco_apresentacao: n === 0 ? "10.00" : "20.00",
    })),
  });
  const body = {
    pedido_id: order,
    precificacao_id: pricing,
    versao_esperada: 0,
    criterio: "Valores fictícios discriminados",
    itens: items.map((i, n) => ({
      item_pedido_id: i.id,
      frete: n === 0 ? "1.00" : "2.00",
      acrescimo: n === 0 ? "0.00" : "1.00",
      desconto: "1.00",
    })),
  };
  assert.equal(
    (await post("rateios-custo", { ...body, itens: body.itens.slice(0, 1) }))
      .statusCode,
    409,
  );
  const id = await create("rateios-custo", body);
  const totals = (
    await admin.query(
      "SELECT total FROM hvb.item_rateio_aquisicao WHERE rateio_id=$1 ORDER BY total",
      [id],
    )
  ).rows.map((r) => r.total);
  assert.deepEqual(totals, ["10.00", "22.00"]);
});
test("retry concorrente não duplica custo e nova intenção no mesmo recebimento é recusada", async () => {
  const s = await scenario(),
    r = await s.receipt("parcial", "2"),
    key = randomUUID();
  const rs = await Promise.all([
    post("custos-recebimentos", cost(s, r), key),
    post("custos-recebimentos", cost(s, r), key),
  ]);
  for (const x of rs) assert.equal(x.statusCode, 200, x.body);
  assert.equal(rs[0]?.json().id, rs[1]?.json().id);
  assert.equal((await post("custos-recebimentos", cost(s, r))).statusCode, 409);
  assert.equal(
    (await row("item_rateio_aquisicao_consulta", s.allocationItem))
      .valor_atribuido,
    "42.00",
  );
});
test("custos concorrentes respeitam orçamento e última quantidade fecha o saldo exato", async () => {
  const s = await scenario(),
    r1 = await s.receipt("a", "2"),
    r2 = await s.receipt("b", "3");
  const rs = await Promise.all([
    post("custos-recebimentos", cost(s, r1, "80.00")),
    post("custos-recebimentos", cost(s, r2, "80.00")),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  const pending = rs[0]?.statusCode === 200 ? r2 : r1;
  assert.equal(
    (await post("custos-recebimentos", cost(s, pending, "24.00"))).statusCode,
    409,
  );
  await create("custos-recebimentos", cost(s, pending, "25.00"));
  assert.equal(
    (await row("item_rateio_aquisicao_consulta", s.allocationItem))
      .saldo_atribuir,
    "0.00",
  );
});
test("revisão de rateio exige desfazer custos ativos e preserva versão e avaliações antigas", async () => {
  const s = await scenario(),
    r = await s.receipt("a", "2"),
    id = await create("custos-recebimentos", cost(s, r)),
    b = { ...s.allocationBody, versao_esperada: 1 };
  assert.equal((await post("rateios-custo", b)).statusCode, 409);
  await create("reversoes-custos", { custo_recebimento_id: id });
  assert.equal(
    (await post("reversoes-custos", { custo_recebimento_id: id })).statusCode,
    409,
  );
  const rs = await Promise.all([
    post("rateios-custo", b),
    post("rateios-custo", b),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal(
    (await row("rateio_aquisicao_consulta", s.allocation)).atual,
    false,
  );
  assert.equal((await row("custo_recebimento_consulta", id)).ativo, false);
  assert.equal(
    (await row("posicao_estoque", s.purchasePosition)).saldo_base,
    "20.000000",
  );
  assert.equal((await post("custos-recebimentos", cost(s, r))).statusCode, 409);
});
test("reversão física inativa custo analítico sem apagar avaliação e permite recebimento substituto", async () => {
  const s = await scenario(),
    r = await s.receipt("a", "2"),
    id = await create("custos-recebimentos", cost(s, r));
  const reversed = await reverseStock(r);
  assert.equal(reversed.statusCode, 200, reversed.body);
  assert.equal((await row("custo_recebimento_consulta", id)).ativo, false);
  assert.equal(
    (await row("custo_recebimento_consulta", id)).recebimento_revertido,
    true,
  );
  assert.equal(
    (await row("item_rateio_aquisicao_consulta", s.allocationItem))
      .saldo_atribuir,
    "105.00",
  );
  assert.equal((await post("custos-recebimentos", cost(s, r))).statusCode, 409);
  const next = await s.receipt("substituto", "5");
  await create("custos-recebimentos", cost(s, next, "105.00"));
  assert.equal((await row("custo_recebimento", id)).valor, "42.00");
});
test("preço posterior sinaliza divergência sem recalcular rateio aceito ou custo físico", async () => {
  const s = await scenario();
  await create("precificacoes", {
    ...s.priceBody,
    versao_esperada: 1,
    frete: "15.00",
  });
  assert.equal(
    (await row("rateio_aquisicao_consulta", s.allocation)).preco_atual,
    false,
  );
  assert.equal(
    (await post("rateios-custo", { ...s.allocationBody, versao_esperada: 1 }))
      .statusCode,
    409,
  );
  const r = await s.receipt("a", "5");
  await create("custos-recebimentos", cost(s, r, "105.00"));
  assert.equal(
    (await row("item_rateio_aquisicao_consulta", s.allocationItem))
      .valor_atribuido,
    "105.00",
  );
});
test("contextos cruzados, RLS e permissões protegem custos e suas consultas", async () => {
  const s = await scenario(),
    other = await scenario(),
    r = await other.receipt("a", "2");
  assert.equal((await post("custos-recebimentos", cost(s, r))).statusCode, 409);
  assert.equal(
    (
      await post("rateios-custo", {
        ...s.allocationBody,
        versao_esperada: 1,
        unidade_id: f.otherUnit,
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (await post("custos-recebimentos", cost(s, r), randomUUID(), f.readerToken))
      .statusCode,
    403,
  );
  await transaction(db, foreign.org, async (tx) =>
    assert.equal(
      (
        await tx.query(
          "SELECT id FROM item_rateio_aquisicao_consulta WHERE id=$1",
          [s.allocationItem],
        )
      ).rowCount,
      0,
    ),
  );
  for (const path of [
    `rateios-custo?pedido_id=${s.purchaseOrder}`,
    `rateios-custo-itens?rateio_id=${s.allocation}`,
    `custos-recebimentos?item_rateio_id=${s.allocationItem}`,
    "reversoes-custos?limit=1",
  ]) {
    const x = await app.inject({
      url: `/v1/compras/${path}&unidade_id=${f.unit}`,
      headers: { authorization: `Bearer ${f.adminToken}` },
    });
    assert.equal(x.statusCode, 200, x.body);
  }
  await assert.rejects(
    admin.query("UPDATE hvb.item_rateio_aquisicao SET total=1 WHERE id=$1", [
      s.allocationItem,
    ]),
  );
  await assert.rejects(
    admin.query(
      "INSERT INTO hvb.item_rateio_aquisicao(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,rateio_id,item_pedido_id,subtotal,frete,acrescimo,desconto,total) SELECT gen_random_uuid(),organizacao_id,unidade_id,autor_id,comando_id,motivo,rateio_id,item_pedido_id,subtotal,frete,acrescimo,desconto,total FROM hvb.item_rateio_aquisicao WHERE id=$1",
      [s.allocationItem],
    ),
    /Comando de exame ausente ou concluido/,
  );
});

test("avaliação concorrente com estorno físico não deixa custo ativo de entrada revertida", async () => {
  const s = await scenario(),
    r = await s.receipt("concorrente", "2");
  const [valuation, reversal] = await Promise.all([
    post("custos-recebimentos", cost(s, r)),
    reverseStock(r),
  ]);
  assert.equal(reversal.statusCode, 200, reversal.body);
  assert([200, 409].includes(valuation.statusCode), valuation.body);
  assert.equal(
    (await row("item_rateio_aquisicao_consulta", s.allocationItem))
      .valor_atribuido,
    "0.00",
  );
  assert.equal(
    (await row("posicao_estoque", s.purchasePosition)).saldo_base,
    "0.000000",
  );
  const rows = (
    await admin.query(
      "SELECT ativo FROM hvb.custo_recebimento_consulta WHERE recebimento_item_id=$1",
      [r],
    )
  ).rows;
  assert(rows.every((x) => x.ativo === false));
});
