import { before, after, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
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
import { dailyLists } from "../src/domain/daily/service.ts";
let app: FastifyInstance,
  db: pg.Pool,
  admin: pg.Pool,
  f: Awaited<ReturnType<typeof seedFixture>>,
  foreign: typeof f;
type Scenario = Awaited<ReturnType<typeof clinicalScenario>>;
const policy = {
  base_temporal: "periodo_explicito",
  limite_encerramento: "alta_clinica",
  politica_tolerancia: "sem_tolerancia",
  mudanca_classe: "exige_novo_periodo",
  simulacao: true,
};
const range = { inicio: "2026-09-01T10:00:00Z", fim: "2026-09-01T18:00:00Z" };
async function post(
  path: string,
  body: unknown,
  key = randomUUID(),
  token = f.adminToken,
) {
  return app.inject({
    method: "POST",
    url: `/v1${path}`,
    payload: body as Record<string, unknown>,
    headers: { authorization: `Bearer ${token}`, "idempotency-key": key },
  });
}
async function create(path: string, body: unknown) {
  const r = await post(path, body);
  assert.equal(r.statusCode, 200, r.body);
  return r.json().id as string;
}
const scenario = () =>
  clinicalScenario(app, f.adminToken, f.unit, randomUUID(), "internacao");
const ruleBody = (
  pkg: string,
  s: Scenario,
  extra: Record<string, unknown> = {},
) => ({
  pacote_versao_id: pkg,
  item_clinico_id: s.item,
  dimensao: "administracoes",
  janela: "periodo",
  prioridade: 10,
  tratamento: "incluido_limitado",
  limite_quantidade: "1",
  tratamento_excedente: "pendente",
  ...extra,
});
async function configuration(
  s: Scenario,
  extra: Record<string, unknown> = {},
  options: {
    classificationVersion?: string;
    classificationEpisode?: string;
    additionalRules?: Record<string, unknown>[];
  } = {},
) {
  const pkg = await create("/diarias/pacotes", {
    codigo: randomUUID(),
    versao: 1,
    descricao: "Pacote Fictício M4",
    ...policy,
    ...(options.classificationVersion
      ? { classificacao_versao_id: options.classificationVersion }
      : {}),
  });
  const rule = await create("/diarias/regras", ruleBody(pkg, s, extra));
  for (const additional of options.additionalRules ?? [])
    await create("/diarias/regras", ruleBody(pkg, s, additional));
  await create(`/diarias/pacotes/${pkg}/aprovar-simulacao`, {
    simulacao: true,
    confirmacao_humana: true,
    motivo: "Aprovação exclusivamente fictícia",
  });
  const assoc = await create("/diarias/pacotes-episodio", {
    episodio_id: s.episode,
    pacote_versao_id: pkg,
    inicio: "2026-09-01T08:00:00Z",
    fim: "2026-09-03T08:00:00Z",
    motivo: "Associação simulada",
    simulacao: true,
  });
  const period = await create("/diarias/periodos", {
    pacote_episodio_id: assoc,
    ...(options.classificationEpisode
      ? { classificacao_episodio_id: options.classificationEpisode }
      : {}),
    ...range,
    motivo: "Janela fictícia explicitamente informada",
  });
  return { pkg, rule, assoc, period };
}
async function clinicalEvent(s: Scenario, extra: Record<string, unknown> = {}) {
  const execution = await create("/clinica/execucoes", {
    ordem_versao_id: s.version,
    evento_referencia: randomUUID(),
    executada_em: clinicalTime,
    quantidade_aplicada: "1",
    unidade_medida_id: s.measure,
    resultado: "integral",
    situacao_material: "nao_utilizado",
    confirmacao_humana: true,
    motivo: "Fato fictício para cobertura",
    ...extra,
  });
  const event = await create("/diarias/eventos", {
    execucao_id: execution,
    motivo: "Avaliar fato identificado",
  });
  return { execution, event };
}
const evaluate = (
  event: string,
  period?: string,
  version = 0,
  key = randomUUID(),
) =>
  post(
    `/diarias/eventos/${event}/avaliar`,
    {
      ...(period ? { periodo_diaria_id: period } : {}),
      versao_esperada: version,
      motivo: "Avaliação não monetária de simulação",
    },
    key,
  );
async function result(id: string) {
  return (
    await admin.query(
      "SELECT resultado,incluida::text,excedente::text,situacao_atual,justificativa FROM hvb.avaliacao_cobertura_consulta WHERE id=$1",
      [id],
    )
  ).rows[0];
}
before(async () => {
  const url = process.env.TEST_MIGRATION_DATABASE_URL ?? "";
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
  const r = await transaction(admin, f.org, (tx) =>
    tx.query(
      `SELECT count(*)::int AS n FROM uso_cobertura u JOIN regra_pacote r ON r.organizacao_id=u.organizacao_id AND r.id=u.regra_id CROSS JOIN LATERAL compromisso_cobertura(u.id,NULL) c WHERE u.organizacao_id=$1 AND r.limite_quantidade IS NOT NULL AND c.total>r.limite_quantidade`,
      [f.org],
    ),
  );
  assert.equal(r.rows[0].n, 0);
});

test("pacote incompleto não pode ser aprovado; simulação exige confirmação explícita", async () => {
  const s = await scenario();
  const pkg = await create("/diarias/pacotes", {
    codigo: randomUUID(),
    versao: 1,
    descricao: "Rascunho fictício incompleto",
    ...policy,
    politica_tolerancia: "pendente",
  });
  await create("/diarias/regras", ruleBody(pkg, s));
  assert.equal(
    (
      await post(`/diarias/pacotes/${pkg}/aprovar-simulacao`, {
        simulacao: true,
        confirmacao_humana: true,
        motivo: "Não aprovar regra incompleta",
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await post(`/diarias/pacotes/${pkg}/aprovar-simulacao`, {
        simulacao: true,
        confirmacao_humana: "true",
        motivo: "Coerção não é confirmação",
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await post("/diarias/pacotes", {
        codigo: randomUUID(),
        versao: 1,
        descricao: "Não operacional",
        ...policy,
        simulacao: false,
      })
    ).statusCode,
    400,
  );
  const e = await clinicalEvent(s);
  const r = await evaluate(e.event);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal((await result(r.json().id)).resultado, "pendente");
});
test("aprovação congela regras e membros de grupo; versões evoluem sem sobrescrever", async () => {
  const s = await scenario();
  const group = await create("/diarias/grupos", {
    codigo: randomUUID(),
    versao: 1,
    descricao: "Grupo Fictício",
  });
  await create("/diarias/membros-grupo", {
    grupo_versao_id: group,
    item_clinico_id: s.item,
  });
  const c = await configuration(s, {
    item_clinico_id: undefined,
    grupo_versao_id: group,
  });
  assert.equal(
    (await post("/diarias/regras", ruleBody(c.pkg, s))).statusCode,
    409,
  );
  const other = await create("/clinica/itens", {
    nome: "Outro Cuidado Fictício",
    tipo: "cuidado",
  });
  assert.equal(
    (
      await post("/diarias/membros-grupo", {
        grupo_versao_id: group,
        item_clinico_id: other,
      })
    ).statusCode,
    409,
  );
  await assert.rejects(
    transaction(admin, f.org, (tx) =>
      tx.query("UPDATE regra_pacote SET limite_quantidade=99 WHERE id=$1", [
        c.rule,
      ]),
    ),
    { code: "23514" },
  );
  const code = randomUUID();
  await create("/diarias/classificacoes", {
    codigo: code,
    versao: 1,
    descricao: "Classe Fictícia",
  });
  assert.equal(
    (
      await post("/diarias/classificacoes", {
        codigo: code,
        versao: 3,
        descricao: "Salto inválido",
      })
    ).statusCode,
    409,
  );
  await create("/diarias/classificacoes", {
    codigo: code,
    versao: 2,
    descricao: "Versão seguinte fictícia",
  });
});
test("limite concorrente inclui apenas uma administração e nunca gera cobrança", async () => {
  const s = await scenario(),
    c = await configuration(s),
    e1 = await clinicalEvent(s),
    e2 = await clinicalEvent(s);
  const rs = await Promise.all([
    evaluate(e1.event, c.period),
    evaluate(e2.event, c.period),
  ]);
  assert.ok(
    rs.every((r) => r.statusCode === 200),
    rs.map((r) => r.body).join("\n"),
  );
  assert.deepEqual(rs.map((r) => r.json().resultado).sort(), [
    "excedente",
    "incluido",
  ]);
  assert.equal(
    (
      await admin.query(
        "SELECT saldo_base::text FROM hvb.posicao_estoque WHERE id=$1",
        [s.position],
      )
    ).rows[0].saldo_base,
    "20.000000",
  );
  assert.equal(
    (await admin.query("SELECT to_regclass('hvb.item_conta') AS conta")).rows[0]
      .conta,
    null,
  );
});
test("repetição e versão esperada impedem duplicação de avaliação e consumo de limite", async () => {
  const s = await scenario(),
    c = await configuration(s),
    e = await clinicalEvent(s),
    key = randomUUID();
  const rs = await Promise.all(
    Array.from({ length: 5 }, () => evaluate(e.event, c.period, 0, key)),
  );
  assert.ok(rs.every((r) => r.statusCode === 200));
  assert.equal(new Set(rs.map((r) => r.json().id)).size, 1);
  assert.equal((await evaluate(e.event, c.period)).statusCode, 409);
  assert.equal(
    (
      await post("/diarias/eventos", {
        execucao_id: e.execution,
        motivo: "Não duplicar origem",
      })
    ).statusCode,
    409,
  );
  const repeated = await evaluate(e.event, c.period, 0, key);
  assert.equal(repeated.json().repetido, true);
});
test("reavaliação compensa anterior e preserva cadeia; reversão libera limite", async () => {
  const s = await scenario(),
    c = await configuration(s),
    e1 = await clinicalEvent(s),
    e2 = await clinicalEvent(s);
  const first = await evaluate(e1.event, c.period);
  assert.equal(first.statusCode, 200, first.body);
  const excess = await evaluate(e2.event, c.period);
  assert.equal(excess.json().resultado, "excedente");
  await create(`/diarias/avaliacoes/${first.json().id}/reverter`, {
    motivo: "Revisão fictícia do limite",
  });
  const revised = await evaluate(e2.event, c.period, 1);
  assert.equal(revised.statusCode, 200, revised.body);
  assert.equal(revised.json().resultado, "incluido");
  assert.equal((await result(excess.json().id)).situacao_atual, "revertida");
  const again = await evaluate(e2.event, c.period, 2);
  assert.equal(again.json().resultado, "incluido");
  assert.equal(
    (
      await admin.query(
        "SELECT anterior_id FROM hvb.avaliacao_cobertura WHERE id=$1",
        [again.json().id],
      )
    ).rows[0].anterior_id,
    revised.json().id,
  );
});
test("reserva protege limite e efetivação mantém efeito único", async () => {
  const s = await scenario(),
    c = await configuration(s),
    e1 = await clinicalEvent(s),
    e2 = await clinicalEvent(s);
  const reserve = await create("/diarias/reservas", {
    evento_id: e1.event,
    periodo_diaria_id: c.period,
    expira_em: new Date(Date.now() + 60000).toISOString(),
    motivo: "Reserva fictícia",
  });
  assert.equal(
    (await evaluate(e2.event, c.period)).json().resultado,
    "excedente",
  );
  assert.equal((await evaluate(e1.event, c.period)).statusCode, 409);
  const key = randomUUID(),
    body = { versao_esperada: 0, motivo: "Efetivação fictícia" };
  const rs = await Promise.all([
    post(`/diarias/reservas/${reserve}/efetivar`, body, key),
    post(`/diarias/reservas/${reserve}/efetivar`, body, key),
  ]);
  assert.ok(
    rs.every((r) => r.statusCode === 200),
    rs.map((r) => r.body).join("\n"),
  );
  assert.equal(rs[0]?.json().resultado, "incluido");
});
test("reservas concorrentes, liberação e expiração não criam fato ou avaliação", async () => {
  const s = await scenario(),
    c = await configuration(s),
    e1 = await clinicalEvent(s),
    e2 = await clinicalEvent(s);
  const expiry = new Date(Date.now() + 60000).toISOString();
  const rs = await Promise.all([
    post("/diarias/reservas", {
      evento_id: e1.event,
      periodo_diaria_id: c.period,
      expira_em: expiry,
      motivo: "Reserva A",
    }),
    post("/diarias/reservas", {
      evento_id: e2.event,
      periodo_diaria_id: c.period,
      expira_em: expiry,
      motivo: "Reserva B",
    }),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  await create(
    `/diarias/reservas/${rs.find((r) => r.statusCode === 200)?.json().id}/liberar`,
    { motivo: "Liberação fictícia" },
  );
  const reserve = await create("/diarias/reservas", {
    evento_id: e1.event,
    periodo_diaria_id: c.period,
    expira_em: new Date(Date.now() + 500).toISOString(),
    motivo: "Expiração fictícia",
  });
  assert.equal(
    (
      await post(`/diarias/reservas/${reserve}/expirar`, {
        motivo: "Ainda ativa",
      })
    ).statusCode,
    409,
  );
  await setTimeout(550);
  assert.equal(
    (
      await post(`/diarias/reservas/${reserve}/efetivar`, {
        versao_esperada: 0,
        motivo: "Vencida",
      })
    ).statusCode,
    409,
  );
  await create(`/diarias/reservas/${reserve}/expirar`, {
    motivo: "Expiração confirmada",
  });
  assert.equal(
    (await evaluate(e1.event, c.period)).json().resultado,
    "incluido",
  );
});
test("itens distintos contam identidade clínica compartilhada, incluindo reserva e reversão", async () => {
  const s = await scenario();
  const otherItem = await create("/clinica/itens", {
    nome: "Outro Item Fictício",
    tipo: "cuidado",
  });
  const order = await post("/clinica/ordens", {
    prescricao_id: s.prescription,
    ...s.versionBody,
    item_clinico_id: otherItem,
  });
  assert.equal(order.statusCode, 200, order.body);
  const group = await create("/diarias/grupos", {
    codigo: randomUUID(),
    versao: 1,
    descricao: "Distintos Fictícios",
  });
  for (const item of [s.item, otherItem])
    await create("/diarias/membros-grupo", {
      grupo_versao_id: group,
      item_clinico_id: item,
    });
  const c = await configuration(s, {
      item_clinico_id: undefined,
      grupo_versao_id: group,
      dimensao: "itens_distintos",
    }),
    a = await clinicalEvent(s),
    b = await clinicalEvent(s),
    d = await clinicalEvent(s, {
      ordem_versao_id: order.json().ordem_versao_id,
    });
  const reserve = await create("/diarias/reservas", {
    evento_id: a.event,
    periodo_diaria_id: c.period,
    expira_em: new Date(Date.now() + 60000).toISOString(),
    motivo: "Reserva de item distinto",
  });
  const rb = await evaluate(b.event, c.period),
    ra = await post(`/diarias/reservas/${reserve}/efetivar`, {
      versao_esperada: 0,
      motivo: "Efetivação compartilhando identidade",
    });
  assert.equal(ra.json().resultado, "incluido");
  assert.equal(rb.json().resultado, "incluido");
  await create(`/diarias/avaliacoes/${ra.json().id}/reverter`, {
    motivo: "Outro evento do mesmo item mantém uso",
  });
  assert.equal(
    (await evaluate(d.event, c.period)).json().resultado,
    "excedente",
  );
  await create(`/diarias/avaliacoes/${rb.json().id}/reverter`, {
    motivo: "Último evento libera identidade",
  });
  assert.equal(
    (await evaluate(d.event, c.period, 1)).json().resultado,
    "incluido",
  );
});
test("janela por episódio compartilha limite entre períodos; fronteira temporal é explícita", async () => {
  const s = await scenario(),
    c = await configuration(s, { janela: "episodio" });
  const second = await create("/diarias/periodos", {
    pacote_episodio_id: c.assoc,
    inicio: "2026-09-02T10:00:00Z",
    fim: "2026-09-02T18:00:00Z",
    motivo: "Segundo intervalo explícito",
  });
  const e1 = await clinicalEvent(s),
    e2 = await clinicalEvent(s, { executada_em: "2026-09-02T12:00:00Z" }),
    boundary = await clinicalEvent(s, { executada_em: range.fim });
  assert.equal(
    (await evaluate(e1.event, c.period)).json().resultado,
    "incluido",
  );
  assert.equal(
    (await evaluate(e2.event, second)).json().resultado,
    "excedente",
  );
  const out = await evaluate(boundary.event, c.period);
  assert.equal(out.json().resultado, "pendente");
  assert.equal(
    (await result(out.json().id)).justificativa,
    "evento_fora_do_periodo_explicito",
  );
  assert.equal(
    (
      await post("/diarias/periodos", {
        pacote_episodio_id: c.assoc,
        inicio: "2026-09-01T17:00:00Z",
        fim: "2026-09-01T19:00:00Z",
        motivo: "Não sobrepor",
      })
    ).statusCode,
    409,
  );
});
test("prioridade decide regra explícita e empate vira pendência", async () => {
  const s = await scenario();
  const pkg = await create("/diarias/pacotes", {
    codigo: randomUUID(),
    versao: 1,
    descricao: "Conflito Fictício",
    ...policy,
  });
  await create("/diarias/regras", ruleBody(pkg, s));
  await create(
    "/diarias/regras",
    ruleBody(pkg, s, { tratamento: "excluido", limite_quantidade: undefined }),
  );
  await create(`/diarias/pacotes/${pkg}/aprovar-simulacao`, {
    simulacao: true,
    confirmacao_humana: true,
    motivo: "Simulação de conflito",
  });
  const assoc = await create("/diarias/pacotes-episodio", {
    episodio_id: s.episode,
    pacote_versao_id: pkg,
    inicio: "2026-09-01T08:00:00Z",
    fim: "2026-09-02T08:00:00Z",
    simulacao: true,
    motivo: "Associação fictícia",
  });
  const period = await create("/diarias/periodos", {
      pacote_episodio_id: assoc,
      ...range,
      motivo: "Período fictício",
    }),
    e = await clinicalEvent(s),
    r = await evaluate(e.event, period);
  assert.equal(r.json().resultado, "pendente");
  assert.equal(
    (await result(r.json().id)).justificativa,
    "conflito_de_prioridade_entre_regras",
  );
  const t = await scenario(),
    c = await configuration(
      t,
      {
        tratamento: "excluido",
        limite_quantidade: undefined,
        prioridade: 20,
      },
      { additionalRules: [{ prioridade: 10 }] },
    ),
    ev = await clinicalEvent(t);
  assert.equal(
    (await evaluate(ev.event, c.period)).json().resultado,
    "excluido",
  );
});
test("classificação referencia medição de peso informada e mudança invalida período sem apagar avaliação", async () => {
  const s = await scenario();
  const mass = await create("/estoque/unidades", {
    simbolo: randomUUID(),
    dimensao: "massa",
    fator_referencia: "1",
  });
  const peso = await create("/diarias/pesos", {
    episodio_id: s.episode,
    quantidade: "5.2",
    unidade_medida_id: mass,
    medida_em: "2026-09-01T08:30:00Z",
    motivo: "Medição fictícia informada",
  });
  assert.equal(
    (
      await post("/diarias/pesos", {
        episodio_id: s.episode,
        quantidade: "5.2",
        unidade_medida_id: s.measure,
        medida_em: clinicalTime,
        motivo: "Dimensão incompatível",
      })
    ).statusCode,
    409,
  );
  const cls = await create("/diarias/classificacoes", {
    codigo: randomUUID(),
    versao: 1,
    descricao: "Classe Fictícia A",
  });
  const assigned = await create("/diarias/classificacoes-episodio", {
    episodio_id: s.episode,
    classificacao_versao_id: cls,
    inicio: "2026-09-01T09:00:00Z",
    medicao_peso_id: peso,
    suporte_ventilatorio: "nao_informado",
    motivo: "Classificação fictícia",
  });
  assert.equal(
    (
      await post("/diarias/classificacoes-episodio", {
        episodio_id: s.episode,
        classificacao_versao_id: cls,
        inicio: clinicalTime,
        suporte_ventilatorio: "nao_informado",
        motivo: "Não sobrepor classes",
      })
    ).statusCode,
    409,
  );
  const c = await configuration(
    s,
    {},
    { classificationVersion: cls, classificationEpisode: assigned },
  );
  const e = await clinicalEvent(s),
    av = await evaluate(e.event, c.period);
  assert.equal(av.json().resultado, "incluido");
  await create(`/diarias/classificacoes-episodio/${assigned}/encerrar`, {
    fim: "2026-09-01T13:00:00Z",
    motivo: "Mudança fictícia",
  });
  assert.equal(
    (await result(av.json().id)).situacao_atual,
    "revisao_necessaria",
  );
  assert.equal(
    (
      await post("/diarias/periodos", {
        pacote_episodio_id: c.assoc,
        classificacao_episodio_id: assigned,
        inicio: "2026-09-02T10:00:00Z",
        fim: "2026-09-02T18:00:00Z",
        motivo: "Classe não cobre período",
      })
    ).statusCode,
    409,
  );
});
test("alta retroativa e retificação da origem exigem revisão, preservando capacidade até decisão", async () => {
  const s = await scenario(),
    c = await configuration(s),
    e = await clinicalEvent(s),
    r = await evaluate(e.event, c.period);
  await create(`/episodios/${s.episode}/alta`, {
    ocorrido_em: "2026-09-01T13:00:00Z",
    versao_esperada: 1,
    motivo: "Alta fictícia",
  });
  assert.equal(
    (await result(r.json().id)).situacao_atual,
    "revisao_necessaria",
  );
  const next = await evaluate(e.event, c.period, 1);
  assert.equal(next.json().resultado, "pendente");
  assert.equal((await result(r.json().id)).situacao_atual, "revertida");
  const t = await scenario(),
    d = await configuration(t),
    x = await clinicalEvent(t),
    av = await evaluate(x.event, d.period);
  await create(`/clinica/execucoes/${x.execution}/retificar`, {
    evento_referencia: randomUUID(),
    executada_em: clinicalTime,
    quantidade_aplicada: "1",
    unidade_medida_id: t.measure,
    resultado: "integral",
    situacao_material: "nao_utilizado",
    confirmacao_humana: true,
    motivo: "Retificação fictícia",
  });
  assert.equal(
    (await result(av.json().id)).situacao_atual,
    "revisao_necessaria",
  );
  const another = await clinicalEvent(t);
  assert.equal(
    (await evaluate(another.event, d.period)).json().resultado,
    "excedente",
  );
});
test("execução parcial fica pendente sem converter parcial em administração integral", async () => {
  const s = await scenario(),
    c = await configuration(s),
    e = await clinicalEvent(s, {
      resultado: "parcial",
      quantidade_aplicada: "0.5",
    }),
    r = await evaluate(e.event, c.period);
  assert.equal(r.json().resultado, "pendente");
  assert.equal((await result(r.json().id)).incluida, null);
});
test("isolamento e permissões impedem avaliar outra unidade ou aprovar regra sem papel", async () => {
  const s = await scenario(),
    c = await configuration(s),
    e = await clinicalEvent(s);
  assert.equal(
    (
      await post(
        `/diarias/eventos/${e.event}/avaliar`,
        {
          periodo_diaria_id: c.period,
          versao_esperada: 0,
          motivo: "Leitor sem permissão",
        },
        randomUUID(),
        f.readerToken,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await post(
        `/diarias/eventos/${e.event}/avaliar`,
        {
          periodo_diaria_id: c.period,
          versao_esperada: 0,
          motivo: "Outra organização",
        },
        randomUUID(),
        foreign.adminToken,
      )
    ).statusCode,
    404,
  );
  await assert.rejects(
    transaction(db, f.org, (tx) =>
      tx.query("UPDATE pacote_versao SET simulacao=false WHERE id=$1", [c.pkg]),
    ),
    { code: "42501" },
  );
});
test("quantidade física é exata, não muda consumo/custo e material do tutor permanece pendente", async () => {
  const s = await scenario();
  const old = await admin.query(
    "SELECT id FROM hvb.custodia WHERE organizacao_id=$1 AND tipo='hospital'",
    [f.org],
  );
  const custody =
    old.rows[0]?.id ??
    (await create("/estoque/custodias", { tipo: "hospital" }));
  const position = await create("/estoque/posicoes", {
    local_id: s.local,
    lote_id: s.lot,
    custodia_id: custody,
  });
  await create("/estoque/entradas", {
    posicao_id: position,
    quantidade_apresentacoes: "5",
    ocorrido_em: "2026-09-01T11:00:00Z",
    motivo: "Entrada hospitalar fictícia",
  });
  async function consume(pos: string, quantity: string) {
    const c = await create("/clinica/consumos", {
      episodio_id: s.episode,
      evento_referencia: randomUUID(),
      ocorrido_em: clinicalTime,
      finalidade: "Material fictício",
      motivo: "Uso fictício informado",
      itens_confirmados: true,
      itens: [{ posicao_id: pos, quantidade_base: quantity }],
    });
    const item = (
      await admin.query(
        "SELECT id,custo_total_snapshot::text FROM hvb.consumo_item WHERE consumo_id=$1",
        [c],
      )
    ).rows[0];
    const event = await create("/diarias/eventos", {
      consumo_item_id: item.id,
      motivo: "Origem física explícita",
    });
    return { consumption: c, item, event };
  }
  const c = await configuration(s, {
      item_clinico_id: undefined,
      produto_id: s.product,
      dimensao: "quantidade_fisica",
      limite_quantidade: "0.2",
      unidade_limite_id: s.measure,
    }),
    physical = await consume(position, "0.3");
  const r = await evaluate(physical.event, c.period);
  assert.equal(r.statusCode, 200, r.body);
  const av = await result(r.json().id);
  assert.equal(av.resultado, "parcial");
  assert.equal(av.incluida, "0.200000");
  assert.equal(av.excedente, "0.100000");
  assert.equal(physical.item.custo_total_snapshot, "0.375000000000");
  assert.equal(
    (
      await admin.query(
        "SELECT saldo_base::text FROM hvb.posicao_estoque WHERE id=$1",
        [position],
      )
    ).rows[0].saldo_base,
    "4.700000",
  );
  const tutor = await consume(s.position, "1"),
    t = await evaluate(tutor.event, c.period);
  assert.equal(t.json().resultado, "pendente");
  assert.equal(tutor.item.custo_total_snapshot, null);
  assert.equal(
    (await result(t.json().id)).justificativa,
    "politica_de_material_do_tutor_pendente",
  );
  await create(`/clinica/consumos/${physical.consumption}/reverter`, {
    ocorrido_em: clinicalTime,
    motivo: "Estorno físico sem revisão comercial automática",
  });
  assert.equal(
    (await result(r.json().id)).situacao_atual,
    "revisao_necessaria",
  );
});
test("limites por período são independentes e cobertura ilimitada é somente explícita", async () => {
  const s = await scenario(),
    c = await configuration(s),
    p = await create("/diarias/periodos", {
      pacote_episodio_id: c.assoc,
      inicio: "2026-09-02T10:00:00Z",
      fim: "2026-09-02T18:00:00Z",
      motivo: "Outro período explícito",
    }),
    a = await clinicalEvent(s),
    b = await clinicalEvent(s, { executada_em: "2026-09-02T12:00:00Z" });
  assert.equal(
    (await evaluate(a.event, c.period)).json().resultado,
    "incluido",
  );
  assert.equal((await evaluate(b.event, p)).json().resultado, "incluido");
  const t = await scenario(),
    u = await configuration(t, {
      tratamento: "incluido_sem_limite",
      limite_quantidade: undefined,
    });
  for (let i = 0; i < 3; i++) {
    const e = await clinicalEvent(t);
    assert.equal(
      (await evaluate(e.event, u.period)).json().resultado,
      "incluido",
    );
  }
});
test("consultas de diária serializam regras, alocações e estados com filtros paginados", async () => {
  const s = await scenario(),
    c = await configuration(s),
    e = await clinicalEvent(s);
  await evaluate(e.event, c.period);
  for (const list of dailyLists) {
    const q = new URLSearchParams({ limit: "2" });
    if (list.unit) q.set("unidade_id", f.unit);
    if (list.columns.split(",").includes("episodio_id"))
      q.set("episodio_id", s.episode);
    const r = await app.inject({
      url: `/v1${list.path}?${q}`,
      headers: { authorization: `Bearer ${f.adminToken}` },
    });
    assert.equal(r.statusCode, 200, `${list.path}: ${r.body}`);
    assert.ok(r.json().items.length <= 2);
  }
});
