import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { installmentScenario } from "../scripts/installment-scenario.ts";
let app: FastifyInstance,
  db: pg.Pool,
  admin: pg.Pool,
  f: Awaited<ReturnType<typeof seedFixture>>,
  foreign: typeof f;
type Scenario = Awaited<ReturnType<typeof installmentScenario>>;
const common = () => ({
  unidade_id: f.unit,
  motivo: "Teste fictício C8",
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
const scenario = () => installmentScenario(app, f.adminToken, f.unit);
function installmentId(s: Scenario, index = 0) {
  const item = s.installments[index];
  assert(item);
  return item.id;
}
const allocation = (
  s: Scenario,
  settlement: string,
  valor = "40.00",
  index = 0,
) => ({
  parcela_id: s.installments[index]?.id,
  liquidacao_id: settlement,
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

test("plano distribui valor integral sem criar nova dívida, pagamento ou estoque", async () => {
  const s = await scenario();
  assert.equal(
    (await row("plano_parcelas_fornecedor_consulta", s.plan)).valor_obrigacao,
    "100.00",
  );
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", s.obligation)).saldo,
    "100.00",
  );
  const obligations = await admin.query(
    "SELECT count(*)::int n FROM hvb.obrigacao_fornecedor WHERE fornecedor_id=$1",
    [s.supplier],
  );
  assert.equal(obligations.rows[0].n, 1);
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
    (await row("posicao_estoque", s.purchasePosition)).saldo_base,
    "0.000000",
  );
  assert.equal(
    (await row("parcela_fornecedor_consulta", installmentId(s))).saldo,
    "40.00",
  );
  assert.equal(
    (await row("parcela_fornecedor_consulta", installmentId(s, 1))).saldo,
    "60.00",
  );
});
test("soma incorreta, valor zero e datas fora de ordem rejeitam o plano atomicamente", async () => {
  const s = await scenario(),
    body = { ...s.planBody, versao_esperada: 1 };
  for (const parcelas of [
    [{ vencimento: "2026-10-01", valor: "99.99" }],
    [
      { vencimento: "2026-10-01", valor: "0.00" },
      { vencimento: "2026-10-02", valor: "100.00" },
    ],
    [
      { vencimento: "2026-11-01", valor: "40.00" },
      { vencimento: "2026-10-01", valor: "60.00" },
    ],
  ])
    assert.equal(
      (await post("planos-parcelas", { ...body, parcelas })).statusCode,
      409,
    );
  for (const parcelas of [
    [],
    [{ vencimento: "2026-02-30", valor: "100.00" }],
    [{ vencimento: "2026-10-01", valor: 100 }],
    [{ vencimento: "2026-10-01", valor: "100.001" }],
  ])
    assert.equal(
      (await post("planos-parcelas", { ...body, parcelas })).statusCode,
      400,
    );
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.plano_parcelas_fornecedor WHERE obrigacao_id=$1",
        [s.obligation],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (await row("plano_parcelas_fornecedor_consulta", s.plan)).atual,
    true,
  );
});
test("liquidação anterior permanece sem parcela até alocação explícita, sem duplicar baixa", async () => {
  const s = await scenario(),
    { settlement } = await s.settle("legado");
  const next = await create("planos-parcelas", {
    ...s.planBody,
    versao_esperada: 1,
  });
  assert.equal(
    (await row("plano_parcelas_fornecedor_consulta", next))
      .liquidado_sem_parcela,
    "60.00",
  );
  assert.equal(
    (await row("liquidacao_parcela_consulta", settlement)).nao_alocado,
    "60.00",
  );
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", s.obligation)).saldo,
    "40.00",
  );
  const parcels = (
    await admin.query(
      "SELECT id FROM hvb.parcela_fornecedor WHERE plano_id=$1 ORDER BY numero",
      [next],
    )
  ).rows;
  await create("alocacoes-parcelas", {
    parcela_id: parcels[0].id,
    liquidacao_id: settlement,
    valor: "40.00",
  });
  await create("alocacoes-parcelas", {
    parcela_id: parcels[1].id,
    liquidacao_id: settlement,
    valor: "20.00",
  });
  assert.equal(
    (await row("parcela_fornecedor_consulta", parcels[1].id)).saldo,
    "40.00",
  );
  assert.equal(
    (await row("plano_parcelas_fornecedor_consulta", next))
      .liquidado_sem_parcela,
    "0.00",
  );
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", s.obligation)).saldo,
    "40.00",
  );
});
test("alocação idempotente e reversão recompõem parcela sem desfazer liquidação", async () => {
  const s = await scenario(),
    { settlement } = await s.settle("parcial"),
    key = randomUUID(),
    body = allocation(s, settlement);
  const rs = await Promise.all([
    post("alocacoes-parcelas", body, key),
    post("alocacoes-parcelas", body, key),
  ]);
  for (const r of rs) assert.equal(r.statusCode, 200, r.body);
  assert.equal(rs[0]?.json().id, rs[1]?.json().id);
  assert.equal((await post("alocacoes-parcelas", body)).statusCode, 409);
  await create("reversoes-parcelas", { alocacao_id: rs[0]?.json().id });
  assert.equal(
    (await row("parcela_fornecedor_consulta", installmentId(s))).saldo,
    "40.00",
  );
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", s.obligation)).saldo,
    "40.00",
  );
  assert.equal(
    (await row("liquidacao_parcela_consulta", settlement)).nao_alocado,
    "60.00",
  );
  assert.equal(
    (await post("reversoes-parcelas", { alocacao_id: rs[0]?.json().id }))
      .statusCode,
    409,
  );
});
test("alocações concorrentes respeitam limites da parcela e da liquidação", async () => {
  const s = await scenario(),
    { settlement } = await s.settle("concorrencia", "80.00");
  const rs = await Promise.all([
    post("alocacoes-parcelas", allocation(s, settlement, "40.00", 0)),
    post("alocacoes-parcelas", allocation(s, settlement, "50.00", 1)),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal(
    (await post("alocacoes-parcelas", allocation(s, settlement, "60.01", 1)))
      .statusCode,
    409,
  );
  const unassigned = (await row("liquidacao_parcela_consulta", settlement))
    .nao_alocado;
  assert(["40.00", "30.00"].includes(unassigned));
});
test("reprogramação exige reverter alocações e aceita uma única sucessora concorrente", async () => {
  const s = await scenario(),
    { settlement } = await s.settle("reprogramar"),
    id = await create("alocacoes-parcelas", allocation(s, settlement));
  const body = {
    ...s.planBody,
    versao_esperada: 1,
    parcelas: [
      { vencimento: "2026-11-30", valor: "50.00" },
      { vencimento: "2026-12-30", valor: "50.00" },
    ],
  };
  assert.equal((await post("planos-parcelas", body)).statusCode, 409);
  await create("reversoes-parcelas", { alocacao_id: id });
  const rs = await Promise.all([
    post("planos-parcelas", body),
    post("planos-parcelas", body),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal(
    (await row("plano_parcelas_fornecedor_consulta", s.plan)).atual,
    false,
  );
  assert.equal(
    (await row("parcela_fornecedor_consulta", installmentId(s))).vigente,
    false,
  );
  assert.equal(
    (await post("alocacoes-parcelas", allocation(s, settlement))).statusCode,
    409,
  );
  assert.equal((await row("liquidacao_fornecedor", settlement)).valor, "60.00");
});
test("reversão da liquidação inativa alocações; obrigação corrigida exige novo plano", async () => {
  const s = await scenario(),
    { settlement } = await s.settle("estornar"),
    id = await create("alocacoes-parcelas", allocation(s, settlement));
  await s.payable("estorno-liquidacao", "reversoes", {
    liquidacao_id: settlement,
  });
  assert.equal(
    (await row("alocacao_parcela_fornecedor_consulta", id)).ativo,
    false,
  );
  assert.equal(
    (await row("parcela_fornecedor_consulta", installmentId(s))).saldo,
    "40.00",
  );
  assert.equal(
    (await post("alocacoes-parcelas", allocation(s, settlement))).statusCode,
    409,
  );
  await s.payable("estorno-obrigacao", "reversoes", {
    obrigacao_id: s.obligation,
  });
  assert.equal(
    (await row("parcela_fornecedor_consulta", installmentId(s))).vigente,
    false,
  );
  assert.equal(
    (await post("planos-parcelas", { ...s.planBody, versao_esperada: 1 }))
      .statusCode,
    409,
  );
  const corrected = await s.payable("corrigir", "obrigacoes", {
    ...s.obligationBody,
    referencia: randomUUID(),
    correcao_de_id: s.obligation,
    valor: "120.00",
  });
  const next = await create("planos-parcelas", {
    obrigacao_id: corrected,
    versao_esperada: 0,
    parcelas: [{ vencimento: "2026-12-01", valor: "120.00" }],
  });
  assert.equal(
    (await row("plano_parcelas_fornecedor_consulta", next))
      .liquidado_sem_parcela,
    "0.00",
  );
});
test("contextos cruzados, unidade, RLS e permissões bloqueiam alocações impróprias", async () => {
  const s = await scenario(),
    other = await scenario(),
    { settlement } = await other.settle("outro");
  assert.equal(
    (await post("alocacoes-parcelas", allocation(s, settlement))).statusCode,
    409,
  );
  assert.equal(
    (
      await post("planos-parcelas", {
        ...s.planBody,
        versao_esperada: 1,
        unidade_id: f.otherUnit,
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await post(
        "planos-parcelas",
        { ...s.planBody, versao_esperada: 1 },
        randomUUID(),
        f.readerToken,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await post(
        "alocacoes-parcelas",
        allocation(s, settlement),
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
          "SELECT id FROM parcela_fornecedor_consulta WHERE plano_id=$1",
          [s.plan],
        )
      ).rowCount,
      0,
    ),
  );
  for (const path of [
    `planos-parcelas?obrigacao_id=${s.obligation}`,
    `parcelas?plano_id=${s.plan}`,
    `alocacoes-parcelas?parcela_id=${s.installments[0]?.id}`,
    "reversoes-parcelas?limit=1",
    `liquidacoes-para-parcelas?obrigacao_id=${s.obligation}`,
  ]) {
    const r = await app.inject({
      url: `/v1/a-pagar/${path}&unidade_id=${f.unit}`,
      headers: { authorization: `Bearer ${f.adminToken}` },
    });
    assert.equal(r.statusCode, 200, r.body);
  }
  await assert.rejects(
    admin.query("UPDATE hvb.parcela_fornecedor SET valor=1 WHERE plano_id=$1", [
      s.plan,
    ]),
  );
  await assert.rejects(
    admin.query(
      "INSERT INTO hvb.parcela_fornecedor(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,plano_id,numero,vencimento,valor) SELECT gen_random_uuid(),organizacao_id,unidade_id,autor_id,comando_id,motivo,plano_id,numero,vencimento,valor FROM hvb.parcela_fornecedor WHERE plano_id=$1 LIMIT 1",
      [s.plan],
    ),
    /Comando de exame ausente ou concluido/,
  );
});
test("estorno concorrente de liquidação não deixa parcela quitada indevidamente", async () => {
  const s = await scenario(),
    { settlement } = await s.settle("race");
  const [assigned, reversed] = await Promise.all([
    post("alocacoes-parcelas", allocation(s, settlement)),
    post("reversoes", { liquidacao_id: settlement }),
  ]);
  assert.equal(reversed.statusCode, 200, reversed.body);
  assert([200, 409].includes(assigned.statusCode), assigned.body);
  assert.equal(
    (await row("parcela_fornecedor_consulta", installmentId(s))).saldo,
    "40.00",
  );
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", s.obligation)).saldo,
    "100.00",
  );
});
test("plano também cobre despesa e vencimentos iguais explícitos sem inferir juros", async () => {
  const s = await scenario();
  const obligation = await s.payable("despesa", "obrigacoes", {
    ...s.obligationBody,
    pedido_id: undefined,
    origem: "despesa",
    referencia: randomUUID(),
    documento_referencia: randomUUID(),
    valor: "10.01",
  });
  const id = await create("planos-parcelas", {
    obrigacao_id: obligation,
    versao_esperada: 0,
    parcelas: [
      { vencimento: "2026-10-15", valor: "5.00" },
      { vencimento: "2026-10-15", valor: "5.01" },
    ],
  });
  assert.equal(
    (await row("plano_parcelas_fornecedor_consulta", id)).valor_obrigacao,
    "10.01",
  );
  assert.equal(
    (await row("obrigacao_fornecedor_consulta", obligation)).saldo,
    "10.01",
  );
});
