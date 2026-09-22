import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import {
  clinicalScenario,
  clinicalTime,
} from "../scripts/clinical-scenario.ts";
import { financialScenario } from "../scripts/financial-scenario.ts";
import { examScenario } from "../scripts/exam-scenario.ts";
import { preventiveScenario } from "../scripts/preventive-scenario.ts";
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
const scenario = () => clinicalScenario(app, f.adminToken, f.unit);
type Scenario = Awaited<ReturnType<typeof scenario>>;
const confirmation = () => ({
  motivo: "Correção documental fictícia C15",
  simulacao: true,
  confirmacao_humana: true,
});
const body = (s: Pick<Scenario, "version" | "schedule" | "measure">) => ({
  ordem_versao_id: s.version,
  programacao_id: s.schedule,
  evento_referencia: randomUUID(),
  executada_em: clinicalTime,
  quantidade_aplicada: "1",
  unidade_medida_id: s.measure,
  resultado: "integral",
  situacao_material: "pendente",
  confirmacao_humana: true,
  motivo: "Fato fictício original",
});
const replacement = (s: Scenario) => ({
  ...body(s),
  ...confirmation(),
  executor_id: f.nurse,
});
const execute = (s: Pick<Scenario, "version" | "schedule" | "measure">) =>
  create("/clinica/execucoes", body(s));
const annul = (id: string) =>
  create(`/clinica/execucoes/${id}/anular`, confirmation());
const consume = (s: Scenario, id: string) => ({
  episodio_id: s.episode,
  execucao_id: id,
  evento_referencia: randomUUID(),
  ocorrido_em: clinicalTime,
  finalidade: "Material fictício",
  motivo: "Conciliação fictícia",
  itens_confirmados: true,
  itens: [{ posicao_id: s.position, quantidade_base: "1" }],
});

