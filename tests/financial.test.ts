import { after, afterEach, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { financialScenario } from "../scripts/financial-scenario.ts";
import { financialLists } from "../src/domain/financial/service.ts";
import { dailyScenario } from "../scripts/daily-scenario.ts";
import { clinicalTime } from "../scripts/clinical-scenario.ts";
let app: FastifyInstance,
  db: pg.Pool,
  admin: pg.Pool,
  f: Awaited<ReturnType<typeof seedFixture>>,
  foreign: typeof f;
const common = () => ({
  unidade_id: f.unit,
  simulacao: true,
  confirmacao_humana: true,
  motivo: "Teste fictício M5",
});
const post = (
  path: string,
  body: Record<string, unknown>,
  key = randomUUID(),
  token = f.adminToken,
) =>
  app.inject({
    method: "POST",
    url: `/v1/financeiro/${path}`,
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
const scenario = () => financialScenario(app, f.adminToken, f.unit);
type Scenario = Awaited<ReturnType<typeof scenario>>;
async function invoice(s: Scenario, amount = "100.00") {
  const item = await create("itens", {
    conta_id: s.account,
    avaliacao_id: s.evaluation,
    responsabilidades: [{ pagador_id: s.payer, valor: "100.00" }],
  });
  const resp = (
    await admin.query(
      "SELECT id FROM hvb.responsabilidade WHERE item_conta_id=$1",
      [item],
    )
  ).rows[0].id;
  const title = await create("titulos", {
    pagador_id: s.payer,
    vencimento: "2026-09-30",
    itens: [{ responsabilidade_id: resp, valor: amount }],
  });
  return { item, resp, title };
}
const receive = (
  s: Scenario,
  valor = "100.00",
  extra: Record<string, unknown> = {},
) =>
  create("recebimentos", {
    pagador_id: s.payer,
    meio: "transferencia",
    referencia: randomUUID(),
    recebido_em: "2026-09-02T12:00:00Z",
    valor,
    evidencia: "Comprovante fictício, sem transação externa",
    ...extra,
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
afterEach(async () => {
  const rows = await admin.query(
    "SELECT (SELECT count(*) FROM hvb.titulo_consulta WHERE organizacao_id=$1 AND saldo<0)+(SELECT count(*) FROM hvb.recebimento_consulta WHERE organizacao_id=$1 AND disponivel<0)+(SELECT count(*) FROM hvb.credito_consulta WHERE organizacao_id=$1 AND disponivel<0)+(SELECT count(*) FROM hvb.parcela_adquirente_consulta WHERE organizacao_id=$1 AND saldo<0)+(SELECT count(*) FROM hvb.deposito_consulta WHERE organizacao_id=$1 AND (nao_alocado<0 OR nao_conciliado<0)) AS invalidos",
    [f.org],
  );
  assert.equal(rows.rows[0].invalidos, "0");
});
async function external(path: string, body: Record<string, unknown>) {
  const r = await app.inject({
    method: "POST",
    url: `/v1${path}`,
    headers: {
      authorization: `Bearer ${f.adminToken}`,
      "idempotency-key": randomUUID(),
    },
    payload: body,
  });
  assert.equal(r.statusCode, 200, r.body);
  return r.json().id as string;
}
test("catálogo e preço preservam versão, vigência e centavos sem coerção", async () => {
  const s = await scenario();
  for (const valor of [0.01, "0.001", "-1", "NaN"]) {
    assert.equal(
      (
        await post("precos", {
          item_comercial_id: s.catalog,
          versao: 2,
          inicio: "2026-10-01T00:00:00Z",
          fim: "2026-11-01T00:00:00Z",
          valor,
        })
      ).statusCode,
      400,
    );
  }
  assert.equal(
    (
      await post("precos", {
        item_comercial_id: s.catalog,
        versao: 2,
        inicio: "2026-09-20T00:00:00Z",
        fim: "2026-11-01T00:00:00Z",
        valor: "110.00",
      })
    ).statusCode,
    409,
  );
  await create("precos", {
    item_comercial_id: s.catalog,
    versao: 2,
    inicio: "2026-10-01T00:00:00Z",
    fim: "2026-11-01T00:00:00Z",
    valor: "110.00",
  });
  assert.equal((await row("avaliacao_cobranca", s.evaluation)).bruto, "100.00");
  await assert.rejects(
    admin.query("UPDATE hvb.preco_versao SET valor=1 WHERE id=$1", [s.price]),
    { code: "23514" },
  );
});
test("origem comercial única, confirmação literal e reavaliação com versão esperada", async () => {
  const s = await scenario();
  assert.equal(
    (
      await post("eventos", {
        item_comercial_id: s.catalog,
        execucao_id: s.execution,
        quantidade: "1",
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await post("contas", {
        episodio_id: s.episode,
        descricao: "Fictícia",
        simulacao: "true",
      })
    ).statusCode,
    400,
  );
  const body = {
      evento_id: s.event,
      versao_esperada: 1,
      preco_id: s.price,
      decisao: "cobravel",
      desconto: "10.00",
    },
    key = randomUUID();
  const results = await Promise.all(
    Array.from({ length: 5 }, () => post("avaliacoes", body, key)),
  );
  assert.ok(
    results.every((r) => r.statusCode === 200),
    results.map((r) => r.body).join(),
  );
  assert.equal(new Set(results.map((r) => r.json().id)).size, 1);
  assert.equal(
    (await row("avaliacao_cobranca", results[0]?.json().id)).valor,
    "90.00",
  );
  assert.equal((await post("avaliacoes", body)).statusCode, 409);
});
test("preço ausente fica pendente e emissão não produz conta a receber fictícia", async () => {
  const s = await scenario();
  const pending = await create("avaliacoes", {
    evento_id: s.event,
    versao_esperada: 1,
    decisao: "cobravel",
    desconto: "0.00",
  });
  assert.equal(
    (await row("avaliacao_cobranca", pending)).resultado,
    "pendente",
  );
  assert.equal(
    (
      await post("itens", {
        conta_id: s.account,
        avaliacao_id: pending,
        responsabilidades: [],
      })
    ).statusCode,
    409,
  );
  const exempt = await create("avaliacoes", {
    evento_id: s.event,
    versao_esperada: 2,
    preco_id: s.price,
    decisao: "isento",
    desconto: "100.00",
  });
  const item = await create("itens", {
    conta_id: s.account,
    avaliacao_id: exempt,
    responsabilidades: [],
  });
  assert.equal((await row("item_conta", item)).valor, "0.00");
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.responsabilidade WHERE item_conta_id=$1",
        [item],
      )
    ).rows[0].n,
    0,
  );
});
test("responsabilidades fecham valor; falha desfaz item, comando e rateio", async () => {
  const s = await scenario();
  const body = {
    conta_id: s.account,
    avaliacao_id: s.evaluation,
    responsabilidades: [{ pagador_id: s.payer, valor: "99.99" }],
  };
  const r = await post("itens", body);
  assert.equal(r.statusCode, 409);
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.item_conta WHERE avaliacao_id=$1",
        [s.evaluation],
      )
    ).rows[0].n,
    0,
  );
  await invoice(s);
  assert.equal(
    (
      await post("avaliacoes", {
        evento_id: s.event,
        versao_esperada: 1,
        preco_id: s.price,
        decisao: "cobravel",
        desconto: "0.00",
      })
    ).statusCode,
    409,
  );
});
test("títulos parciais concorrentes não duplicam valor da responsabilidade", async () => {
  const s = await scenario(),
    i = await invoice(s, "40.00");
  const body = {
    pagador_id: s.payer,
    vencimento: "2026-09-30",
    itens: [{ responsabilidade_id: i.resp, valor: "60.00" }],
  };
  const rs = await Promise.all([post("titulos", body), post("titulos", body)]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal((await row("titulo_consulta", i.title)).saldo, "40.00");
});
test("recebimento deduplica referência e retry sem liquidar automaticamente", async () => {
  const s = await scenario(),
    i = await invoice(s),
    key = randomUUID(),
    body = {
      pagador_id: s.payer,
      meio: "transferencia",
      referencia: randomUUID(),
      recebido_em: "2026-09-02T12:00:00Z",
      valor: "100.00",
      evidencia: "Fictícia",
    };
  const rs = await Promise.all(
    Array.from({ length: 5 }, () => post("recebimentos", body, key)),
  );
  assert.ok(rs.every((r) => r.statusCode === 200));
  assert.equal(new Set(rs.map((r) => r.json().id)).size, 1);
  assert.equal((await post("recebimentos", body)).statusCode, 409);
  assert.equal((await row("titulo_consulta", i.title)).saldo, "100.00");
});
test("liquidações concorrentes respeitam saldo de ambos os lados", async () => {
  const s = await scenario(),
    i = await invoice(s),
    payment = await receive(s, "120.00");
  const body = { titulo_id: i.title, recebimento_id: payment, valor: "70.00" };
  const rs = await Promise.all([
    post("liquidacoes", body),
    post("liquidacoes", body),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal((await row("titulo_consulta", i.title)).saldo, "30.00");
  assert.equal(
    (await row("recebimento_consulta", payment)).disponivel,
    "50.00",
  );
});
test("crédito usa recebimento disponível e aplicação não duplica dinheiro", async () => {
  const s = await scenario(),
    i = await invoice(s),
    payment = await receive(s, "120.00");
  const credit = await create("creditos", {
    pagador_id: s.payer,
    recebimento_id: payment,
    valor: "120.00",
  });
  assert.equal(
    (
      await post("liquidacoes", {
        titulo_id: i.title,
        recebimento_id: payment,
        valor: "1.00",
      })
    ).statusCode,
    409,
  );
  const body = { credito_id: credit, titulo_id: i.title, valor: "100.00" };
  const rs = await Promise.all([
    post("aplicacoes-credito", body),
    post("aplicacoes-credito", body),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal((await row("credito_consulta", credit)).disponivel, "20.00");
  assert.equal((await row("titulo_consulta", i.title)).saldo, "0.00");
  assert.equal(
    (await post("reversoes", { credito_id: credit })).statusCode,
    409,
  );
  const application = rs.find((r) => r.statusCode === 200)?.json().id;
  await create("reversoes", { aplicacao_id: application });
  await create("reversoes", { credito_id: credit });
  assert.equal(
    (await row("recebimento_consulta", payment)).disponivel,
    "120.00",
  );
});
test("reversão encadeada preserva histórico e permite nova avaliação", async () => {
  const s = await scenario(),
    i = await invoice(s),
    p = await receive(s),
    l = await create("liquidacoes", {
      titulo_id: i.title,
      recebimento_id: p,
      valor: "100.00",
    });
  for (const body of [
    { item_conta_id: i.item },
    { titulo_id: i.title },
    { recebimento_id: p },
  ])
    assert.equal((await post("reversoes", body)).statusCode, 409);
  await create("reversoes", { liquidacao_id: l });
  await create("reversoes", { titulo_id: i.title });
  await create("reversoes", { item_conta_id: i.item });
  await create("reversoes", { recebimento_id: p });
  assert.equal((await row("item_conta_consulta", i.item)).revertido, true);
  assert.equal((await post("reversoes", { liquidacao_id: l })).statusCode, 409);
  await create("avaliacoes", {
    evento_id: s.event,
    versao_esperada: 1,
    preco_id: s.price,
    decisao: "cobravel",
    desconto: "5.00",
  });
});
test("caixa tem uma sessão aberta, diferença explícita e fechamento preservado", async () => {
  const s = await scenario(),
    cash = await create("caixas", { descricao: "Caixa Fictício" }),
    body = {
      caixa_id: cash,
      aberta_em: "2026-09-02T08:00:00Z",
      abertura: "10.00",
    };
  const rs = await Promise.all([post("sessoes", body), post("sessoes", body)]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  const session = rs.find((r) => r.statusCode === 200)?.json().id,
    p = await receive(s, "100.00", { meio: "dinheiro", sessao_id: session });
  const closed = await create("fechamentos", {
    sessao_id: session,
    fechada_em: "2026-09-02T18:00:00Z",
    contado: "109.50",
  });
  assert.equal((await row("fechamento_caixa", closed)).diferenca, "-0.50");
  assert.equal(
    (await post("reversoes", { recebimento_id: p })).statusCode,
    409,
  );
  assert.equal(
    (
      await post("recebimentos", {
        pagador_id: s.payer,
        meio: "dinheiro",
        sessao_id: session,
        referencia: randomUUID(),
        recebido_em: "2026-09-02T15:00:00Z",
        valor: "1.00",
        evidencia: "Fictícia",
      })
    ).statusCode,
    409,
  );
});
test("cartão, depósito e conciliação permanecem fatos separados com limites", async () => {
  const s = await scenario(),
    i = await invoice(s),
    p = await receive(s, "100.00", { meio: "cartao" });
  await create("liquidacoes", {
    titulo_id: i.title,
    recebimento_id: p,
    valor: "100.00",
  });
  const parcel = await create("parcelas", {
    recebimento_id: p,
    numero: 1,
    adquirente: "Adquirente Fictícia",
    referencia: randomUUID(),
    repasse_previsto: "2026-09-05",
    bruto: "100.00",
    taxa: "3.00",
    liquido: "97.00",
  });
  assert.equal(
    (await row("parcela_adquirente_consulta", parcel)).saldo,
    "97.00",
  );
  const bank = await create("contas-financeiras", {
    descricao: "Conta Fictícia",
  });
  const deposit = await create("depositos", {
    conta_financeira_id: bank,
    adquirente: "Adquirente Fictícia",
    referencia: randomUUID(),
    depositado_em: "2026-09-05T12:00:00Z",
    valor: "97.00",
    evidencia: "Depósito fictício",
  });
  const allocation = await create("alocacoes-deposito", {
    deposito_id: deposit,
    parcela_id: parcel,
    valor: "97.00",
  });
  assert.equal(
    (await row("deposito_consulta", deposit)).nao_conciliado,
    "97.00",
  );
  const statement = await create("extrato", {
    conta_financeira_id: bank,
    referencia: randomUUID(),
    ocorrido_em: "2026-09-05T12:00:00Z",
    valor: "97.00",
    evidencia: "Extrato fictício informado",
  });
  const body = {
    deposito_id: deposit,
    extrato_id: statement,
    valor: "97.00",
    evidencia: "Conferência humana fictícia",
  };
  const rs = await Promise.all([
    post("conciliacoes", body),
    post("conciliacoes", body),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal(
    (await row("deposito_consulta", deposit)).nao_conciliado,
    "0.00",
  );
  await create("reversoes", {
    conciliacao_id: rs.find((r) => r.statusCode === 200)?.json().id,
  });
  await create("reversoes", { alocacao_deposito_id: allocation });
  assert.equal(
    (await row("parcela_adquirente_consulta", parcel)).saldo,
    "97.00",
  );
});
test("RBAC, organização, unidade e pagador impedem alocação cruzada", async () => {
  const s = await scenario(),
    i = await invoice(s),
    other = await scenario(),
    p = await receive(other);
  assert.equal(
    (
      await post("liquidacoes", {
        titulo_id: i.title,
        recebimento_id: p,
        valor: "1.00",
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await post(
        "contas",
        { episodio_id: s.episode, descricao: "Fictícia" },
        randomUUID(),
        f.nurseToken,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await post("contas", {
        episodio_id: s.episode,
        descricao: "Fictícia",
        unidade_id: f.otherUnit,
      })
    ).statusCode,
    409,
  );
  const r = await post(
    "itens",
    {
      conta_id: s.account,
      avaliacao_id: s.evaluation,
      responsabilidades: [],
      unidade_id: foreign.unit,
    },
    randomUUID(),
    foreign.adminToken,
  );
  assert.ok([404, 409].includes(r.statusCode));
});
test("listas financeiras paginadas serializam valores exatos e estado", async () => {
  for (const l of financialLists) {
    const r = await app.inject({
      url: `/v1${l.path}?unidade_id=${f.unit}&limit=2`,
      headers: { authorization: `Bearer ${f.adminToken}` },
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.ok(r.json().items.length <= 2);
  }
});

test("diária omitida permanece pendente; inclusão documenta zero e reversão sinaliza revisão", async () => {
  const d = await dailyScenario(app, f.adminToken, f.unit),
    s = await financialScenario(app, f.adminToken, f.unit, randomUUID(), d);
  assert.equal(
    (await row("avaliacao_cobranca", s.evaluation)).resultado,
    "pendente",
  );
  const event = await external("/diarias/eventos", {
    execucao_id: s.execution,
    motivo: "Fictício",
  });
  const cover = await external(`/diarias/eventos/${event}/avaliar`, {
    periodo_diaria_id: d.period,
    versao_esperada: 0,
    motivo: "Fictício",
  });
  const av = await create("avaliacoes", {
    evento_id: s.event,
    versao_esperada: 1,
    preco_id: s.price,
    cobertura_id: cover,
    decisao: "cobertura",
    desconto: "0.00",
  });
  assert.equal((await row("avaliacao_cobranca", av)).resultado, "incluido");
  const item = await create("itens", {
    conta_id: s.account,
    avaliacao_id: av,
    responsabilidades: [],
  });
  assert.equal((await row("item_conta", item)).valor, "0.00");
  await external(`/diarias/avaliacoes/${cover}/reverter`, {
    motivo: "Revisão fictícia",
  });
  assert.equal(
    (await row("item_conta_consulta", item)).necessita_revisao,
    true,
  );
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    "20.000000",
  );
});
test("retificação clínica preserva dívida histórica e impede nova emissão obsoleta", async () => {
  const s = await scenario();
  const item = await create("itens", {
    conta_id: s.account,
    avaliacao_id: s.evaluation,
    responsabilidades: [{ pagador_id: s.payer, valor: "100.00" }],
  });
  await external(`/clinica/execucoes/${s.execution}/retificar`, {
    evento_referencia: randomUUID(),
    executada_em: clinicalTime,
    quantidade_aplicada: "0.5",
    unidade_medida_id: s.measure,
    resultado: "parcial",
    situacao_material: "nao_utilizado",
    confirmacao_humana: true,
    motivo: "Retificação fictícia",
  });
  assert.equal(
    (await row("item_conta_consulta", item)).necessita_revisao,
    true,
  );
  const resp = (
    await admin.query(
      "SELECT id FROM hvb.responsabilidade WHERE item_conta_id=$1",
      [item],
    )
  ).rows[0].id;
  assert.equal(
    (
      await post("titulos", {
        pagador_id: s.payer,
        vencimento: "2026-09-30",
        itens: [{ responsabilidade_id: resp, valor: "100.00" }],
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    "20.000000",
  );
});
test("consumo do tutor mantém custo e cobertura comercial pendente", async () => {
  const s = await scenario();
  const consumption = await external("/clinica/consumos", {
    episodio_id: s.episode,
    evento_referencia: randomUUID(),
    ocorrido_em: clinicalTime,
    finalidade: "Fictícia",
    motivo: "Fictício",
    itens_confirmados: true,
    itens: [{ posicao_id: s.position, quantidade_base: "0.3" }],
  });
  const ci = (
    await admin.query(
      "SELECT id,custo_total_snapshot FROM hvb.consumo_item WHERE consumo_id=$1",
      [consumption],
    )
  ).rows[0];
  assert.equal(ci.custo_total_snapshot, null);
  const catalog = await create("catalogo", {
    codigo: randomUUID(),
    versao: 1,
    descricao: "Material Fictício",
    tipo: "produto",
    produto_id: s.product,
    unidade_medida_id: s.measure,
  });
  const price = await create("precos", {
    item_comercial_id: catalog,
    versao: 1,
    inicio: "2026-09-01T00:00:00Z",
    fim: "2026-10-01T00:00:00Z",
    valor: "1.25",
  });
  const event = await create("eventos", {
    item_comercial_id: catalog,
    consumo_item_id: ci.id,
    quantidade: "0.3",
  });
  assert.equal(
    (
      await post("avaliacoes", {
        evento_id: event,
        versao_esperada: 0,
        preco_id: price,
        decisao: "cobravel",
        desconto: "0.00",
      })
    ).statusCode,
    409,
  );
  const exactPrice = await create("precos", {
    item_comercial_id: catalog,
    versao: 2,
    inicio: "2026-10-01T00:00:00Z",
    fim: "2026-11-01T00:00:00Z",
    valor: "1.00",
  });
  assert.equal(
    (
      await post("avaliacoes", {
        evento_id: event,
        versao_esperada: 0,
        preco_id: exactPrice,
        decisao: "cobravel",
        desconto: "0.00",
      })
    ).statusCode,
    409,
  );
  const av = await create("avaliacoes", {
    evento_id: event,
    versao_esperada: 0,
    decisao: "cobravel",
    desconto: "0.00",
  });
  assert.equal((await row("avaliacao_cobranca", av)).resultado, "pendente");
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    "19.700000",
  );
});
test("SQL não acrescenta efeito financeiro a comando confirmado nem arredonda centavos", async () => {
  const s = await scenario(),
    p = await receive(s),
    stored = await row("recebimento", p);
  await assert.rejects(
    admin.query(
      "INSERT INTO hvb.recebimento(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,pagador_id,meio,referencia,recebido_em,valor,evidencia) VALUES($1,$2,$3,$4,$5,'Fictício',$6,'transferencia',$7,now(),1,'Fictícia')",
      [
        randomUUID(),
        f.org,
        f.unit,
        f.admin,
        stored.comando_id,
        s.payer,
        randomUUID(),
      ],
    ),
    { code: "23514" },
  );
  await assert.rejects(admin.query("SELECT '0.001'::hvb.valor_monetario"), {
    code: "23514",
  });
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('hvb.org',$1,true)", [foreign.org]);
    assert.equal(
      (await client.query("SELECT id FROM hvb.recebimento WHERE id=$1", [p]))
        .rowCount,
      0,
    );
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
});
test("depósito agregado admite repasses parciais sem liquidar tutor novamente", async () => {
  const s = await scenario(),
    p = await receive(s, "100.00", { meio: "cartao" });
  const parcelas = [];
  for (let n = 1; n <= 2; n++)
    parcelas.push(
      await create("parcelas", {
        recebimento_id: p,
        numero: n,
        adquirente: "Fictícia",
        referencia: randomUUID(),
        repasse_previsto: "2026-09-05",
        bruto: "50.00",
        taxa: "1.00",
        liquido: "49.00",
      }),
    );
  const bank = await create("contas-financeiras", { descricao: "Fictícia" }),
    d = await create("depositos", {
      conta_financeira_id: bank,
      adquirente: "Fictícia",
      referencia: randomUUID(),
      depositado_em: clinicalTime,
      valor: "80.00",
      evidencia: "Fictícia",
    });
  await create("alocacoes-deposito", {
    deposito_id: d,
    parcela_id: parcelas[0],
    valor: "49.00",
  });
  await create("alocacoes-deposito", {
    deposito_id: d,
    parcela_id: parcelas[1],
    valor: "31.00",
  });
  assert.equal(
    (await row("parcela_adquirente_consulta", parcelas[1] ?? "")).saldo,
    "18.00",
  );
  assert.equal((await row("recebimento_consulta", p)).disponivel, "100.00");
});

test("execução substituta exige reverter documento anterior para não duplicar dívida", async () => {
  const s = await scenario(),
    invoiceOld = await invoice(s);
  const corrected = await external(
    `/clinica/execucoes/${s.execution}/retificar`,
    {
      evento_referencia: randomUUID(),
      executada_em: clinicalTime,
      quantidade_aplicada: "1",
      unidade_medida_id: s.measure,
      resultado: "integral",
      situacao_material: "nao_utilizado",
      confirmacao_humana: true,
      motivo: "Correção fictícia",
    },
  );
  const event = await create("eventos", {
    item_comercial_id: s.catalog,
    execucao_id: corrected,
    quantidade: "1",
  });
  const pending = await create("avaliacoes", {
    evento_id: event,
    versao_esperada: 0,
    preco_id: s.price,
    decisao: "cobravel",
    desconto: "0.00",
  });
  assert.equal(
    (await row("avaliacao_cobranca", pending)).resultado,
    "pendente",
  );
  await create("reversoes", { titulo_id: invoiceOld.title });
  await create("reversoes", { item_conta_id: invoiceOld.item });
  const approved = await create("avaliacoes", {
    evento_id: event,
    versao_esperada: 1,
    preco_id: s.price,
    decisao: "cobravel",
    desconto: "0.00",
  });
  assert.equal((await row("avaliacao_cobranca", approved)).valor, "100.00");
});
