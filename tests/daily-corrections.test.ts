import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { clinicalTime } from "../scripts/clinical-scenario.ts";
import { dailyScenario } from "../scripts/daily-scenario.ts";
import { financialScenario } from "../scripts/financial-scenario.ts";
let app: FastifyInstance,
  db: pg.Pool,
  admin: pg.Pool,
  f: Awaited<ReturnType<typeof seedFixture>>,
  foreign: typeof f;
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
async function create(path: string, body: Record<string, unknown>) {
  const r = await post(path, body);
  assert.equal(r.statusCode, 200, r.body);
  return r.json().id as string;
}
async function row(table: string, id: string) {
  return (await admin.query(`SELECT * FROM hvb.${table} WHERE id=$1`, [id]))
    .rows[0];
}
const scenario = () => dailyScenario(app, f.adminToken, f.unit);
type Scenario = Awaited<ReturnType<typeof scenario>>;
const confirmation = {
  motivo: "Correção fictícia C16",
  confirmacao_humana: true,
  simulacao: true,
};
const interval = {
  inicio: "2026-09-01T10:00:00Z",
  fim: "2026-09-01T18:00:00Z",
};
const correction = (s: Scenario) => ({
  ...confirmation,
  ...interval,
  pacote_episodio_id: s.association,
  classificacao_episodio_id: s.assignment,
});
const cancel = (id: string) =>
  create(`/diarias/periodos/${id}/cancelar`, confirmation);
async function event(s: Scenario) {
  const execution = await create("/clinica/execucoes", {
    ordem_versao_id: s.version,
    evento_referencia: randomUUID(),
    executada_em: clinicalTime,
    quantidade_aplicada: "1",
    unidade_medida_id: s.measure,
    resultado: "integral",
    situacao_material: "nao_utilizado",
    confirmacao_humana: true,
    motivo: "Fato fictício",
  });
  return create("/diarias/eventos", {
    execucao_id: execution,
    motivo: "Fictício",
  });
}
const reserve = (e: string, p: string) =>
  post("/diarias/reservas", {
    evento_id: e,
    periodo_diaria_id: p,
    expira_em: new Date(Date.now() + 3600000).toISOString(),
    motivo: "Reserva fictícia",
  });

