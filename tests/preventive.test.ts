import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { preventiveScenario } from "../scripts/preventive-scenario.ts";
import { clinicalTime } from "../scripts/clinical-scenario.ts";
import { preventiveLists } from "../src/domain/preventive/service.ts";
let app: FastifyInstance,
  db: pg.Pool,
  admin: pg.Pool,
  f: Awaited<ReturnType<typeof seedFixture>>,
  foreign: typeof f;
type Scenario = Awaited<ReturnType<typeof preventiveScenario>>;
const common = () => ({
  unidade_id: f.unit,
  simulacao: true,
  confirmacao_humana: true,
  motivo: "Teste fictício M6B",
});
const post = (
  path: string,
  body: Record<string, unknown>,
  key = randomUUID(),
  token = f.adminToken,
) =>
  app.inject({
    method: "POST",
    url: `/v1/protocolos/${path}`,
    headers: { authorization: `Bearer ${token}`, "idempotency-key": key },
    payload: { ...common(), ...body },
  });
async function create(path: string, body: Record<string, unknown>) {
  const r = await post(path, body);
  assert.equal(r.statusCode, 200, r.body);
  return r.json().id as string;
}
const scenario = () => preventiveScenario(app, f.adminToken, f.unit);
async function rows(table: string, field: string, id: string) {
  return (
    await admin.query(`SELECT * FROM hvb.${table} WHERE ${field}=$1`, [id])
  ).rows;
}
async function get(path: string, query: string) {
  const r = await app.inject({
    url: `/v1/protocolos/${path}?unidade_id=${f.unit}&${query}`,
    headers: { authorization: `Bearer ${f.adminToken}` },
  });
  assert.equal(r.statusCode, 200, r.body);
  return r.json().items as Record<string, unknown>[];
}
const application = (
  s: Scenario,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  ocorrencia_id: s.occurrence,
  origem: "externa",
  profissional_informado: "Profissional externo fictício",
  ocorrida_em: clinicalTime,
  referencia: randomUUID(),
  lote_declarado: "Lote declarado fictício",
  fabricante_declarado: "Fabricante declarado fictício",
  evidencia: "Declaração fictícia não validada externamente",
  ...extra,
});
async function clinical(path: string, body: Record<string, unknown>) {
  const r = await app.inject({
    method: "POST",
    url: `/v1/clinica/${path}`,
    headers: {
      authorization: `Bearer ${f.adminToken}`,
      "idempotency-key": randomUUID(),
    },
    payload: body,
  });
  assert.equal(r.statusCode, 200, r.body);
  return r.json().id as string;
}
async function execution(s: Scenario, extra: Record<string, unknown> = {}) {
  return clinical("execucoes", {
    ordem_versao_id: s.clinicalVersion,
    evento_referencia: randomUUID(),
    executada_em: clinicalTime,
    quantidade_aplicada: "1",
    unidade_medida_id: s.measure,
    resultado: "integral",
    situacao_material: "pendente",
    confirmacao_humana: true,
    motivo: "Execução fictícia",
    ...extra,
  });
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
test("protocolo exige aprovação, etapas atômicas e espécie compatível", async () => {
  const s = await scenario();
  assert.equal(
    (await post("versoes", { ...s.versionBody, versao: 3 })).statusCode,
    409,
  );
  const v = await create("versoes", { ...s.versionBody, versao: 2 });
  const body = {
    paciente_id: s.patient,
    protocolo_versao_id: v,
    inicio_data: "2026-01-31",
    referencia: randomUUID(),
  };
  assert.equal((await post("adesoes", body)).statusCode, 409);
  await create("aprovacoes", { protocolo_versao_id: v });
  assert.equal((await post("adesoes", body)).statusCode, 200);
  const wrong = await create("versoes", {
    ...s.versionBody,
    versao: 3,
    especie_codigo: "felina",
  });
  await create("aprovacoes", { protocolo_versao_id: wrong });
  assert.equal(
    (
      await post("adesoes", {
        ...body,
        protocolo_versao_id: wrong,
        referencia: randomUUID(),
      })
    ).statusCode,
    409,
  );
  await assert.rejects(
    admin.query("UPDATE hvb.etapa_protocolo SET intervalo=2 WHERE id=$1", [
      s.stages.meses,
    ]),
  );
  assert.equal(
    (await post("aprovacoes", { protocolo_versao_id: v, simulacao: "true" }))
      .statusCode,
    400,
  );
});
test("dias e meses seguem âncora distinta, incluindo fevereiro e ano bissexto", async () => {
  const s = await scenario();
  const base = { protocolo_paciente_id: s.enrollment, sequencia: 2 };
  assert.equal(
    (
      await post("ocorrencias", {
        ...base,
        etapa_id: s.stages.meses,
        prevista_data: "2026-03-02",
      })
    ).statusCode,
    409,
  );
  await create("ocorrencias", {
    ...base,
    etapa_id: s.stages.meses,
    prevista_data: "2026-02-28",
  });
  await create("ocorrencias", {
    ...base,
    etapa_id: s.stages.dias,
    prevista_data: "2026-03-02",
  });
  await create("ocorrencias", {
    ...base,
    etapa_id: s.stages.meses,
    sequencia: 3,
    prevista_data: "2026-03-31",
  });
  assert.equal(
    (
      await post("ocorrencias", {
        ...base,
        etapa_id: s.stages.unica,
        prevista_data: "2026-01-31",
      })
    ).statusCode,
    409,
  );
  const p = await create("adesoes", {
    paciente_id: s.patient,
    protocolo_versao_id: s.version,
    inicio_data: "2024-01-31",
    referencia: randomUUID(),
  });
  await create("ocorrencias", {
    ...base,
    protocolo_paciente_id: p,
    etapa_id: s.stages.meses,
    prevista_data: "2024-02-29",
  });
  const list = await get("ocorrencias", `protocolo_paciente_id=${p}`);
  assert.equal(list[0]?.prevista_data, "2024-02-29");
  assert.equal(list[0]?.sequencia, 2);
});
test("programação concorrente e retry mantêm uma ocorrência sem aplicação fictícia", async () => {
  const s = await scenario(),
    body = {
      protocolo_paciente_id: s.enrollment,
      etapa_id: s.stages.dias,
      sequencia: 2,
      prevista_data: "2026-03-02",
    },
    key = randomUUID();
  const rs = await Promise.all(
    Array.from({ length: 5 }, () => post("ocorrencias", body, key)),
  );
  assert.ok(rs.every((r) => r.statusCode === 200));
  assert.equal(new Set(rs.map((r) => r.json().id)).size, 1);
  assert.equal((await post("ocorrencias", body)).statusCode, 409);
  assert.equal(
    (await rows("aplicacao_preventiva", "ocorrencia_id", s.occurrence)).length,
    0,
  );
  assert.equal((await rows("execucao", "episodio_id", s.episode)).length, 0);
  assert.equal(
    (await rows("posicao_estoque", "id", s.position))[0]?.saldo_base,
    "20.000000",
  );
});
test("atraso gera revisão explícita; resolução não inventa aplicação", async () => {
  const s = await scenario();
  const body = {
    ocorrencia_id: s.occurrence,
    observada_em: "2026-02-02T12:00:00Z",
    descricao: "Atraso fictício para revisão humana",
  };
  assert.equal(
    (await post("revisoes", { ...body, observada_em: "2026-01-31T12:00:00Z" }))
      .statusCode,
    409,
  );
  const r = await create("revisoes", body);
  assert.equal((await post("revisoes", body)).statusCode, 409);
  await create("resolucoes", {
    revisao_id: r,
    orientacao: "Conferir informação, sem ato assistencial",
  });
  const list = await get("revisoes", `ocorrencia_id=${s.occurrence}`);
  assert.equal(list[0]?.situacao, "resolvida");
  assert.equal(list[0]?.situacao_ocorrencia, "atrasada");
  assert.equal(
    (await rows("aplicacao_preventiva", "ocorrencia_id", s.occurrence)).length,
    0,
  );
});
test("aplicação externa preserva proveniência e correção, sem estoque ou usuário inventado", async () => {
  const s = await scenario(),
    body = application(s),
    key = randomUUID();
  const r = await post("aplicacoes", body, key);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal((await post("aplicacoes", body, key)).json().id, r.json().id);
  assert.equal((await post("aplicacoes", application(s))).statusCode, 409);
  const corrected = await create(
    "aplicacoes",
    application(s, {
      correcao_de_id: r.json().id,
      lote_declarado: "Declaração corrigida",
    }),
  );
  const list = await get("aplicacoes", `ocorrencia_id=${s.occurrence}`);
  assert.equal(list.find((x) => x.id === r.json().id)?.ativa, false);
  assert.equal(list.find((x) => x.id === corrected)?.ativa, true);
  assert.equal(list.find((x) => x.id === corrected)?.execucao_id, null);
  assert.equal(
    (await rows("posicao_estoque", "id", s.position))[0]?.saldo_base,
    "20.000000",
  );
  assert.equal(
    (
      await post("revisoes", {
        ocorrencia_id: s.occurrence,
        observada_em: clinicalTime,
        descricao: "Não deve abrir atraso realizado",
      })
    ).statusCode,
    409,
  );
});
test("substituição aponta adesão sucessora e preserva programação anterior", async () => {
  const s = await scenario(),
    next = await create("adesoes", {
      paciente_id: s.patient,
      protocolo_versao_id: s.version,
      inicio_data: "2026-09-01",
      referencia: randomUUID(),
    });
  await create("encerramentos", {
    protocolo_paciente_id: s.enrollment,
    sucessor_id: next,
    encerrado_em: "2026-09-01T14:00:00Z",
  });
  assert.equal(
    (
      await post("ocorrencias", {
        protocolo_paciente_id: s.enrollment,
        etapa_id: s.stages.dias,
        sequencia: 2,
        prevista_data: "2026-03-02",
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (await get("ocorrencias", `protocolo_paciente_id=${s.enrollment}`))[0]
      ?.situacao,
    "encerrada",
  );
  assert.equal(
    (
      await post("encerramentos", {
        protocolo_paciente_id: next,
        sucessor_id: s.enrollment,
        encerrado_em: "2026-09-02T14:00:00Z",
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await post(
        "aplicacoes",
        application(s, { ocorrida_em: "2026-09-02T12:00:00Z" }),
      )
    ).statusCode,
    409,
  );
  await create("aplicacoes", application(s));
});
test("permissões, unidade e RLS impedem acesso cruzado", async () => {
  const s = await scenario();
  assert.equal(
    (await post("aplicacoes", application(s), randomUUID(), f.readerToken))
      .statusCode,
    403,
  );
  assert.equal(
    (await post("aplicacoes", application(s, { unidade_id: foreign.unit })))
      .statusCode,
    409,
  );
  const r = await app.inject({
    url: `/v1/protocolos/adesoes?unidade_id=${foreign.unit}`,
    headers: { authorization: `Bearer ${foreign.adminToken}` },
  });
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().items.length, 0);
  assert.equal(
    await transaction(
      db,
      foreign.org,
      async (tx) =>
        (
          await tx.query("SELECT id FROM protocolo_paciente WHERE id=$1", [
            s.enrollment,
          ])
        ).rowCount,
    ),
    0,
  );
});
test("aplicação interna compartilha identidade da execução e vincula consumo físico sem nova baixa", async () => {
  const s = await scenario(),
    ex = await execution(s);
  const internal = application(s, { origem: "interna", execucao_id: ex });
  delete internal.profissional_informado;
  const id = await create("aplicacoes", internal);
  assert.equal(id, ex);
  const consumption = await clinical("consumos", {
    episodio_id: s.episode,
    execucao_id: ex,
    evento_referencia: randomUUID(),
    ocorrido_em: clinicalTime,
    finalidade: "Material fictício",
    motivo: "Conciliação fictícia",
    itens_confirmados: true,
    itens: [{ posicao_id: s.position, quantidade_base: "1" }],
  });
  const item = (await rows("consumo_item", "consumo_id", consumption))[0]?.id;
  await create("consumos", { aplicacao_id: id, consumo_item_id: item });
  const links = await get("consumos", `aplicacao_id=${id}`);
  assert.equal(links[0]?.lote_id, s.lot);
  assert.equal(links[0]?.estornado, false);
  assert.equal(
    (await rows("posicao_estoque", "id", s.position))[0]?.saldo_base,
    "19.000000",
  );
  assert.equal(
    (await post("consumos", { aplicacao_id: id, consumo_item_id: item }))
      .statusCode,
    409,
  );
  await clinical(`consumos/${consumption}/reverter`, {
    ocorrido_em: "2026-09-01T13:00:00Z",
    motivo: "Estorno fictício",
  });
  assert.equal(
    (await get("aplicacoes", `ocorrencia_id=${s.occurrence}`))[0]
      ?.material_revisao,
    true,
  );
  assert.equal(
    (await get("consumos", `aplicacao_id=${id}`))[0]?.estornado,
    true,
  );
  assert.equal(
    (await rows("posicao_estoque", "id", s.position))[0]?.saldo_base,
    "20.000000",
  );
});
test("execução de outro paciente, parcial ou com horário diferente não comprova aplicação", async () => {
  const s = await scenario(),
    other = await scenario(),
    wrong = await execution(other),
    partial = await execution(s, { resultado: "parcial" });
  for (const ex of [wrong, partial]) {
    const b = application(s, { origem: "interna", execucao_id: ex });
    delete b.profissional_informado;
    assert.equal((await post("aplicacoes", b)).statusCode, 409);
  }
  const ex = await execution(s),
    b = application(s, {
      origem: "interna",
      execucao_id: ex,
      ocorrida_em: "2026-09-01T13:00:00Z",
    });
  delete b.profissional_informado;
  assert.equal((await post("aplicacoes", b)).statusCode, 409);
});
test("retificação clínica exige aplicação sucessora vinculada e preserva o evento original", async () => {
  const s = await scenario(),
    ex = await execution(s);
  const b = application(s, { origem: "interna", execucao_id: ex });
  delete b.profissional_informado;
  await create("aplicacoes", b);
  const replacement = await clinical(`execucoes/${ex}/retificar`, {
    evento_referencia: randomUUID(),
    executada_em: clinicalTime,
    quantidade_aplicada: "1",
    unidade_medida_id: s.measure,
    resultado: "integral",
    situacao_material: "pendente",
    confirmacao_humana: true,
    motivo: "Correção fictícia",
  });
  assert.equal(
    (await get("ocorrencias", `protocolo_paciente_id=${s.enrollment}`))[0]
      ?.situacao,
    "revisao",
  );
  const corrected = {
    ...b,
    execucao_id: replacement,
    referencia: randomUUID(),
    correcao_de_id: ex,
  };
  const unrelated = await create("ocorrencias", {
    protocolo_paciente_id: s.enrollment,
    etapa_id: s.stages.dias,
    sequencia: 1,
    prevista_data: "2026-01-31",
  });
  assert.equal(
    (
      await post("aplicacoes", {
        ...b,
        execucao_id: replacement,
        ocorrencia_id: unrelated,
        referencia: randomUUID(),
      })
    ).statusCode,
    409,
  );
  assert.equal(await create("aplicacoes", corrected), replacement);
  const applications = await get("aplicacoes", `ocorrencia_id=${s.occurrence}`);
  assert.equal(applications.find((a) => a.id === ex)?.ativa, false);
  assert.equal(applications.find((a) => a.id === replacement)?.ativa, true);
});
test("correções externas concorrentes têm um sucessor e não acrescentam efeitos a comando fechado", async () => {
  const s = await scenario(),
    id = await create("aplicacoes", application(s));
  const rs = await Promise.all([
    post("aplicacoes", application(s, { correcao_de_id: id })),
    post("aplicacoes", application(s, { correcao_de_id: id })),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal(
    (await get("aplicacoes", `ocorrencia_id=${s.occurrence}`)).filter(
      (a) => a.ativa,
    ).length,
    1,
  );
  const original = (await rows("aplicacao_preventiva", "id", id))[0];
  await assert.rejects(
    admin.query(
      "INSERT INTO hvb.protocolo_catalogo(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,codigo,nome) VALUES($1,$2,$3,$4,$5,'tentativa','tentativa','tentativa')",
      [randomUUID(), f.org, f.unit, original?.autor_id, original?.comando_id],
    ),
  );
  await assert.rejects(
    admin.query("DELETE FROM hvb.aplicacao_preventiva WHERE id=$1", [id]),
  );
});
test("horizonte excessivo e encerramento retroativo conflitante são recusados", async () => {
  const s = await scenario();
  const v = await create("versoes", {
    ...s.versionBody,
    versao: 2,
    etapas: [
      {
        ...s.versionBody.etapas[0],
        recorrencia: "meses_calendario",
        intervalo: 36600,
      },
    ],
  });
  await create("aprovacoes", { protocolo_versao_id: v });
  const p = await create("adesoes", {
    paciente_id: s.patient,
    protocolo_versao_id: v,
    inicio_data: "2026-01-31",
    referencia: randomUUID(),
  });
  const et = (await get("etapas", `protocolo_versao_id=${v}`))[0]?.id;
  assert.equal(
    (
      await post("ocorrencias", {
        protocolo_paciente_id: p,
        etapa_id: et,
        sequencia: 1000,
        prevista_data: "2100-12-31",
      })
    ).statusCode,
    409,
  );
  await create("aplicacoes", application(s));
  assert.equal(
    (
      await post("encerramentos", {
        protocolo_paciente_id: s.enrollment,
        encerrado_em: "2026-08-31T12:00:00Z",
      })
    ).statusCode,
    409,
  );
});
test("todas as consultas preventivas têm contrato paginado e limite", async () => {
  await scenario();
  for (const list of preventiveLists) {
    const r = await app.inject({
      url: `/v1${list.path}?unidade_id=${f.unit}&limit=2`,
      headers: { authorization: `Bearer ${f.adminToken}` },
    });
    assert.equal(r.statusCode, 200, `${list.path}: ${r.body}`);
    assert.ok(r.json().items.length <= 2);
  }
});
