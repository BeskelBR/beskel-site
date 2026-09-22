import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { bankCorrectionsScenario } from "../scripts/bank-corrections-scenario.ts";
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
const scenario = () => bankCorrectionsScenario(app, f.adminToken, f.unit);
const raw = (work: (tx: pg.PoolClient, cmd: string) => Promise<unknown>) =>
  transaction(db, f.org, async (tx) => {
    const cmd = randomUUID();
    await tx.query(
      "INSERT INTO comando(id,organizacao_id,autor_id,chave,operacao,hash_payload) VALUES($1::uuid,$2,$3,$1::uuid::text,'teste-c17',repeat('0',64))",
      [cmd, f.org, f.admin],
    );
    const result = await work(tx, cmd);
    await tx.query(
      "UPDATE comando SET resultado='{}',concluido_em=now() WHERE id=$1",
      [cmd],
    );
    return result;
  });
type Scenario = Awaited<ReturnType<typeof scenario>>;
const common = () => ({
  unidade_id: f.unit,
  motivo: "Correção fictícia C17",
  simulacao: true,
  confirmacao_humana: true,
});
const fin = (path: string, body: Record<string, unknown>) =>
  create(`/financeiro/${path}`, { ...common(), ...body });
const attempt = (
  path: string,
  body: Record<string, unknown> = {},
  key = randomUUID(),
  token = f.adminToken,
) => post(`/financeiro/${path}`, { ...common(), ...body }, key, token);
const reconciliation = (s: Scenario) => ({
  deposito_id: s.deposit,
  extrato_id: s.statement,
  valor: "97.00",
  evidencia: "Conferência fictícia",
});
const allocation = (s: Scenario) => ({
  deposito_id: s.deposit,
  parcela_id: s.parcel,
  valor: "97.00",
});