test("anulação é novo fato sem sucessora, fecha pendência material e libera programação sem estoque", async () => {
  const s = await scenario(),
    e = await execute(s),
    original = await row("execucao", e),
    id = await annul(e);
  assert.deepEqual(await row("execucao", e), original);
  assert.equal((await row("revisao_execucao", id)).substituta_id, null);
  assert.equal(
    (await row("execucao_consulta", e)).conciliacao_material,
    "anulada",
  );
  assert.equal(
    (await row("programacao_consulta", s.schedule)).estado_execucao,
    "prevista",
  );
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    "20.000000",
  );
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.pendencia_clinica_consulta WHERE execucao_id=$1 AND situacao='aberta'",
        [e],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (await post("/clinica/consumos", consume(s, e))).statusCode,
    409,
  );
  await create(`/clinica/programacoes/${s.schedule}/nao-executar`, {
    motivo: "Anulada a documentação anterior; não executar",
  });
});
test("corrige executor, versão e programação no mesmo episódio sem reescrever a origem", async () => {
  const s = await scenario(),
    e = await execute(s);
  const r = await post("/clinica/ordens", {
    ...s.versionBody,
    prescricao_id: s.prescription,
  });
  assert.equal(r.statusCode, 200, r.body);
  const version = r.json().ordem_versao_id as string,
    schedule = await create("/clinica/programacoes", {
      ordem_versao_id: version,
      prevista_em: clinicalTime,
    });
  const id = await create(`/clinica/execucoes/${e}/corrigir-contexto`, {
    ...replacement(s),
    ordem_versao_id: version,
    programacao_id: schedule,
  });
  const fixed = await row("execucao", id);
  assert.equal(fixed.executor_id, f.nurse);
  assert.equal(fixed.correcao_de_id, e);
  assert.equal(fixed.ordem_versao_id, version);
  assert.equal((await row("execucao", e)).executor_id, f.admin);
  assert.equal(
    (await row("programacao_consulta", s.schedule)).estado_execucao,
    "prevista",
  );
  assert.equal(
    (await row("programacao_consulta", schedule)).estado_execucao,
    "concluida",
  );
  const review = (
    await admin.query(
      "SELECT * FROM hvb.revisao_execucao WHERE execucao_id=$1",
      [e],
    )
  ).rows[0];
  assert.equal(review.autor_id, f.admin);
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    "20.000000",
  );
});
test("remoção explícita de programação e cadeia de retificação permanecem rastreáveis", async () => {
  const s = await scenario(),
    e = await execute(s);
  const fixed = await create(`/clinica/execucoes/${e}/corrigir-contexto`, {
    ...replacement(s),
    programacao_id: null,
  });
  assert.equal((await row("execucao", fixed)).programacao_id, null);
  const { ordem_versao_id: _v, programacao_id: _p, ...legacy } = body(s);
  const next = await create(`/clinica/execucoes/${fixed}/retificar`, legacy);
  assert.equal((await row("execucao", next)).correcao_de_id, fixed);
  assert.equal(
    (await post(`/clinica/execucoes/${e}/anular`, confirmation())).statusCode,
    409,
  );
  await annul(next);
  assert.equal(
    (
      await post(`/clinica/execucoes/${next}/retificar`, {
        ...legacy,
        evento_referencia: randomUUID(),
      })
    ).statusCode,
    409,
  );
});
test("consumo ativo bloqueia ambas correções; estorno explícito restaura saldo antes de anular", async () => {
  const s = await scenario(),
    e = await execute(s),
    c = await create("/clinica/consumos", consume(s, e));
  for (const [suffix, payload] of [
    ["anular", confirmation()],
    ["corrigir-contexto", replacement(s)],
  ] as const)
    assert.equal(
      (await post(`/clinica/execucoes/${e}/${suffix}`, payload)).statusCode,
      409,
    );
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    "19.000000",
  );
  await create(`/clinica/consumos/${c}/reverter`, {
    motivo: "Estorno físico explícito",
    ocorrido_em: clinicalTime,
  });
  await annul(e);
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    "20.000000",
  );
});
test("retry concorrente mantém revisão única, payload distinto conflita e decisões concorrentes se excluem", async () => {
  const s = await scenario(),
    e = await execute(s),
    key = randomUUID(),
    b = confirmation(),
    path = `/clinica/execucoes/${e}/anular`;
  const rs = await Promise.all([post(path, b, key), post(path, b, key)]);
  for (const r of rs) assert.equal(r.statusCode, 200, r.body);
  assert.equal(rs[0]?.json().id, rs[1]?.json().id);
  assert.equal(
    (await post(path, { ...b, motivo: "Outro motivo" }, key)).statusCode,
    409,
  );
  const t = await scenario(),
    other = await execute(t);
  const race = await Promise.all([
    post(`/clinica/execucoes/${other}/anular`, b),
    post(`/clinica/execucoes/${other}/corrigir-contexto`, replacement(t)),
  ]);
  assert.deepEqual(race.map((r) => r.statusCode).sort(), [200, 409]);
});
test("permissões, RLS, outro episódio e executor inativo são bloqueados", async () => {
  const s = await scenario(),
    e = await execute(s),
    t = await scenario();
  assert.equal(
    (
      await post(
        `/clinica/execucoes/${e}/anular`,
        confirmation(),
        randomUUID(),
        f.nurseToken,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await post(
        `/clinica/execucoes/${e}/anular`,
        confirmation(),
        randomUUID(),
        foreign.adminToken,
      )
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await post(`/clinica/execucoes/${e}/corrigir-contexto`, {
        ...replacement(s),
        ordem_versao_id: t.version,
        programacao_id: t.schedule,
      })
    ).statusCode,
    409,
  );
  const user = await create("/usuarios", {
    nome: "Executor fictício inativo",
    login: `inativo.${randomUUID()}`,
  });
  await admin.query("UPDATE hvb.usuario SET ativo=false WHERE id=$1", [user]);
  assert.equal(
    (
      await post(`/clinica/execucoes/${e}/corrigir-contexto`, {
        ...replacement(s),
        executor_id: user,
      })
    ).statusCode,
    409,
  );
  const rev = await annul(e);
  await transaction(db, foreign.org, async (tx) =>
    assert.equal(
      (await tx.query("SELECT id FROM revisao_execucao WHERE id=$1", [rev]))
        .rowCount,
      0,
    ),
  );
});
test("contexto inválido reverte revisão, sucessora, auditoria e outbox atomicamente", async () => {
  const s = await scenario(),
    e = await execute(s);
  for (const extra of [
    { executada_em: "2099-01-01T00:00:00Z" },
    { programacao_id: randomUUID() },
    { unidade_medida_id: randomUUID() },
  ]) {
    const key = randomUUID(),
      r = await post(
        `/clinica/execucoes/${e}/corrigir-contexto`,
        { ...replacement(s), ...extra },
        key,
      );
    assert.ok([400, 409].includes(r.statusCode), r.body);
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
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.revisao_execucao WHERE execucao_id=$1",
        [e],
      )
    ).rows[0].n,
    0,
  );
  assert.equal((await row("execucao_consulta", e)).substituida_por_id, null);
  for (const value of [false, "true", 1])
    assert.equal(
      (
        await post(`/clinica/execucoes/${e}/anular`, {
          ...confirmation(),
          confirmacao_humana: value,
        })
      ).statusCode,
      400,
    );
});

