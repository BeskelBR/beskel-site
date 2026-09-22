import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { supplierCreditScenario } from "../scripts/supplier-credit-scenario.ts";
import { acquisitionScenario } from "../scripts/acquisition-scenario.ts";
let app: FastifyInstance,
  db: pg.Pool,
  admin: pg.Pool,
  f: Awaited<ReturnType<typeof seedFixture>>,
  foreign: typeof f;
const common = () => ({
  unidade_id: f.unit,
  motivo: "Teste fictício C9",
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
async function row(table: string, id: string) {
  return (await admin.query(`SELECT * FROM hvb.${table} WHERE id=$1`, [id]))
    .rows[0];
}
async function get(path: string) {
  const r = await app.inject({
    url: `/v1/${path}&unidade_id=${f.unit}`,
    headers: { authorization: `Bearer ${f.adminToken}` },
  });
  assert.equal(r.statusCode, 200, r.body);
  return r.json().items as Record<string, unknown>[];
}
const scenario = () => supplierCreditScenario(app, f.adminToken, f.unit);
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

test("crédito declarado não reduz dívida, não cria pagamento e não devolve estoque", async () => {
  const s = await scenario();
  assert.equal(
    (await row("credito_fornecedor_consulta", s.credit)).disponivel,
    "60.00",
  );
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
    (await post("creditos", { ...s.creditBody, referencia: randomUUID() }))
      .statusCode,
    409,
  );
});
test("aplicação compartilha liquidação original e quita parcela sem pagamento fictício", async () => {
  const s = await scenario(),
    id = await create("aplicacoes-creditos", s.applicationBody);
  const ledger = await row("liquidacao_fornecedor", id);
  assert.equal(ledger.credito_id, s.credit);
  assert.equal(ledger.pagamento_id, null);
  assert.equal(
    (await row("credito_fornecedor_consulta", s.credit)).disponivel,
    "20.00",
  );
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", s.obligation)).saldo,
    "60.00",
  );
  await create("alocacoes-parcelas", {
    parcela_id: s.installments[0]?.id,
    liquidacao_id: id,
    valor: "40.00",
  });
  const plan = await row("plano_parcelas_fornecedor_consulta", s.plan);
  assert.equal(plan.saldo_obrigacao, "60.00");
  assert.equal(plan.liquidado_sem_parcela, "0.00");
  const records = await get(`a-pagar/liquidacoes?credito_id=${s.credit}`);
  assert.equal(records.length, 1);
  assert.equal(records[0]?.id, id);
  assert.equal(records[0]?.credito_id, s.credit);
  assert.equal(records[0]?.pagamento_id, null);
  const forInstallment = await get(
    `a-pagar/liquidacoes-para-parcelas?credito_id=${s.credit}`,
  );
  assert.equal(forInstallment[0]?.credito_id, s.credit);
  assert.equal(forInstallment[0]?.nao_alocado, "0.00");
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
test("reversões recompõem crédito, dívida e parcela e impedem estorno de fonte aplicada", async () => {
  const s = await scenario(),
    id = await create("aplicacoes-creditos", s.applicationBody);
  const assigned = await create("alocacoes-parcelas", {
    parcela_id: s.installments[0]?.id,
    liquidacao_id: id,
    valor: "40.00",
  });
  assert.equal(
    (await post("reversoes-creditos", { credito_id: s.credit })).statusCode,
    409,
  );
  assert.equal(
    (await post("reversoes", { obrigacao_id: s.obligation })).statusCode,
    409,
  );
  await create("reversoes", { liquidacao_id: id });
  assert.equal(
    (await row("credito_fornecedor_consulta", s.credit)).disponivel,
    "60.00",
  );
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", s.obligation)).saldo,
    "100.00",
  );
  assert.equal(
    (await row("alocacao_parcela_fornecedor_consulta", assigned)).ativo,
    false,
  );
  await create("reversoes-creditos", { credito_id: s.credit });
  assert.equal(
    (await post("aplicacoes-creditos", s.applicationBody)).statusCode,
    409,
  );
  assert.equal(
    (await post("reversoes-creditos", { credito_id: s.credit })).statusCode,
    409,
  );
});
test("aplicações concorrentes em obrigações distintas não excedem crédito disponível", async () => {
  const s = await scenario();
  const other = await s.payable("outra", "obrigacoes", {
    ...s.obligationBody,
    pedido_id: undefined,
    origem: "despesa",
    referencia: randomUUID(),
    documento_referencia: randomUUID(),
  });
  const rs = await Promise.all([
    post("aplicacoes-creditos", s.applicationBody),
    post("aplicacoes-creditos", { ...s.applicationBody, obrigacao_id: other }),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal(
    (await row("credito_fornecedor_consulta", s.credit)).disponivel,
    "20.00",
  );
});
test("pagamento e crédito concorrentes compartilham limite da mesma dívida", async () => {
  const s = await scenario();
  const payment = await s.payable("dinheiro", "pagamentos", {
    fornecedor_id: s.supplier,
    conta_financeira_id: s.account,
    referencia: randomUUID(),
    pago_em: "2026-09-02T12:00:00Z",
    valor: "70.00",
    evidencia: "Pagamento fictício",
  });
  const rs = await Promise.all([
    post("aplicacoes-creditos", s.applicationBody),
    post("liquidacoes", {
      obrigacao_id: s.obligation,
      pagamento_id: payment,
      liquidada_em: "2026-09-02T13:00:00Z",
      valor: "70.00",
    }),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  assert(
    ["60.00", "30.00"].includes(
      (await row("obrigacao_fornecedor_consulta", s.obligation)).saldo,
    ),
  );
});
test("retry não duplica aplicação e a mesma referência não registra outro crédito", async () => {
  const s = await scenario(),
    key = randomUUID();
  const rs = await Promise.all([
    post("aplicacoes-creditos", s.applicationBody, key),
    post("aplicacoes-creditos", s.applicationBody, key),
  ]);
  for (const r of rs) assert.equal(r.statusCode, 200, r.body);
  assert.equal(rs[0]?.json().id, rs[1]?.json().id);
  assert.equal(
    (await row("credito_fornecedor_consulta", s.credit)).disponivel,
    "20.00",
  );
  assert.equal(
    (
      await post("creditos", {
        ...s.creditBody,
        documento_referencia: randomUUID(),
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await post(
        "aplicacoes-creditos",
        { ...s.applicationBody, valor: "20.00" },
        key,
      )
    ).statusCode,
    409,
  );
});
test("centavos, temporalidade e fonte única são exigidos", async () => {
  const s = await scenario();
  for (const valor of [1, "1.001"])
    assert.equal(
      (await post("aplicacoes-creditos", { ...s.applicationBody, valor }))
        .statusCode,
      400,
    );
  for (const body of [
    { ...s.applicationBody, valor: "0.00" },
    { ...s.applicationBody, valor: "60.01" },
    { ...s.applicationBody, liquidada_em: "2099-01-01T00:00:00Z" },
    { ...s.applicationBody, liquidada_em: "2026-09-02T11:00:00Z" },
  ])
    assert.equal((await post("aplicacoes-creditos", body)).statusCode, 409);
  assert.equal(
    (
      await post("aplicacoes-creditos", {
        ...s.applicationBody,
        pagamento_id: randomUUID(),
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await post("liquidacoes", {
        ...s.applicationBody,
        pagamento_id: randomUUID(),
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await post("creditos", {
        ...s.creditBody,
        referencia: randomUUID(),
        documento_referencia: randomUUID(),
        ocorrido_em: "2099-01-01T00:00:00Z",
      })
    ).statusCode,
    409,
  );
});
test("fornecedor, unidade, RLS e permissões impedem crédito de outro contexto", async () => {
  const s = await scenario(),
    other = await scenario();
  assert.equal(
    (
      await post("aplicacoes-creditos", {
        ...s.applicationBody,
        obrigacao_id: other.obligation,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await post("aplicacoes-creditos", {
        ...s.applicationBody,
        unidade_id: f.otherUnit,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await post("creditos", {
        ...s.creditBody,
        referencia: randomUUID(),
        documento_referencia: randomUUID(),
        origem_obrigacao_id: other.obligation,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (await post("creditos", s.creditBody, randomUUID(), f.readerToken))
      .statusCode,
    403,
  );
  assert.equal(
    (
      await post(
        "aplicacoes-creditos",
        s.applicationBody,
        randomUUID(),
        f.readerToken,
      )
    ).statusCode,
    403,
  );
  await transaction(db, foreign.org, async (tx) =>
    assert.equal(
      (
        await tx.query(
          "SELECT id FROM credito_fornecedor_consulta WHERE id=$1",
          [s.credit],
        )
      ).rowCount,
      0,
    ),
  );
  for (const path of [
    `creditos?fornecedor_id=${s.supplier}`,
    `aplicacoes-creditos?credito_id=${s.credit}`,
    `reversoes-creditos?credito_id=${s.credit}`,
  ])
    await get(`a-pagar/${path}`);
  await assert.rejects(
    admin.query("UPDATE hvb.credito_fornecedor SET valor=1 WHERE id=$1", [
      s.credit,
    ]),
  );
  await assert.rejects(
    admin.query(
      "INSERT INTO hvb.reversao_credito_fornecedor(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,credito_id) SELECT gen_random_uuid(),organizacao_id,unidade_id,autor_id,comando_id,motivo,id FROM hvb.credito_fornecedor WHERE id=$1",
      [s.credit],
    ),
    /Comando de exame ausente ou concluido/,
  );
});
test("correção documental exige reversão e uma única sucessora da mesma origem", async () => {
  const s = await scenario();
  const body = {
    ...s.creditBody,
    correcao_de_id: s.credit,
    referencia: randomUUID(),
    valor: "70.00",
  };
  assert.equal((await post("creditos", body)).statusCode, 409);
  await create("reversoes-creditos", { credito_id: s.credit });
  assert.equal(
    (await post("creditos", { ...body, origem: "outro" })).statusCode,
    409,
  );
  const rs = await Promise.all([
    post("creditos", body),
    post("creditos", { ...body, referencia: randomUUID() }),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal((await row("credito_fornecedor", s.credit)).valor, "60.00");
  const next = rs.find((r) => r.statusCode === 200)?.json().id;
  assert.equal(
    (await row("credito_fornecedor_consulta", next)).disponivel,
    "70.00",
  );
});
test("origem documental não limita compensação a uma única obrigação do fornecedor", async () => {
  const s = await scenario();
  const other = await s.payable("nova-despesa", "obrigacoes", {
    ...s.obligationBody,
    pedido_id: undefined,
    origem: "despesa",
    referencia: randomUUID(),
    documento_referencia: randomUUID(),
  });
  await create("aplicacoes-creditos", {
    ...s.applicationBody,
    obrigacao_id: other,
    valor: "20.00",
  });
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", other)).saldo,
    "80.00",
  );
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", s.obligation)).saldo,
    "100.00",
  );
  assert.equal(
    (await row("credito_fornecedor_consulta", s.credit)).disponivel,
    "40.00",
  );
});
test("reversão concorrente da fonte ou sua aplicação aceita apenas uma intenção", async () => {
  const s = await scenario();
  const rs = await Promise.all([
    post("aplicacoes-creditos", { ...s.applicationBody, valor: "60.00" }),
    post("reversoes-creditos", { credito_id: s.credit }),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  const c = await row("credito_fornecedor_consulta", s.credit);
  assert.equal(c.disponivel, c.revertido ? "60.00" : "0.00");
});
test("indicadores de consultas retornam booleanos, incluindo parcelas e aquisição", async () => {
  const s = await scenario(),
    id = await create("aplicacoes-creditos", s.applicationBody);
  const plan = (
    await get(`a-pagar/planos-parcelas?obrigacao_id=${s.obligation}`)
  )[0];
  assert.equal(plan?.obrigacao_revertida, false);
  const liquidations = await get(
    `a-pagar/liquidacoes-para-parcelas?credito_id=${s.credit}`,
  );
  assert.equal(liquidations[0]?.id, id);
  assert.equal(liquidations[0]?.revertida, false);
  const acquisition = await acquisitionScenario(app, f.adminToken, f.unit);
  const movement = await acquisition.receipt("tipo-flag", "2");
  await acquisition.purchase("custo", "custos-recebimentos", {
    item_rateio_id: acquisition.allocationItem,
    recebimento_item_id: movement,
    valor: "42.00",
  });
  const allocation = (
    await get(`compras/rateios-custo?pedido_id=${acquisition.purchaseOrder}`)
  )[0];
  assert.equal(allocation?.preco_atual, true);
  const costs = (
    await get(
      `compras/custos-recebimentos?item_rateio_id=${acquisition.allocationItem}`,
    )
  )[0];
  assert.equal(costs?.recebimento_revertido, false);
});