test("corrige depósito e extrato com mesma referência preservando valor original e saldo disponível único", async () => {
  const s = await scenario(),
    oldDeposit = await row("deposito_adquirente", s.deposit),
    oldStatement = await row("item_extrato", s.statement);
  const d = await fin(`depositos/${s.deposit}/corrigir`, {
    ...s.depositBody,
    valor: "90.00",
    depositado_em: "2026-09-04T12:00:00Z",
    evidencia: "Corrigida",
  });
  const e = await fin(`extrato/${s.statement}/corrigir`, {
    ...s.statementBody,
    valor: "90.00",
  });
  assert.deepEqual(await row("deposito_adquirente", s.deposit), oldDeposit);
  assert.deepEqual(await row("item_extrato", s.statement), oldStatement);
  assert.equal((await row("deposito_consulta", s.deposit)).nao_alocado, "0.00");
  assert.equal(
    (await row("extrato_consulta", s.statement)).nao_conciliado,
    "0.00",
  );
  assert.equal((await row("deposito_consulta", d)).nao_alocado, "90.00");
  await fin("conciliacoes", {
    deposito_id: d,
    extrato_id: e,
    valor: "90.00",
    evidencia: "Nova decisão",
  });
  assert.equal((await row("recebimento", s.payment)).valor, "100.00");
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    "20.000000",
  );
});
test("cancelamento não cria sucessora nem libera referência para duplicação", async () => {
  const s = await scenario(),
    id = await fin(`depositos/${s.deposit}/cancelar`, {});
  assert.equal(
    (await row("revisao_deposito_adquirente", id)).substituta_id,
    null,
  );
  assert.equal(
    (await row("deposito_consulta", s.deposit)).situacao,
    "cancelamento",
  );
  assert.equal((await attempt("depositos", s.depositBody)).statusCode, 409);
  await fin(`extrato/${s.statement}/cancelar`, {});
  assert.equal((await attempt("extrato", s.statementBody)).statusCode, 409);
  assert.equal(
    (await attempt("conciliacoes", reconciliation(s))).statusCode,
    409,
  );
  assert.equal(
    (await attempt("alocacoes-deposito", allocation(s))).statusCode,
    409,
  );
});
test("refazer conciliação exige última revisão revertida, mantém cadeia e limites", async () => {
  const s = await scenario(),
    id = await fin("conciliacoes", reconciliation(s));
  const body = { valor: "50.00", evidencia: "Reconferência" };
  assert.equal(
    (await attempt(`conciliacoes/${id}/refazer`, body)).statusCode,
    409,
  );
  await fin("reversoes", { conciliacao_id: id });
  assert.equal(
    (await attempt("conciliacoes", reconciliation(s))).statusCode,
    409,
  );
  assert.equal(
    (await attempt(`conciliacoes/${id}/refazer`, { ...body, valor: "98.00" }))
      .statusCode,
    409,
  );
  const next = await fin(`conciliacoes/${id}/refazer`, body);
  assert.equal((await row("vinculo_conciliacao_consulta", id)).revertido, true);
  assert.equal((await row("vinculo_conciliacao", next)).anterior_id, id);
  assert.equal(
    (await row("deposito_consulta", s.deposit)).nao_conciliado,
    "47.00",
  );
  assert.equal(
    (await attempt(`conciliacoes/${id}/refazer`, body)).statusCode,
    409,
  );
  await fin("reversoes", { conciliacao_id: next });
  const last = await fin(`conciliacoes/${next}/refazer`, {
    ...body,
    valor: "97.00",
  });
  assert.equal((await row("vinculo_conciliacao", last)).anterior_id, next);
  assert.equal(
    (await row("extrato_consulta", s.statement)).nao_conciliado,
    "0.00",
  );
});
test("alocação revertida pode ser refeita sem duplicar recebimento ou parcela", async () => {
  const s = await scenario(),
    id = await fin("alocacoes-deposito", allocation(s));
  assert.equal(
    (await attempt(`alocacoes-deposito/${id}/refazer`, { valor: "40.00" }))
      .statusCode,
    409,
  );
  await fin("reversoes", { alocacao_deposito_id: id });
  assert.equal(
    (await attempt("alocacoes-deposito", allocation(s))).statusCode,
    409,
  );
  const next = await fin(`alocacoes-deposito/${id}/refazer`, {
    valor: "40.00",
  });
  assert.equal((await row("alocacao_deposito", next)).anterior_id, id);
  assert.equal(
    (await row("parcela_adquirente_consulta", s.parcel)).saldo,
    "57.00",
  );
  assert.equal(
    (await row("recebimento_consulta", s.payment)).disponivel,
    "100.00",
  );
  assert.equal(
    (await row("deposito_consulta", s.deposit)).nao_alocado,
    "57.00",
  );
});
test("depósito exige reversão de todas as alocações e conciliações antes de correção", async () => {
  const s = await scenario(),
    a = await fin("alocacoes-deposito", allocation(s)),
    c = await fin("conciliacoes", reconciliation(s));
  const path = `depositos/${s.deposit}/corrigir`;
  assert.equal((await attempt(path, s.depositBody)).statusCode, 409);
  await fin("reversoes", { conciliacao_id: c });
  assert.equal((await attempt(path, s.depositBody)).statusCode, 409);
  await fin("reversoes", { alocacao_deposito_id: a });
  const d = await fin(path, s.depositBody);
  assert.equal(
    (
      await attempt(`conciliacoes/${c}/refazer`, {
        valor: "97.00",
        evidencia: "Origem antiga",
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (await attempt(`alocacoes-deposito/${a}/refazer`, { valor: "97.00" }))
      .statusCode,
    409,
  );
  await fin("alocacoes-deposito", { ...allocation(s), deposito_id: d });
  assert.equal(
    (await row("parcela_adquirente_consulta", s.parcel)).saldo,
    "0.00",
  );
});
test("extrato exige reversão própria e não altera a alocação do depósito", async () => {
  const s = await scenario(),
    a = await fin("alocacoes-deposito", allocation(s)),
    c = await fin("conciliacoes", reconciliation(s));
  assert.equal(
    (await attempt(`extrato/${s.statement}/cancelar`)).statusCode,
    409,
  );
  await fin("reversoes", { conciliacao_id: c });
  await fin(`extrato/${s.statement}/cancelar`, {});
  assert.equal((await row("alocacao_deposito_consulta", a)).revertido, false);
  assert.equal(
    (
      await attempt(`conciliacoes/${c}/refazer`, {
        valor: "1.00",
        evidencia: "Antigo",
      })
    ).statusCode,
    409,
  );
});
test("conta/adquirente/referência corrigíveis na mesma unidade sem roubar outra linhagem", async () => {
  const s = await scenario(),
    bank = await fin("contas-financeiras", {
      descricao: "Outra conta fictícia",
    });
  const first = await fin(`depositos/${s.deposit}/corrigir`, {
    ...s.depositBody,
    conta_financeira_id: bank,
    adquirente: "Outra fictícia",
    referencia: "Corrigida",
  });
  const second = await fin(`depositos/${first}/corrigir`, s.depositBody);
  assert.equal((await row("deposito_consulta", first)).substituta_id, second);
  const collision = await fin("depositos", {
    ...s.depositBody,
    referencia: "Ocupada",
  });
  await fin(`depositos/${collision}/cancelar`, {});
  assert.equal(
    (
      await attempt(`depositos/${second}/corrigir`, {
        ...s.depositBody,
        referencia: "Ocupada",
      })
    ).statusCode,
    409,
  );
  assert.equal((await row("deposito_consulta", second)).situacao, "vigente");
  const statement = await fin(`extrato/${s.statement}/corrigir`, {
    ...s.statementBody,
    conta_financeira_id: bank,
    referencia: "Corrigida",
  });
  await fin(`extrato/${statement}/corrigir`, s.statementBody);
  assert.equal((await attempt("extrato", s.statementBody)).statusCode, 409);
});
test("retry concorrente e comando distinto não duplicam revisão", async () => {
  const s = await scenario(),
    key = randomUUID(),
    path = `depositos/${s.deposit}/corrigir`;
  const r = await Promise.all([
    attempt(path, s.depositBody, key),
    attempt(path, s.depositBody, key),
  ]);
  for (const x of r) assert.equal(x.statusCode, 200, x.body);
  assert.equal(r[0].json().id, r[1].json().id);
  assert.equal((await attempt(path, s.depositBody)).statusCode, 409);
  assert.equal(
    (await attempt(path, { ...s.depositBody, valor: "96.00" }, key)).statusCode,
    409,
  );
});
test("refazer concorrente admite um sucessor e retry recupera resultado sem relançar", async () => {
  const s = await scenario(),
    c = await fin("conciliacoes", reconciliation(s));
  await fin("reversoes", { conciliacao_id: c });
  const body = { valor: "50.00", evidencia: "Reabertura" },
    key = randomUUID(),
    path = `conciliacoes/${c}/refazer`;
  const results = await Promise.all([
    attempt(path, body, key),
    attempt(path, body),
  ]);
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
  if (results[0].statusCode === 200)
    assert.equal(
      (await attempt(path, body, key)).json().id,
      results[0].json().id,
    );
  assert.equal(
    (await row("deposito_consulta", s.deposit)).nao_conciliado,
    "47.00",
  );
});
test("correção versus conciliação serializa sem vínculo ativo para origem obsoleta", async () => {
  const s = await scenario();
  const results = await Promise.all([
    attempt(`depositos/${s.deposit}/corrigir`, s.depositBody),
    attempt("conciliacoes", reconciliation(s)),
  ]);
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
});
test("referências duplicadas concorrentes e valores imprecisos permanecem bloqueados", async () => {
  const s = await scenario(),
    body = { ...s.statementBody, referencia: "Nova concorrente" };
  const results = await Promise.all([
    attempt("extrato", body),
    attempt("extrato", body),
  ]);
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
  for (const value of [1, "0.001", "-1.00"])
    assert.equal(
      (
        await attempt(`extrato/${s.statement}/corrigir`, {
          ...s.statementBody,
          valor: value,
        })
      ).statusCode,
      400,
    );
});
test("erro na sucessora desfaz revisão e comando; data e unidade permanecem protegidas", async () => {
  const s = await scenario(),
    path = `depositos/${s.deposit}/corrigir`;
  const otherBank = await create("/financeiro/contas-financeiras", {
    ...common(),
    unidade_id: f.otherUnit,
    descricao: "Outra unidade",
  });
  for (const extra of [
    { depositado_em: "2099-01-01T00:00:00Z" },
    { valor: "0.00" },
    { conta_financeira_id: otherBank },
    { unidade_id: f.otherUnit },
  ]) {
    const key = randomUUID(),
      r = await attempt(path, { ...s.depositBody, ...extra }, key);
    assert.equal(r.statusCode, 409, r.body);
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
  assert.equal((await row("deposito_consulta", s.deposit)).situacao, "vigente");
});
test("RLS, permissões e confirmação literal protegem correções e consultas", async () => {
  const s = await scenario(),
    path = `extrato/${s.statement}/corrigir`;
  assert.equal(
    (await attempt(path, s.statementBody, randomUUID(), f.nurseToken))
      .statusCode,
    403,
  );
  assert.equal(
    (await attempt(path, s.statementBody, randomUUID(), foreign.adminToken))
      .statusCode,
    404,
  );
  for (const extra of [
    { simulacao: false },
    { confirmacao_humana: "true" },
    { inesperado: true },
  ])
    assert.equal(
      (await attempt(path, { ...s.statementBody, ...extra })).statusCode,
      400,
    );
  const rev = await fin(`extrato/${s.statement}/cancelar`, {});
  await transaction(db, foreign.org, async (tx) =>
    assert.equal(
      (await tx.query("SELECT id FROM revisao_item_extrato WHERE id=$1", [rev]))
        .rowCount,
      0,
    ),
  );
});
test("consultas expõem estado/cadeia; SQL não pode alterar história ou reutilizar comando fechado", async () => {
  const s = await scenario(),
    c = await fin("conciliacoes", reconciliation(s));
  await fin("reversoes", { conciliacao_id: c });
  const rev = await fin(`depositos/${s.deposit}/cancelar`, {});
  await assert.rejects(
    admin.query("DELETE FROM hvb.revisao_deposito_adquirente WHERE id=$1", [
      rev,
    ]),
    { code: "23514" },
  );
  await assert.rejects(
    admin.query("UPDATE hvb.deposito_adquirente SET valor=1 WHERE id=$1", [
      s.deposit,
    ]),
    { code: "23514" },
  );
  await assert.rejects(
    admin.query(
      "INSERT INTO hvb.revisao_item_extrato(id,organizacao_id,unidade_id,extrato_id,tipo,autor_id,comando_id,motivo) SELECT gen_random_uuid(),organizacao_id,unidade_id,id,'cancelamento',autor_id,comando_id,motivo FROM hvb.item_extrato WHERE id=$1",
      [s.statement],
    ),
    { code: "23514" },
  );
  for (const path of [
    "depositos",
    "extrato",
    "revisoes-depositos",
    "revisoes-extrato",
    "conciliacoes",
    "alocacoes-deposito",
  ]) {
    const r = await app.inject({
      url: `/v1/financeiro/${path}?unidade_id=${f.unit}&limit=2`,
      headers: { authorization: `Bearer ${f.adminToken}` },
    });
    assert.equal(r.statusCode, 200, r.body);
  }
  const r = await app.inject({
    url: `/v1/financeiro/conciliacoes?unidade_id=${f.unit}&extrato_id=${s.statement}`,
    headers: { authorization: `Bearer ${f.adminToken}` },
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().items[0].revertido, true);
  assert.equal(r.json().items[0].anterior_id, null);
});

test("SQL concorrente protege referência sem depender da trava prévia do serviço", async () => {
  const s = await scenario();
  const insert = () =>
    raw((tx, cmd) =>
      tx.query(
        `INSERT INTO item_extrato(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,conta_financeira_id,referencia,ocorrido_em,valor,evidencia)
    SELECT $2,organizacao_id,unidade_id,autor_id,$3,motivo,conta_financeira_id,'sql-concorrente',ocorrido_em,valor,evidencia FROM item_extrato WHERE id=$1`,
        [s.statement, randomUUID(), cmd],
      ),
    );
  const results = await Promise.allSettled([insert(), insert()]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  for (const r of results)
    if (r.status === "rejected") assert.equal(r.reason.code, "23514");
});

test("banco recusa reabertura de outro par e revisão sem sucessora efetiva", async () => {
  const s = await scenario(),
    c = await fin("conciliacoes", reconciliation(s));
  await fin("reversoes", { conciliacao_id: c });
  const other = await fin("extrato", {
    ...s.statementBody,
    referencia: "Outro par",
  });
  await assert.rejects(
    raw((tx, cmd) =>
      tx.query(
        `INSERT INTO vinculo_conciliacao(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,deposito_id,extrato_id,valor,evidencia,anterior_id)
    SELECT $2,organizacao_id,unidade_id,autor_id,$3,motivo,deposito_id,$4,1,evidencia,id FROM vinculo_conciliacao WHERE id=$1`,
        [c, randomUUID(), cmd, other],
      ),
    ),
    { code: "23514" },
  );
  await assert.rejects(
    raw((tx, cmd) =>
      tx.query(
        `INSERT INTO revisao_deposito_adquirente(id,organizacao_id,unidade_id,deposito_id,substituta_id,tipo,autor_id,comando_id,motivo)
    VALUES($1,$2,$3,$4,$5,'correcao',$6,$7,'Sucessora ausente')`,
        [randomUUID(), f.org, f.unit, s.deposit, randomUUID(), f.admin, cmd],
      ),
    ),
    { code: "23503" },
  );
  assert.equal((await row("deposito_consulta", s.deposit)).situacao, "vigente");
});

test("corrigir exige conciliar além de reverter; cancelamento usa somente a alçada de reversão", async () => {
  const s = await scenario();
  await admin.query(
    "INSERT INTO hvb.papel_permissao(organizacao_id,papel_id,permissao) VALUES($1,$2,'financeiro:reverter')",
    [f.org, f.readerRole],
  );
  assert.equal(
    (
      await attempt(
        `depositos/${s.deposit}/corrigir`,
        s.depositBody,
        randomUUID(),
        f.readerToken,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await attempt(
        `depositos/${s.deposit}/cancelar`,
        {},
        randomUUID(),
        f.readerToken,
      )
    ).statusCode,
    200,
  );
});