test("correção cria sucessora e cadeia, preserva origem e saldo", async () => {
  const s = await scenario(),
    old = await row("periodo_diaria", s.period);
  const id = await create(`/diarias/periodos/${s.period}/corrigir`, {
    ...correction(s),
    fim: "2026-09-01T17:00:00Z",
  });
  assert.deepEqual(await row("periodo_diaria", s.period), old);
  const previous = await row("periodo_diaria_consulta", s.period);
  assert.equal(previous.situacao, "correcao");
  assert.equal(previous.substituta_id, id);
  assert.equal(previous.necessita_revisao, true);
  assert.equal(
    (await row("periodo_diaria_consulta", id)).necessita_revisao,
    false,
  );
  const next = await create(`/diarias/periodos/${id}/corrigir`, correction(s));
  await cancel(next);
  assert.equal(
    (await row("periodo_diaria_consulta", next)).situacao,
    "cancelamento",
  );
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    "20.000000",
  );
});
test("retry retorna a mesma revisão e decisões concorrentes têm um único vencedor", async () => {
  const s = await scenario(),
    key = randomUUID(),
    path = `/diarias/periodos/${s.period}/cancelar`;
  const results = await Promise.all([
    post(path, confirmation, key),
    post(path, confirmation, key),
  ]);
  for (const r of results) assert.equal(r.statusCode, 200, r.body);
  assert.equal(results[0].json().id, results[1].json().id);
  assert.equal((await post(path, confirmation)).statusCode, 409);
  assert.equal(
    (await post(path, { ...confirmation, motivo: "Mudou" }, key)).statusCode,
    409,
  );
  const other = await scenario();
  const competing = await Promise.all([
    post(`/diarias/periodos/${other.period}/cancelar`, confirmation),
    post(`/diarias/periodos/${other.period}/corrigir`, correction(other)),
  ]);
  assert.deepEqual(competing.map((r) => r.statusCode).sort(), [200, 409]);
});
test("associação exige tratar filhos; correção/cancelamento liberam intervalo sem apagar fatos", async () => {
  const s = await scenario(),
    old = await row("pacote_episodio", s.association);
  const path = `/diarias/pacotes-episodio/${s.association}/corrigir`;
  const body = {
    ...confirmation,
    pacote_versao_id: s.pkg,
    inicio: "2026-09-01T08:00:00Z",
    fim: "2026-09-03T08:00:00Z",
  };
  assert.equal((await post(path, body)).statusCode, 409);
  await cancel(s.period);
  const next = await create(path, body);
  assert.deepEqual(await row("pacote_episodio", s.association), old);
  assert.equal(
    (await row("pacote_episodio_consulta", s.association)).substituta_id,
    next,
  );
  assert.equal(
    (
      await post("/diarias/periodos", {
        ...interval,
        pacote_episodio_id: s.association,
        classificacao_episodio_id: s.assignment,
        motivo: "Inválido",
      })
    ).statusCode,
    409,
  );
  const period = await create("/diarias/periodos", {
    ...interval,
    pacote_episodio_id: next,
    classificacao_episodio_id: s.assignment,
    motivo: "Novo explícito",
  });
  await cancel(period);
  await create(`/diarias/pacotes-episodio/${next}/cancelar`, confirmation);
  assert.equal(
    (await row("pacote_episodio_consulta", next)).situacao,
    "cancelamento",
  );
});
test("sucessora inválida faz rollback da revisão, comando e efeitos", async () => {
  const s = await scenario();
  for (const extra of [
    { fim: "2026-09-04T00:00:00Z" },
    { classificacao_episodio_id: null },
    { inicio: interval.fim },
    { pacote_episodio_id: randomUUID() },
  ]) {
    const key = randomUUID();
    const r = await post(
      `/diarias/periodos/${s.period}/corrigir`,
      { ...correction(s), ...extra },
      key,
    );
    assert.ok([404, 409].includes(r.statusCode), r.body);
    assert.equal(
      (
        await admin.query(
          "SELECT count(*)::int n FROM hvb.comando WHERE organizacao_id=$1 AND chave=$2",
          [f.org, key],
        )
      ).rows[0].n,
      0,
    );
  }
  assert.equal(
    (await row("periodo_diaria_consulta", s.period)).situacao,
    "vigente",
  );
});
test("sobreposição continua barrada na API e diretamente no banco", async () => {
  const s = await scenario();
  const newPeriod = {
    ...interval,
    pacote_episodio_id: s.association,
    classificacao_episodio_id: s.assignment,
    motivo: "Duplicado",
  };
  assert.equal((await post("/diarias/periodos", newPeriod)).statusCode, 409);
  await assert.rejects(
    admin.query(
      `INSERT INTO hvb.periodo_diaria(id,organizacao_id,unidade_id,episodio_id,pacote_episodio_id,classificacao_episodio_id,inicio,fim,fuso,autor_id,motivo)
    SELECT $2,organizacao_id,unidade_id,episodio_id,pacote_episodio_id,classificacao_episodio_id,inicio,fim,fuso,autor_id,motivo FROM hvb.periodo_diaria WHERE id=$1`,
      [s.period, randomUUID()],
    ),
    { code: "23514" },
  );
  await cancel(s.period);
  const r = await Promise.all([
    post("/diarias/periodos", newPeriod),
    post("/diarias/periodos", newPeriod),
  ]);
  assert.deepEqual(r.map((x) => x.statusCode).sort(), [200, 409]);
});
test("reserva ativa exige liberação explícita; contexto antigo deixa de reservar", async () => {
  const s = await scenario(),
    e = await event(s),
    reservation = await reserve(e, s.period);
  assert.equal(reservation.statusCode, 200, reservation.body);
  assert.equal(
    (await post(`/diarias/periodos/${s.period}/cancelar`, confirmation))
      .statusCode,
    409,
  );
  assert.equal(
    (await row("reserva_cobertura", reservation.json().id)).situacao,
    "ativa",
  );
  await create(`/diarias/reservas/${reservation.json().id}/liberar`, {
    motivo: "Correção explícita",
  });
  await cancel(s.period);
  assert.equal((await reserve(e, s.period)).statusCode, 409);
});
test("cobertura requer reversão e reavaliação explícita na sucessora", async () => {
  const s = await scenario(),
    e = await event(s);
  const av = await create(`/diarias/eventos/${e}/avaliar`, {
    periodo_diaria_id: s.period,
    versao_esperada: 0,
    motivo: "Avaliação",
  });
  const original = await row("avaliacao_cobertura", av);
  assert.equal(
    (await post(`/diarias/periodos/${s.period}/corrigir`, correction(s)))
      .statusCode,
    409,
  );
  await create(`/diarias/avaliacoes/${av}/reverter`, {
    motivo: "Revisão explícita",
  });
  const successor = await create(
    `/diarias/periodos/${s.period}/corrigir`,
    correction(s),
  );
  const stale = await create(`/diarias/eventos/${e}/avaliar`, {
    periodo_diaria_id: s.period,
    versao_esperada: 1,
    motivo: "Origem antiga",
  });
  assert.equal((await row("avaliacao_cobertura", stale)).resultado, "pendente");
  const next = await create(`/diarias/eventos/${e}/avaliar`, {
    periodo_diaria_id: successor,
    versao_esperada: 2,
    motivo: "Reavaliação explícita",
  });
  assert.equal((await row("avaliacao_cobertura", next)).resultado, "incluido");
  assert.deepEqual(await row("avaliacao_cobertura", av), original);
});
test("cancelamento versus reserva serializa sem reserva ativa em período cancelado", async () => {
  const s = await scenario(),
    e = await event(s);
  const results = await Promise.all([
    post(`/diarias/periodos/${s.period}/cancelar`, confirmation),
    reserve(e, s.period),
  ]);
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
});
test("cancelamento de associação versus novo período tem um único vencedor", async () => {
  const s = await scenario();
  await cancel(s.period);
  const results = await Promise.all([
    post(`/diarias/pacotes-episodio/${s.association}/cancelar`, confirmation),
    post("/diarias/periodos", {
      ...interval,
      pacote_episodio_id: s.association,
      classificacao_episodio_id: s.assignment,
      motivo: "Concorrente",
    }),
  ]);
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
});
test("documento da diária exige reversão financeira sem alterar valor histórico", async () => {
  const d = await scenario(),
    s = await financialScenario(app, f.adminToken, f.unit, randomUUID(), d);
  const ev = await create("/financeiro/eventos", {
    ...s.common,
    item_comercial_id: s.catalog,
    periodo_diaria_id: d.period,
    quantidade: "1",
  });
  const av = await create("/financeiro/avaliacoes", {
    ...s.common,
    evento_id: ev,
    versao_esperada: 0,
    preco_id: s.price,
    decisao: "cobravel",
    desconto: "0.00",
  });
  const item = await create("/financeiro/itens", {
    ...s.common,
    conta_id: s.account,
    avaliacao_id: av,
    responsabilidades: [{ pagador_id: s.payer, valor: "100.00" }],
  });
  const old = await row("item_conta", item);
  assert.equal(
    (await post(`/diarias/periodos/${d.period}/cancelar`, confirmation))
      .statusCode,
    409,
  );
  await create("/financeiro/reversoes", { ...s.common, item_conta_id: item });
  await cancel(d.period);
  assert.deepEqual(await row("item_conta", item), old);
  assert.equal((await row("evento_cobravel_consulta", ev)).origem_ativa, false);
  assert.equal(
    (await row("avaliacao_cobranca_consulta", av)).necessita_revisao,
    true,
  );
  assert.equal(
    (
      await post("/financeiro/itens", {
        ...s.common,
        conta_id: s.account,
        avaliacao_id: av,
        responsabilidades: [{ pagador_id: s.payer, valor: "100.00" }],
      })
    ).statusCode,
    409,
  );
});
test("documento de valor zero por cobertura também exige reversão explícita", async () => {
  const d = await scenario(),
    s = await financialScenario(app, f.adminToken, f.unit, randomUUID(), d);
  const e = await create("/diarias/eventos", {
    execucao_id: s.execution,
    motivo: "Cobertura",
  });
  const cv = await create(`/diarias/eventos/${e}/avaliar`, {
    periodo_diaria_id: d.period,
    versao_esperada: 0,
    motivo: "Cobertura",
  });
  const av = await create("/financeiro/avaliacoes", {
    ...s.common,
    evento_id: s.event,
    versao_esperada: 1,
    preco_id: s.price,
    cobertura_id: cv,
    decisao: "cobertura",
    desconto: "0.00",
  });
  const item = await create("/financeiro/itens", {
    ...s.common,
    conta_id: s.account,
    avaliacao_id: av,
    responsabilidades: [],
  });
  await create(`/diarias/avaliacoes/${cv}/reverter`, { motivo: "Revisão" });
  assert.equal(
    (await post(`/diarias/periodos/${d.period}/cancelar`, confirmation))
      .statusCode,
    409,
  );
  await create("/financeiro/reversoes", { ...s.common, item_conta_id: item });
  await cancel(d.period);
  assert.equal((await row("item_conta", item)).valor, "0.00");
});
test("permissão, tenant, episódio e confirmações explícitas protegem correções", async () => {
  const s = await scenario(),
    other = await scenario(),
    path = `/diarias/periodos/${s.period}/corrigir`;
  assert.equal(
    (await post(path, correction(s), randomUUID(), f.nurseToken)).statusCode,
    403,
  );
  assert.equal(
    (await post(path, correction(s), randomUUID(), foreign.adminToken))
      .statusCode,
    404,
  );
  assert.equal(
    (
      await post(path, {
        ...correction(s),
        pacote_episodio_id: other.association,
      })
    ).statusCode,
    409,
  );
  for (const extra of [
    { simulacao: false },
    { confirmacao_humana: "true" },
    { classificacao_episodio_id: undefined },
    { inesperado: true },
  ])
    assert.equal(
      (await post(path, { ...correction(s), ...extra })).statusCode,
      400,
    );
  const id = await cancel(s.period);
  await transaction(db, foreign.org, async (tx) =>
    assert.equal(
      (
        await tx.query("SELECT id FROM revisao_periodo_diaria WHERE id=$1", [
          id,
        ])
      ).rowCount,
      0,
    ),
  );
});
test("histórico é imutável e listas exibem a revisão tipada", async () => {
  const s = await scenario(),
    id = await cancel(s.period);
  await assert.rejects(
    admin.query("DELETE FROM hvb.revisao_periodo_diaria WHERE id=$1", [id]),
    { code: "23514" },
  );
  await assert.rejects(
    admin.query("UPDATE hvb.periodo_diaria SET motivo='Outro' WHERE id=$1", [
      s.period,
    ]),
    { code: "23514" },
  );
  for (const path of [
    "periodos",
    "pacotes-episodio",
    "revisoes-periodos",
    "revisoes-pacotes-episodio",
  ]) {
    const r = await app.inject({
      url: `/v1/diarias/${path}?unidade_id=${f.unit}&episodio_id=${s.episode}`,
      headers: { authorization: `Bearer ${f.adminToken}` },
    });
    assert.equal(r.statusCode, 200, r.body);
    if (path === "periodos")
      assert.equal(r.json().items[0].situacao, "cancelamento");
    if (path === "revisoes-periodos") assert.equal(r.json().items[0].id, id);
  }
});