test("anulação disputa com consumo sem deixar baixa ativa ligada a ato anulado", async () => {
  const s = await scenario(),
    e = await execute(s);
  const rs = await Promise.all([
    post(`/clinica/execucoes/${e}/anular`, confirmation()),
    post("/clinica/consumos", consume(s, e)),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  const annulled = (await row("execucao_consulta", e)).anulacao_id !== null;
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    annulled ? "20.000000" : "19.000000",
  );
});

test("correção não invade programação já concluída e anulação documental pode ocorrer após encerramento", async () => {
  const s = await scenario(),
    e = await execute(s);
  const schedule = await create("/clinica/programacoes", {
    ordem_versao_id: s.version,
    prevista_em: "2026-09-01T13:00:00Z",
  });
  await create("/clinica/execucoes", { ...body(s), programacao_id: schedule });
  assert.equal(
    (
      await post(`/clinica/execucoes/${e}/corrigir-contexto`, {
        ...replacement(s),
        programacao_id: schedule,
      })
    ).statusCode,
    409,
  );
  await create(`/episodios/${s.episode}/encerrar`, {
    ocorrido_em: "2026-09-01T18:00:00Z",
    versao_esperada: 1,
    motivo: "Saída fictícia",
  });
  await annul(e);
  assert.equal(
    (await row("execucao_consulta", e)).conciliacao_material,
    "anulada",
  );
});
test("cobrança anterior fica em revisão sem apagar item ou mudar valor; cobertura perde origem ativa", async () => {
  const s = await financialScenario(app, f.adminToken, f.unit),
    e = s.execution;
  const item = await create("/financeiro/itens", {
    ...s.common,
    conta_id: s.account,
    avaliacao_id: s.evaluation,
    responsabilidades: [{ pagador_id: s.payer, valor: "100.00" }],
  });
  const original = await row("item_conta", item);
  const coverage = await create("/diarias/eventos", {
    execucao_id: e,
    motivo: "Evento fictício de cobertura",
  });
  await annul(e);
  assert.deepEqual(await row("item_conta", item), original);
  assert.equal(
    (await row("avaliacao_cobranca_consulta", s.evaluation)).necessita_revisao,
    true,
  );
  assert.equal(
    (await row("item_conta_consulta", item)).necessita_revisao,
    true,
  );
  assert.equal(
    (await row("evento_cobertura_consulta", coverage)).origem_ativa,
    false,
  );
});
test("anulação invalida origem de coleta e aplicação preventiva, preservando os fatos", async () => {
  const s = await examScenario(app, f.adminToken, f.unit, randomUUID(), true),
    e = await execute(s);
  const sample = {
    ...s.common,
    item_exame_id: s.examItem,
    referencia: randomUUID(),
    coletada_em: clinicalTime,
    material: "material-ficticio",
    origem: "interna",
    execucao_id: e,
    evidencia: "Registro sintético",
  };
  const collection = await create("/exames/coletas", sample);
  await annul(e);
  assert.equal(
    (await row("coleta_exame_consulta", collection)).origem_ativa,
    false,
  );
  assert.equal(
    (await post("/exames/coletas", { ...sample, referencia: randomUUID() }))
      .statusCode,
    409,
  );
  const p = await preventiveScenario(app, f.adminToken, f.unit),
    ex = await create(
      "/clinica/execucoes",
      body({ ...p, version: p.clinicalVersion }),
    );
  const payload = {
    ...p.common,
    ocorrencia_id: p.occurrence,
    origem: "interna",
    execucao_id: ex,
    ocorrida_em: clinicalTime,
    referencia: randomUUID(),
    lote_declarado: "Não informado",
    fabricante_declarado: "Não informado",
    evidencia: "Sintética",
  };
  const application = await create("/protocolos/aplicacoes", payload);
  await annul(ex);
  assert.equal(
    (await row("aplicacao_preventiva_consulta", application)).ativa,
    false,
  );
  assert.equal(
    (await row("ocorrencia_preventiva_consulta", p.occurrence)).situacao,
    "revisao",
  );
  assert.equal(
    (
      await post("/protocolos/aplicacoes", {
        ...payload,
        referencia: randomUUID(),
      })
    ).statusCode,
    409,
  );
});
test("prontuário expõe anulação e autoria da correção, histórico não pode ser apagado", async () => {
  const s = await scenario(),
    e = await execute(s),
    rev = await annul(e);
  await assert.rejects(
    admin.query("DELETE FROM hvb.revisao_execucao WHERE id=$1", [rev]),
  );
  const r = await app.inject({
    url: `/v1/prontuario/linha-do-tempo?unidade_id=${f.unit}&paciente_id=${s.patient}&inicio_registro=2026-09-01T00:00:00Z&fim_registro=2026-10-01T00:00:00Z&fontes=clinica&limit=100`,
    headers: { authorization: `Bearer ${f.adminToken}` },
  });
  assert.equal(r.statusCode, 200, r.body);
  const items = r.json().items;
  assert.equal(items.find((x: { id: string }) => x.id === e)?.atual, false);
  assert.equal(
    items.find((x: { id: string }) => x.id === e)?.situacao,
    "anulada",
  );
  assert.equal(
    items.find((x: { id: string }) => x.id === rev)?.autor_id,
    f.admin,
  );
  const query = await app.inject({
    url: `/v1/clinica/revisoes-execucao?unidade_id=${f.unit}&execucao_id=${e}`,
    headers: { authorization: `Bearer ${f.adminToken}` },
  });
  assert.equal(query.statusCode, 200, query.body);
  assert.equal(query.json().items[0].id, rev);
});
