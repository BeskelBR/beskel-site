import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { payableScenario } from "../scripts/payable-scenario.ts";
let app: FastifyInstance,
  db: pg.Pool,
  admin: pg.Pool,
  f: Awaited<ReturnType<typeof seedFixture>>,
  foreign: typeof f;
type Scenario = Awaited<ReturnType<typeof payableScenario>>;
const common = () => ({
  unidade_id: f.unit,
  motivo: "Teste fictício C4",
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
    url: `/v1/a-pagar/${path}`,
    headers: { authorization: `Bearer ${token}`, "idempotency-key": key },
    payload: { ...common(), ...body },
  });
async function create(path: string, body: Record<string, unknown>) {
  const r = await post(path, body);
  assert.equal(r.statusCode, 200, r.body);
  return r.json().id as string;
}
const scenario = () => payableScenario(app, f.adminToken, f.unit);
const paymentBody = (s: Scenario, valor = "100.00") => ({
  fornecedor_id: s.supplier,
  conta_financeira_id: s.account,
  referencia: randomUUID(),
  pago_em: "2026-09-02T12:00:00Z",
  valor,
  evidencia: "Comprovante fictício sem pagamento real",
});
const settlement = (s: Scenario, payment: string, valor = "100.00") => ({
  obrigacao_id: s.obligation,
  pagamento_id: payment,
  liquidada_em: "2026-09-02T13:00:00Z",
  valor,
});
async function row(table: string, id: string) {
  return (await admin.query(`SELECT * FROM hvb.${table} WHERE id=$1`, [id]))
    .rows[0];
}
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

