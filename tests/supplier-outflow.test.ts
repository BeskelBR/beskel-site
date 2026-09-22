import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { supplierOutflowScenario } from "../scripts/supplier-outflow-scenario.ts";
let app: FastifyInstance,
  db: pg.Pool,
  admin: pg.Pool,
  f: Awaited<ReturnType<typeof seedFixture>>,
  foreign: typeof f;
const common = () => ({
  unidade_id: f.unit,
  motivo: "Teste fictício C10",
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
const scenario = () => supplierOutflowScenario(app, f.adminToken, f.unit);
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

test("extrato e conciliação não liquidam dívida nem alteram dinheiro declarado", async () => {
  const s = await scenario();
  assert.equal(
    (await row("pagamento_conciliacao_consulta", s.payment)).nao_conciliado,
    "60.00",
  );
  await create("conciliacoes-saidas", s.reconciliationBody);
  assert.equal(
    (await row("saida_extrato_fornecedor_consulta", s.outflow)).nao_conciliado,
    "40.00",
  );
  const p = await row("pagamento_conciliacao_consulta", s.payment);
  assert.equal(p.nao_conciliado, "0.00");
  assert.equal(p.disponivel, "60.00");
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", s.obligation)).saldo,
    "100.00",
  );
  assert.equal(
    (await row("posicao_estoque", s.purchasePosition)).saldo_base,
    "0.000000",
  );
});
test("conciliação parcial aceita agrupamento de pagamentos e fracionamento de saídas", async () => {
  const s = await scenario();
  const extra = await create("saidas-extrato", {
    ...s.outflowBody,
    referencia: randomUUID(),
    referencia_externa: randomUUID(),
    valor: "40.00",
  });
  await create("conciliacoes-saidas", {
    ...s.reconciliationBody,
    valor: "20.00",
  });
  await create("conciliacoes-saidas", {
    ...s.reconciliationBody,
    saida_id: extra,
    valor: "40.00",
  });
  const payment = await create("pagamentos", {
    ...s.paymentBody,
    referencia: randomUUID(),
    valor: "80.00",
  });
  await create("conciliacoes-saidas", {
    ...s.reconciliationBody,
    pagamento_id: payment,
    valor: "80.00",
  });
  assert.equal(
    (await row("saida_extrato_fornecedor_consulta", s.outflow)).nao_conciliado,
    "0.00",
  );
  assert.equal(
    (await row("saida_extrato_fornecedor_consulta", extra)).nao_conciliado,
    "0.00",
  );
  assert.equal(
    (await row("pagamento_conciliacao_consulta", s.payment)).nao_conciliado,
    "0.00",
  );
});
test("retry é idempotente e documento externo original não duplica", async () => {
  const s = await scenario(),
    key = randomUUID();
  const rs = await Promise.all([
    post("conciliacoes-saidas", s.reconciliationBody, key),
    post("conciliacoes-saidas", s.reconciliationBody, key),
  ]);
  for (const r of rs) assert.equal(r.statusCode, 200, r.body);
  assert.equal(rs[0]?.json().id, rs[1]?.json().id);
  assert.equal(
    (await post("conciliacoes-saidas", s.reconciliationBody)).statusCode,
    409,
  );
  assert.equal(
    (
      await post("saidas-extrato", {
        ...s.outflowBody,
        referencia: randomUUID(),
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await post("saidas-extrato", {
        ...s.outflowBody,
        referencia_externa: randomUUID(),
      })
    ).statusCode,
    409,
  );
});
test("concorrência protege os saldos do pagamento e da saída independentemente", async () => {
  const s = await scenario();
  const extra = await create("saidas-extrato", {
    ...s.outflowBody,
    referencia: randomUUID(),
    referencia_externa: randomUUID(),
  });
  const rs = await Promise.all([
    post("conciliacoes-saidas", { ...s.reconciliationBody, valor: "40.00" }),
    post("conciliacoes-saidas", {
      ...s.reconciliationBody,
      saida_id: extra,
      valor: "40.00",
    }),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  const other = await scenario();
  const payment = await create("pagamentos", {
    ...other.paymentBody,
    referencia: randomUUID(),
  });
  const competing = await Promise.all([
    post("conciliacoes-saidas", other.reconciliationBody),
    post("conciliacoes-saidas", {
      ...other.reconciliationBody,
      pagamento_id: payment,
    }),
  ]);
  assert.deepEqual(competing.map((r) => r.statusCode).sort(), [200, 409]);
});
test("reversão de conciliação libera saldos; saída só reverte sem vínculos ativos", async () => {
  const s = await scenario(),
    id = await create("conciliacoes-saidas", s.reconciliationBody);
  assert.equal(
    (await post("reversoes-saidas", { saida_id: s.outflow })).statusCode,
    409,
  );
  await create("reversoes-saidas", { conciliacao_id: id });
  assert.equal(
    (await row("pagamento_conciliacao_consulta", s.payment)).nao_conciliado,
    "60.00",
  );
  assert.equal(
    (await row("saida_extrato_fornecedor_consulta", s.outflow)).nao_conciliado,
    "100.00",
  );
  assert.equal(
    (await row("pagamento_fornecedor_consulta", s.payment)).disponivel,
    "60.00",
  );
  await create("reversoes-saidas", { saida_id: s.outflow });
  assert.equal(
    (await post("conciliacoes-saidas", s.reconciliationBody)).statusCode,
    409,
  );
  assert.equal(
    (await post("reversoes-saidas", { conciliacao_id: id })).statusCode,
    409,
  );
});
test("reversão do pagamento preserva extrato e reabre conciliação após reversão da liquidação", async () => {
  const s = await scenario(),
    id = await create("conciliacoes-saidas", s.reconciliationBody);
  const settlement = await create("liquidacoes", {
    obrigacao_id: s.obligation,
    pagamento_id: s.payment,
    liquidada_em: "2026-09-02T13:00:00Z",
    valor: "30.00",
  });
  assert.equal(
    (await post("reversoes", { pagamento_id: s.payment })).statusCode,
    409,
  );
  await create("reversoes", { liquidacao_id: settlement });
  await create("reversoes", { pagamento_id: s.payment });
  assert.equal(
    (await row("conciliacao_saida_fornecedor_consulta", id)).ativo,
    false,
  );
  assert.equal(
    (await row("saida_extrato_fornecedor_consulta", s.outflow)).revertido,
    false,
  );
  assert.equal(
    (await row("saida_extrato_fornecedor_consulta", s.outflow)).nao_conciliado,
    "100.00",
  );
  assert.equal(
    (await post("conciliacoes-saidas", s.reconciliationBody)).statusCode,
    409,
  );
});
test("correção de extrato exige reversão, mesma origem e uma única sucessora", async () => {
  const s = await scenario(),
    body = {
      ...s.outflowBody,
      correcao_de_id: s.outflow,
      referencia: randomUUID(),
      valor: "110.00",
    };
  assert.equal((await post("saidas-extrato", body)).statusCode, 409);
  await create("reversoes-saidas", { saida_id: s.outflow });
  assert.equal(
    (
      await post("saidas-extrato", {
        ...body,
        referencia_externa: randomUUID(),
      })
    ).statusCode,
    409,
  );
  const rs = await Promise.all([
    post("saidas-extrato", body),
    post("saidas-extrato", { ...body, referencia: randomUUID() }),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal(
    (await row("saida_extrato_fornecedor", s.outflow)).valor,
    "100.00",
  );
});
test("conta, unidade, RLS e permissões bloqueiam vínculos cruzados", async () => {
  const s = await scenario(),
    other = await scenario();
  assert.equal(
    (
      await post("conciliacoes-saidas", {
        ...s.reconciliationBody,
        saida_id: other.outflow,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await post("conciliacoes-saidas", {
        ...s.reconciliationBody,
        unidade_id: f.otherUnit,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (await post("saidas-extrato", s.outflowBody, randomUUID(), f.readerToken))
      .statusCode,
    403,
  );
  assert.equal(
    (
      await post(
        "conciliacoes-saidas",
        s.reconciliationBody,
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
          "SELECT id FROM saida_extrato_fornecedor_consulta WHERE id=$1",
          [s.outflow],
        )
      ).rowCount,
      0,
    ),
  );
  const id = await create("conciliacoes-saidas", s.reconciliationBody);
  for (const path of [
    `saidas-extrato?conta_financeira_id=${s.account}`,
    `conciliacoes-saidas?saida_id=${s.outflow}`,
    `reversoes-saidas?conciliacao_id=${id}`,
    `pagamentos-conciliacao?fornecedor_id=${s.supplier}`,
  ]) {
    const r = await app.inject({
      url: `/v1/a-pagar/${path}&unidade_id=${f.unit}`,
      headers: { authorization: `Bearer ${f.adminToken}` },
    });
    assert.equal(r.statusCode, 200, r.body);
    if (path.startsWith("conciliacoes-saidas"))
      assert.equal(r.json().items[0].ativo, true);
  }
  await assert.rejects(
    admin.query("UPDATE hvb.saida_extrato_fornecedor SET valor=1 WHERE id=$1", [
      s.outflow,
    ]),
  );
  await assert.rejects(
    admin.query(
      "INSERT INTO hvb.reversao_saida_fornecedor(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,saida_id) SELECT gen_random_uuid(),organizacao_id,unidade_id,autor_id,comando_id,motivo,id FROM hvb.saida_extrato_fornecedor WHERE id=$1",
      [s.outflow],
    ),
    /Comando de exame ausente ou concluido/,
  );
});
test("valores e alvo único são explícitos; divergência temporal não é conciliada por inferência", async () => {
  const s = await scenario();
  for (const valor of [1, "0.001"])
    assert.equal(
      (await post("conciliacoes-saidas", { ...s.reconciliationBody, valor }))
        .statusCode,
      400,
    );
  for (const valor of ["0.00", "60.01"])
    assert.equal(
      (await post("conciliacoes-saidas", { ...s.reconciliationBody, valor }))
        .statusCode,
      409,
    );
  assert.equal((await post("reversoes-saidas", {})).statusCode, 400);
  assert.equal(
    (
      await post("reversoes-saidas", {
        saida_id: s.outflow,
        conciliacao_id: randomUUID(),
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await post("saidas-extrato", {
        ...s.outflowBody,
        referencia: randomUUID(),
        referencia_externa: randomUUID(),
        ocorrido_em: "2099-01-01T00:00:00Z",
      })
    ).statusCode,
    409,
  );
  const earlier = await create("saidas-extrato", {
    ...s.outflowBody,
    referencia: randomUUID(),
    referencia_externa: randomUUID(),
    ocorrido_em: "2026-09-01T12:00:00Z",
  });
  assert.equal(
    (await row("saida_extrato_fornecedor_consulta", earlier)).nao_conciliado,
    "100.00",
  );
  await create("conciliacoes-saidas", {
    ...s.reconciliationBody,
    saida_id: earlier,
  });
});
test("crédito comercial não é pagamento bancário conciliável", async () => {
  const s = await scenario();
  const credit = await create("creditos", {
    fornecedor_id: s.supplier,
    origem: "outro",
    referencia: randomUUID(),
    documento_referencia: randomUUID(),
    descricao: "Crédito fictício",
    ocorrido_em: "2026-09-01T12:00:00Z",
    valor: "60.00",
  });
  const application = await create("aplicacoes-creditos", {
    credito_id: credit,
    obrigacao_id: s.obligation,
    liquidada_em: "2026-09-02T13:00:00Z",
    valor: "40.00",
  });
  for (const pagamento_id of [credit, application])
    assert.equal(
      (
        await post("conciliacoes-saidas", {
          ...s.reconciliationBody,
          pagamento_id,
        })
      ).statusCode,
      409,
    );
  assert.equal(
    (await row("saida_extrato_fornecedor_consulta", s.outflow)).nao_conciliado,
    "100.00",
  );
});
test("conciliação concorrente com estorno de pagamento não deixa vínculo ativo indevido", async () => {
  const s = await scenario();
  const [linked, reversed] = await Promise.all([
    post("conciliacoes-saidas", s.reconciliationBody),
    post("reversoes", { pagamento_id: s.payment }),
  ]);
  assert.equal(reversed.statusCode, 200, reversed.body);
  assert([200, 409].includes(linked.statusCode), linked.body);
  assert.equal(
    (await row("saida_extrato_fornecedor_consulta", s.outflow)).nao_conciliado,
    "100.00",
  );
  const rows = (
    await admin.query(
      "SELECT ativo FROM hvb.conciliacao_saida_fornecedor_consulta WHERE saida_id=$1",
      [s.outflow],
    )
  ).rows;
  assert(rows.every((r) => r.ativo === false));
});