test("inserções SQL concorrentes também preservam exclusividade do intervalo", async () => {
  const s = await scenario();
  await cancel(s.period);
  const insert = () =>
    transaction(db, f.org, (tx) =>
      tx.query(
        `INSERT INTO periodo_diaria(id,organizacao_id,unidade_id,episodio_id,pacote_episodio_id,classificacao_episodio_id,inicio,fim,fuso,autor_id,motivo)
    SELECT $2,organizacao_id,unidade_id,episodio_id,pacote_episodio_id,classificacao_episodio_id,inicio,fim,fuso,autor_id,motivo FROM periodo_diaria WHERE id=$1`,
        [s.period, randomUUID()],
      ),
    );
  const results = await Promise.allSettled([insert(), insert()]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  for (const r of results)
    if (r.status === "rejected") assert.equal(r.reason.code, "23514");
});

test("cancelamento versus documentação financeira não deixa dívida nova sobre origem cancelada", async () => {
  const d = await scenario(),
    s = await financialScenario(app, f.adminToken, f.unit, randomUUID(), d);
  const ev = await create("/financeiro/eventos", {
    ...s.common,
    item_comercial_id: s.catalog,
    periodo_diaria_id: d.period,
    quantidade: "1",
  });
  const av = await create("/financeiro/avaliacoes", {
    ...s.common,
    evento_id: ev,
    versao_esperada: 0,
    preco_id: s.price,
    decisao: "cobravel",
    desconto: "0.00",
  });
  const results = await Promise.all([
    post(`/diarias/periodos/${d.period}/cancelar`, confirmation),
    post("/financeiro/itens", {
      ...s.common,
      conta_id: s.account,
      avaliacao_id: av,
      responsabilidades: [{ pagador_id: s.payer, valor: "100.00" }],
    }),
  ]);
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
});