test("obrigação explícita não recebe estoque nem cria pagamento e documento não duplica", async () => {
  const s = await scenario();
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", s.obligation)).saldo,
    "100.00",
  );
  assert.equal(
    (await row("posicao_estoque", s.purchasePosition)).saldo_base,
    "0.000000",
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
  assert.equal(
    (
      await post("obrigacoes", {
        ...s.obligationBody,
        referencia: randomUUID(),
      })
    ).statusCode,
    409,
  );
  const expense = await create("obrigacoes", {
    ...s.obligationBody,
    pedido_id: undefined,
    origem: "despesa",
    referencia: randomUUID(),
    documento_referencia: randomUUID(),
    valor: "23.45",
  });
  assert.equal((await row("obrigacao_fornecedor", expense)).pedido_id, null);
});
test("pagamento deduplica retry e referência sem liquidar automaticamente", async () => {
  const s = await scenario(),
    body = paymentBody(s),
    key = randomUUID();
  const rs = await Promise.all([
    post("pagamentos", body, key),
    post("pagamentos", body, key),
  ]);
  for (const r of rs) assert.equal(r.statusCode, 200, r.body);
  assert.equal(rs[0]?.json().id, rs[1]?.json().id);
  assert.equal((await post("pagamentos", body)).statusCode, 409);
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", s.obligation)).saldo,
    "100.00",
  );
  assert.equal(
    (await row("pagamento_fornecedor_consulta", rs[0]?.json().id)).disponivel,
    "100.00",
  );
});
test("liquidações concorrentes não excedem obrigação nem pagamento", async () => {
  const s = await scenario(),
    payment = await create("pagamentos", paymentBody(s, "150.00"));
  const rs = await Promise.all([
    post("liquidacoes", settlement(s, payment, "70.00")),
    post("liquidacoes", settlement(s, payment, "70.00")),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", s.obligation)).saldo,
    "30.00",
  );
  await create("liquidacoes", settlement(s, payment, "30.00"));
  assert.equal(
    (await row("pagamento_fornecedor_consulta", payment)).disponivel,
    "50.00",
  );
  const other = await create("obrigacoes", {
    ...s.obligationBody,
    referencia: randomUUID(),
    documento_referencia: randomUUID(),
  });
  assert.equal(
    (
      await post("liquidacoes", {
        ...settlement(s, payment, "50.01"),
        obrigacao_id: other,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", other)).saldo,
    "100.00",
  );
});
test("reversão encadeada recompõe saldos e não apaga fatos", async () => {
  const s = await scenario(),
    payment = await create("pagamentos", paymentBody(s)),
    liquidation = await create("liquidacoes", settlement(s, payment));
  for (const b of [{ obrigacao_id: s.obligation }, { pagamento_id: payment }])
    assert.equal((await post("reversoes", b)).statusCode, 409);
  await create("reversoes", { liquidacao_id: liquidation });
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", s.obligation)).saldo,
    "100.00",
  );
  assert.equal(
    (await row("pagamento_fornecedor_consulta", payment)).disponivel,
    "100.00",
  );
  await create("reversoes", { obrigacao_id: s.obligation });
  await create("reversoes", { pagamento_id: payment });
  assert.equal(
    (await post("liquidacoes", settlement(s, payment))).statusCode,
    409,
  );
  assert.equal(
    (await post("reversoes", { liquidacao_id: liquidation })).statusCode,
    409,
  );
  assert.ok(await row("liquidacao_fornecedor", liquidation));
  assert.equal(
    (await row("posicao_estoque", s.purchasePosition)).saldo_base,
    "0.000000",
  );
});
test("fornecedor, pedido, unidade e organização devem coincidir", async () => {
  const s = await scenario(),
    other = await scenario(),
    payment = await create("pagamentos", paymentBody(other));
  assert.equal(
    (await post("liquidacoes", settlement(s, payment))).statusCode,
    409,
  );
  assert.equal(
    (
      await post("obrigacoes", {
        ...s.obligationBody,
        referencia: randomUUID(),
        documento_referencia: randomUUID(),
        fornecedor_id: other.supplier,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (await post("pagamentos", { ...paymentBody(s), unidade_id: f.otherUnit }))
      .statusCode,
    409,
  );
  assert.equal(
    (await post("pagamentos", paymentBody(s), randomUUID(), foreign.adminToken))
      .statusCode,
    409,
  );
  await transaction(db, foreign.org, async (tx) =>
    assert.equal(
      (
        await tx.query("SELECT id FROM obrigacao_fornecedor WHERE id=$1", [
          s.obligation,
        ])
      ).rowCount,
      0,
    ),
  );
});
test("centavos, datas, confirmação e alvo único são exigidos", async () => {
  const s = await scenario();
  for (const valor of [1.25, "1.001", "-1"])
    assert.equal(
      (await post("pagamentos", { ...paymentBody(s), valor })).statusCode,
      400,
    );
  for (const extra of [{ valor: "0.00" }, { pago_em: "2099-01-01T00:00:00Z" }])
    assert.equal(
      (await post("pagamentos", { ...paymentBody(s), ...extra })).statusCode,
      409,
    );
  for (const extra of [{ simulacao: false }, { confirmacao_humana: "true" }])
    assert.equal(
      (await post("pagamentos", { ...paymentBody(s), ...extra })).statusCode,
      400,
    );
  for (const b of [
    {},
    { obrigacao_id: s.obligation, pagamento_id: randomUUID() },
  ])
    assert.equal((await post("reversoes", b)).statusCode, 400);
  const payment = await create("pagamentos", paymentBody(s));
  assert.equal(
    (
      await post("liquidacoes", {
        ...settlement(s, payment),
        liquidada_em: "2026-09-01T12:00:00Z",
      })
    ).statusCode,
    409,
  );
});
test("cancelamento e recebimento físicos não compensam dívida por inferência", async () => {
  const s = await scenario();
  await s.purchase("aprovar", "decisoes", {
    pedido_id: s.purchaseOrder,
    estado_esperado: "rascunho",
    estado: "aprovado",
  });
  await s.purchase("receber", "recebimentos", {
    pedido_id: s.purchaseOrder,
    referencia: randomUUID(),
    documento_fornecedor: "Fictício",
    ocorrido_em: "2026-09-01T12:00:00Z",
    itens: [
      {
        item_pedido_id: s.purchaseItem,
        posicao_id: s.purchasePosition,
        quantidade_apresentacoes: "1",
      },
    ],
  });
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", s.obligation)).saldo,
    "100.00",
  );
  await s.purchase("cancelar", "decisoes", {
    pedido_id: s.purchaseOrder,
    estado_esperado: "aprovado",
    estado: "cancelado",
  });
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", s.obligation))
      .necessita_revisao,
    true,
  );
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", s.obligation)).revertido,
    false,
  );
});
test("listas paginadas exigem permissão própria e filtros de unidade", async () => {
  const s = await scenario();
  for (const path of ["obrigacoes", "pagamentos", "liquidacoes", "reversoes"]) {
    const url = `/v1/a-pagar/${path}?unidade_id=${f.unit}&limit=1`;
    assert.equal(
      (
        await app.inject({
          url,
          headers: { authorization: `Bearer ${f.readerToken}` },
        })
      ).statusCode,
      403,
    );
    const r = await app.inject({
      url,
      headers: { authorization: `Bearer ${f.adminToken}` },
    });
    assert.equal(r.statusCode, 200, r.body);
  }
  const r = await app.inject({
    url: `/v1/a-pagar/obrigacoes?unidade_id=${f.unit}&fornecedor_id=${s.supplier}`,
    headers: { authorization: `Bearer ${f.adminToken}` },
  });
  assert.equal(r.json().items.length, 1);
  assert.equal(r.json().items[0].saldo, "100.00");
  assert.equal(r.json().items[0].revertido, false);
  assert.equal(
    (await post("pagamentos", paymentBody(s), randomUUID(), f.readerToken))
      .statusCode,
    403,
  );
});
test("SQL preserva histórico e rejeita efeito anexado ao comando concluído", async () => {
  const s = await scenario();
  await assert.rejects(
    admin.query("UPDATE hvb.obrigacao_fornecedor SET valor=1 WHERE id=$1", [
      s.obligation,
    ]),
  );
  await assert.rejects(
    admin.query("DELETE FROM hvb.obrigacao_fornecedor WHERE id=$1", [
      s.obligation,
    ]),
  );
  await assert.rejects(
    admin.query(
      "INSERT INTO hvb.obrigacao_fornecedor(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,criada_em,fornecedor_id,pedido_id,origem,referencia,documento_referencia,descricao,ocorrida_em,vencimento,valor) SELECT gen_random_uuid(),organizacao_id,unidade_id,autor_id,comando_id,motivo,criada_em,fornecedor_id,pedido_id,origem,gen_random_uuid(),'outro',descricao,ocorrida_em,vencimento,valor FROM hvb.obrigacao_fornecedor WHERE id=$1",
      [s.obligation],
    ),
    /Comando de exame ausente ou concluido/,
  );
});

test("correção documental exige reversão prévia e aceita um único sucessor", async () => {
  const s = await scenario(),
    body = {
      ...s.obligationBody,
      referencia: randomUUID(),
      correcao_de_id: s.obligation,
      valor: "90.00",
    };
  assert.equal((await post("obrigacoes", body)).statusCode, 409);
  await create("reversoes", { obrigacao_id: s.obligation });
  assert.equal(
    (
      await post("obrigacoes", {
        ...body,
        documento_referencia: "Outra origem",
      })
    ).statusCode,
    409,
  );
  const rs = await Promise.all([
    post("obrigacoes", body),
    post("obrigacoes", { ...body, referencia: randomUUID() }),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  const next = rs.find((r) => r.statusCode === 200)?.json().id;
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", next)).saldo,
    "90.00",
  );
  assert.equal(
    (await row("obrigacao_fornecedor", s.obligation)).valor,
    "100.00",
  );
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", next)).correcao_de_id,
    s.obligation,
  );
});
