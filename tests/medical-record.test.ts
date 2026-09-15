import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { command } from "../src/domain/core.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { medicalScenario } from "../scripts/medical-scenario.ts";
import { medicalActions } from "../src/domain/medical-record/service.ts";
import { documentScenario } from "../scripts/document-scenario.ts";
import { scheduleScenario } from "../scripts/schedule-scenario.ts";
import { preventiveScenario } from "../scripts/preventive-scenario.ts";
import { examScenario } from "../scripts/exam-scenario.ts";
let app: FastifyInstance,
  db: pg.Pool,
  admin: pg.Pool,
  f: Awaited<ReturnType<typeof seedFixture>>,
  foreign: typeof f;
type Scenario = Awaited<ReturnType<typeof medicalScenario>>;
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
const read = (url: string, token = f.adminToken) =>
  app.inject({ url, headers: { authorization: `Bearer ${token}` } });
async function create(path: string, body: Record<string, unknown>) {
  const r = await post(path, body);
  assert.equal(r.statusCode, 200, r.body);
  return r.json().id as string;
}
const scenario = () => medicalScenario(app, f.adminToken, f.unit);
const version = (s: Scenario, extra: Record<string, unknown> = {}) => ({
  ...s.common,
  evolucao_id: s.evolution,
  versao_esperada: 1,
  estado: "registrada",
  ocorrida_em: s.body.ocorrida_em,
  conteudo: "Retificação fictícia com informação completa",
  ...extra,
});
const timeline = (patient: string, extra = "", token = f.adminToken) =>
  read(
    `/v1/prontuario/linha-do-tempo?unidade_id=${f.unit}&paciente_id=${patient}&inicio_registro=2026-01-01T00:00:00Z&fim_registro=2027-01-01T00:00:00Z&${extra}`,
    token,
  );
const content = (id: string, token = f.adminToken) =>
  read(`/v1/prontuario/versoes/${id}?unidade_id=${f.unit}`, token);
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
test("evolução guarda texto exato, autor, hash e instante sem alterar estoque", async () => {
  const s = await scenario(),
    r = await content(s.evolutionVersion);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().conteudo, s.body.conteudo);
  assert.equal(r.json().autor_id, f.admin);
  assert.equal(
    r.json().hash_conteudo,
    createHash("sha256").update(s.body.conteudo).digest("hex"),
  );
  assert.equal(r.json().atual, true);
  assert.equal(
    (
      await admin.query(
        "SELECT saldo_base FROM hvb.posicao_estoque WHERE id=$1",
        [s.position],
      )
    ).rows[0].saldo_base,
    "20.000000",
  );
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.execucao WHERE episodio_id=$1",
        [s.episode],
      )
    ).rows[0].n,
    0,
  );
});
test("retificação concorrente tem um sucessor e invalidação preserva conteúdo anterior", async () => {
  const s = await scenario(),
    rs = await Promise.all([
      post("/prontuario/versoes", version(s)),
      post("/prontuario/versoes", version(s)),
    ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  const second = rs.find((r) => r.statusCode === 200)?.json().id;
  assert.equal((await content(s.evolutionVersion)).json().atual, false);
  assert.equal(
    (await content(s.evolutionVersion)).json().conteudo,
    s.body.conteudo,
  );
  const third = await create(
    "/prontuario/versoes",
    version(s, {
      versao_esperada: 2,
      estado: "invalidada",
      conteudo: "Registro invalidado por informação fictícia incorreta",
    }),
  );
  assert.equal((await content(third)).json().estado, "invalidada");
  assert.equal((await content(second)).json().atual, false);
  const list = await timeline(s.patient, "fontes=evolucoes");
  assert.equal(list.statusCode, 200, list.body);
  assert.equal(list.json().items.length, 3);
});
test("criação e retry deduplicam referência sem duplicar versões", async () => {
  const s = await scenario(),
    body = { ...s.body, referencia: randomUUID() },
    key = randomUUID();
  const rs = await Promise.all([
    post("/prontuario/evolucoes", body, key),
    post("/prontuario/evolucoes", body, key),
  ]);
  for (const r of rs) assert.equal(r.statusCode, 200, r.body);
  assert.equal(rs[0]?.json().id, rs[1]?.json().id);
  assert.equal(
    rs[0]?.json().evolucao_versao_id,
    rs[1]?.json().evolucao_versao_id,
  );
  assert.equal((await post("/prontuario/evolucoes", body)).statusCode, 409);
});
test("paciente/episódio, tempo futuro e conteúdo inválido são recusados", async () => {
  const s = await scenario(),
    other = await scenario();
  for (const extra of [
    { paciente_id: other.patient },
    { unidade_id: f.otherUnit },
    { ocorrida_em: "2026-09-01T07:59:59Z" },
    { ocorrida_em: "2099-01-01T00:00:00Z" },
  ])
    assert.equal(
      (
        await post("/prontuario/evolucoes", {
          ...s.body,
          referencia: randomUUID(),
          ...extra,
        })
      ).statusCode,
      409,
    );
  for (const extra of [
    { conteudo: 123 },
    { conteudo: " " },
    { confirmacao_humana: "true" },
    { simulacao: false },
  ])
    assert.equal(
      (
        await post("/prontuario/evolucoes", {
          ...s.body,
          referencia: randomUUID(),
          ...extra,
        })
      ).statusCode,
      400,
    );
});
test("linha do tempo preserva planejamento e IDs de execução/consumo/estorno", async () => {
  const s = await scenario();
  const e = await create("/clinica/execucoes", {
    ordem_versao_id: s.version,
    programacao_id: s.schedule,
    evento_referencia: randomUUID(),
    executada_em: s.body.ocorrida_em,
    quantidade_aplicada: "1",
    unidade_medida_id: s.measure,
    resultado: "integral",
    situacao_material: "pendente",
    confirmacao_humana: true,
    motivo: "Execução fictícia",
  });
  const c = await create("/clinica/consumos", {
    episodio_id: s.episode,
    execucao_id: e,
    evento_referencia: randomUUID(),
    ocorrido_em: s.body.ocorrida_em,
    finalidade: "Teste fictício",
    motivo: "Teste",
    itens_confirmados: true,
    itens: [{ posicao_id: s.position, quantidade_base: "1" }],
  });
  const result = await timeline(s.patient);
  assert.equal(result.statusCode, 200, result.body);
  const items = result.json().items;
  assert.equal(
    items.filter((i: { tipo: string }) => i.tipo === "execucao").length,
    1,
  );
  assert.equal(
    items.find((i: { tipo: string }) => i.tipo === "execucao").id,
    e,
  );
  assert.equal(items.find((i: { tipo: string }) => i.tipo === "consumo").id, c);
  assert.equal(
    items.find((i: { tipo: string }) => i.tipo === "programacao").natureza,
    "planejamento",
  );
  const estorno = await create(`/clinica/consumos/${c}/reverter`, {
    ocorrido_em: "2026-09-01T13:00:00Z",
    motivo: "Estorno fictício",
  });
  const after = (await timeline(s.patient)).json().items;
  assert.equal(after.find((i: { id: string }) => i.id === c).atual, false);
  assert.equal(
    after.find((i: { tipo: string }) => i.tipo === "estorno_consumo").id,
    estorno,
  );
});
test("fontes selecionadas exigem suas permissões e metadados não liberam texto", async () => {
  const s = await scenario();
  await admin.query(
    "INSERT INTO hvb.papel_permissao(organizacao_id,papel_id,permissao) VALUES($1,$2,'prontuario:ler')",
    [f.org, f.readerRole],
  );
  const r = await timeline(s.patient, "fontes=evolucoes", f.readerToken);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().items[0].conteudo, undefined);
  assert.equal(
    (await content(s.evolutionVersion, f.readerToken)).statusCode,
    403,
  );
  assert.equal((await timeline(s.patient, "", f.readerToken)).statusCode, 403);
  for (const source of [
    "exames",
    "documentos",
    "agenda",
    "preventivos_externos",
  ])
    assert.equal(
      (await timeline(s.patient, `fontes=${source}`, f.readerToken)).statusCode,
      403,
    );
});
test("período, fontes e cursor compostos têm limites explícitos", async () => {
  const s = await scenario();
  for (const extra of [
    "fontes=desconhecida",
    "fontes=clinica,clinica",
    "apos_tipo=evolucao",
    "limit=101",
  ])
    assert.equal((await timeline(s.patient, extra)).statusCode, 400);
  assert.equal(
    (
      await read(
        `/v1/prontuario/linha-do-tempo?unidade_id=${f.unit}&paciente_id=${s.patient}`,
      )
    ).statusCode,
    400,
  );
  const r = await read(
    `/v1/prontuario/linha-do-tempo?unidade_id=${f.unit}&paciente_id=${s.patient}&inicio_registro=2025-01-01T00:00:00Z&fim_registro=2027-01-01T00:00:00Z`,
  );
  assert.equal(r.statusCode, 400);
});
test("paginação desempata instantes idênticos sem perder ou repetir fatos", async () => {
  const s = await scenario(),
    action = medicalActions[0];
  assert.ok(action);
  await transaction(admin, f.org, async (tx) => {
    for (let i = 0; i < 3; i++) {
      const body = { ...s.body, referencia: randomUUID() };
      await command(
        tx,
        {
          organizacao_id: f.org,
          usuario_id: f.admin,
          credencial_id: f.credential,
        },
        randomUUID(),
        "teste.evolucao",
        { body },
        undefined,
        randomUUID(),
        (cmd) =>
          action.run(
            tx,
            {
              organizacao_id: f.org,
              usuario_id: f.admin,
              credencial_id: f.credential,
            },
            body,
            "",
            cmd,
          ),
      );
    }
  });
  const all = await timeline(s.patient, "fontes=evolucoes&limit=100");
  assert.equal(all.statusCode, 200, all.body);
  const ids: string[] = [];
  let cursor = "";
  do {
    const r = await timeline(s.patient, `fontes=evolucoes&limit=1${cursor}`);
    assert.equal(r.statusCode, 200, r.body);
    ids.push(...r.json().items.map((i: { id: string }) => i.id));
    const c = r.json().next_cursor;
    cursor = c
      ? `&apos_registro=${encodeURIComponent(c.registrado_em)}&apos_tipo=${c.tipo}&apos_id=${c.id}`
      : "";
  } while (cursor);
  assert.deepEqual(
    ids,
    all.json().items.map((i: { id: string }) => i.id),
  );
  assert.equal(new Set(ids).size, 4);
  assert.match(all.json().items[0].registrado_em, /\.\d{6}Z$/);
});
test("fontes documentais e agenda mostram versões sem copiar conteúdo", async () => {
  const s = await documentScenario(app, f.adminToken, f.unit);
  const doc = await s.doc("versao", "versoes", {
    solicitacao_id: s.request,
    modelo_versao_id: s.modelVersion,
    versao_esperada: 0,
    campos: s.fields,
  });
  const r = await timeline(s.patient, "fontes=documentos");
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().items[0].id, doc);
  assert.equal(r.json().items[0].ocorrido_em, null);
  assert.equal(r.json().items[0].conteudo, undefined);
  const a = await scheduleScenario(app, f.adminToken, f.unit);
  const ar = await timeline(a.patient, "fontes=agenda");
  assert.equal(ar.statusCode, 200, ar.body);
  assert.equal(ar.json().items[0].id, a.appointmentVersion);
  assert.equal(ar.json().items[0].natureza, "planejamento");
  assert.equal(
    (await timeline(a.patient, `fontes=agenda&episodio_id=${a.episode}`)).json()
      .items.length,
    0,
  );
});
test("exames e aplicações externas preservam ID, estado e natureza", async () => {
  const s = await examScenario(app, f.adminToken, f.unit);
  const result = await s.exam("resultado", "resultados", {
    item_exame_id: s.examItem,
    versao_esperada: 0,
    produzido_em: "2026-09-01T15:00:00Z",
    referencia: randomUUID(),
    origem_idade: "desconhecida",
    observacao: "Resultado fictício, sem interpretação",
    valores: s.values,
  });
  const r = await timeline(s.patient, "fontes=exames,preventivos_externos");
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().items.length, 1);
  assert.equal(r.json().items[0].id, result);
  assert.equal(r.json().items[0].situacao, "nao_liberado");
  const p = await preventiveScenario(app, f.adminToken, f.unit);
  const application = await p.preventive("externa", "aplicacoes", {
    ocorrencia_id: p.occurrence,
    origem: "externa",
    profissional_informado: "Profissional externo fictício",
    ocorrida_em: "2026-09-01T12:00:00Z",
    referencia: randomUUID(),
    lote_declarado: "Lote declarado fictício",
    fabricante_declarado: "Fabricante declarado fictício",
    evidencia: "Declaração fictícia não validada externamente",
  });
  const pr = await timeline(p.patient, "fontes=preventivos_externos");
  assert.equal(pr.statusCode, 200, pr.body);
  assert.equal(pr.json().items[0].id, application);
  assert.equal(pr.json().items[0].natureza, "declaracao_externa");
  assert.equal(pr.json().items[0].episodio_id, null);
});
test("saída retroativa preserva relato e sinaliza revisão temporal até retificação", async () => {
  const s = await scenario();
  const closed = await post(`/episodios/${s.episode}/encerrar`, {
    ocorrido_em: "2026-09-01T11:00:00Z",
    motivo: "Saída fictícia retroativa",
    versao_esperada: 1,
  });
  assert.equal(closed.statusCode, 200, closed.body);
  assert.equal(
    (await content(s.evolutionVersion)).json().revisao_temporal,
    true,
  );
  assert.equal(
    (await timeline(s.patient, "fontes=evolucoes")).json().items[0].situacao,
    "revisao_temporal",
  );
  assert.equal(
    (
      await post("/prontuario/evolucoes", {
        ...s.body,
        referencia: randomUUID(),
      })
    ).statusCode,
    409,
  );
  const fixed = await create(
    "/prontuario/versoes",
    version(s, { ocorrida_em: "2026-09-01T10:00:00Z" }),
  );
  assert.equal((await content(fixed)).json().revisao_temporal, false);
  assert.equal(
    (await content(s.evolutionVersion)).json().conteudo,
    s.body.conteudo,
  );
});
test("unidade e RLS isolam relato, e SQL preserva o histórico", async () => {
  const s = await scenario();
  assert.equal(
    (await content(s.evolutionVersion, foreign.adminToken)).statusCode,
    404,
  );
  const r = await timeline(s.patient, "fontes=evolucoes", foreign.adminToken);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().items.length, 0);
  await transaction(db, foreign.org, async (tx) =>
    assert.equal(
      (
        await tx.query("SELECT id FROM evolucao_clinica WHERE id=$1", [
          s.evolution,
        ])
      ).rowCount,
      0,
    ),
  );
  await assert.rejects(
    admin.query(
      "UPDATE hvb.evolucao_clinica_versao SET conteudo='outro' WHERE id=$1",
      [s.evolutionVersion],
    ),
  );
  await assert.rejects(
    admin.query(
      "INSERT INTO hvb.evolucao_clinica_versao(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,evolucao_id,versao,anterior_id,estado,ocorrida_em,conteudo,hash_conteudo) SELECT gen_random_uuid(),organizacao_id,unidade_id,autor_id,comando_id,'teste',evolucao_id,2,id,estado,ocorrida_em,conteudo,hash_conteudo FROM hvb.evolucao_clinica_versao WHERE id=$1",
      [s.evolutionVersion],
    ),
    /Comando de exame ausente ou concluido/,
  );
});
