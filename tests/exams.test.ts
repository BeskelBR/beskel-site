import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { examScenario } from "../scripts/exam-scenario.ts";
import { clinicalTime } from "../scripts/clinical-scenario.ts";
import { examLists } from "../src/domain/exams/service.ts";
let app: FastifyInstance,
  db: pg.Pool,
  admin: pg.Pool,
  f: Awaited<ReturnType<typeof seedFixture>>,
  foreign: typeof f;
type Scenario = Awaited<ReturnType<typeof examScenario>>;
const common = () => ({
  unidade_id: f.unit,
  simulacao: true,
  confirmacao_humana: true,
  motivo: "Teste fictício M6A",
});
const post = (
  path: string,
  body: Record<string, unknown>,
  key = randomUUID(),
  token = f.adminToken,
) =>
  app.inject({
    method: "POST",
    url: `/v1/exames/${path}`,
    headers: { authorization: `Bearer ${token}`, "idempotency-key": key },
    payload: { ...common(), ...body },
  });
async function create(path: string, body: Record<string, unknown>) {
  const r = await post(path, body);
  assert.equal(r.statusCode, 200, r.body);
  return r.json().id as string;
}
const scenario = (sample = false) =>
  examScenario(app, f.adminToken, f.unit, randomUUID(), sample);
async function row(table: string, id: string) {
  return (await admin.query(`SELECT * FROM hvb.${table} WHERE id=$1`, [id]))
    .rows[0];
}
const resultBody = (s: Scenario, extra: Record<string, unknown> = {}) => ({
  item_exame_id: s.examItem,
  versao_esperada: 0,
  produzido_em: "2026-09-01T15:00:00Z",
  referencia: randomUUID(),
  origem_idade: "desconhecida",
  observacao: "Resultado fictício, sem interpretação",
  valores: s.values,
  ...extra,
});
const release = (id: string, accepted = true) =>
  create("liberacoes", { resultado_id: id, pendencias_confirmadas: accepted });
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
async function sample(s: Scenario, extra: Record<string, unknown> = {}) {
  return create("coletas", {
    item_exame_id: s.examItem,
    referencia: randomUUID(),
    coletada_em: clinicalTime,
    material: "material-ficticio",
    origem: "externa",
    coletor_informado: "Profissional externo fictício",
    evidencia: "Informação de teste, não verificada",
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
test("estrutura versionada exige aprovação e preserva atributos", async () => {
  const s = await scenario(),
    version = await create("versoes", { ...s.versionBody, versao: 2 });
  assert.equal(
    (
      await post("solicitacoes", {
        episodio_id: s.episode,
        solicitada_em: clinicalTime,
        indicacao: "Fictícia",
        referencia: randomUUID(),
        itens: [{ exame_versao_id: version }],
      })
    ).statusCode,
    409,
  );
  await create("aprovacoes", { exame_versao_id: version });
  await assert.rejects(
    admin.query(
      "UPDATE hvb.atributo_exame_versao SET descricao='Alteração' WHERE id=$1",
      [s.attrs.numero],
    ),
    { code: "23514" },
  );
  assert.equal(
    (await post("versoes", { ...s.versionBody, versao: 4 })).statusCode,
    409,
  );
});
test("solicitação idempotente não inventa execução, consumo ou cobrança", async () => {
  const s = await scenario(),
    body = {
      episodio_id: s.episode,
      solicitada_em: clinicalTime,
      indicacao: "Fictícia",
      referencia: randomUUID(),
      itens: [{ exame_versao_id: s.examVersion }],
    },
    key = randomUUID();
  const rs = await Promise.all(
    Array.from({ length: 5 }, () => post("solicitacoes", body, key)),
  );
  assert.ok(rs.every((r) => r.statusCode === 200));
  assert.equal(new Set(rs.map((r) => r.json().id)).size, 1);
  assert.equal((await post("solicitacoes", body)).statusCode, 409);
  for (const t of ["execucao", "consumo", "evento_cobravel"]) {
    assert.equal(
      (
        await admin.query(
          `SELECT count(*)::int n FROM hvb.${t} WHERE episodio_id=$1`,
          [s.episode],
        )
      ).rows[0].n,
      0,
    );
  }
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    "20.000000",
  );
});
test("valores preservam texto, oito casas e booleano falso sem coerção", async () => {
  const s = await scenario(),
    id = await create("resultados", resultBody(s));
  const response = await app.inject({
    url: `/v1/exames/valores?unidade_id=${f.unit}&resultado_id=${id}`,
    headers: { authorization: `Bearer ${f.adminToken}` },
  });
  assert.equal(response.statusCode, 200, response.body);
  const values = response.json().items as {
    atributo_id: string;
    numero: string | null;
    booleano: boolean | null;
    texto_original: string;
  }[];
  assert.equal(
    values.find((v) => v.atributo_id === s.attrs.numero)?.numero,
    "-1.12345678",
  );
  assert.equal(
    values.find((v) => v.atributo_id === s.attrs.booleano)?.booleano,
    false,
  );
  assert.equal(
    values.find((v) => v.atributo_id === s.attrs.texto)?.booleano,
    null,
  );
  for (const bad of [1.2, "1.123456789", "NaN"]) {
    const b = resultBody(s, {
      versao_esperada: 1,
      valores: [{ ...s.values[0], numero: bad }],
    });
    assert.equal((await post("resultados", b)).statusCode, 400);
  }
  assert.equal(
    (
      await post(
        "resultados",
        resultBody(s, {
          versao_esperada: 1,
          valores: [{ ...s.values[1], booleano: "false" }],
        }),
      )
    ).statusCode,
    400,
  );
});
test("resultado incompleto não libera; ausência explícita exige ciência das pendências", async () => {
  const s = await scenario(),
    draft = await create(
      "resultados",
      resultBody(s, { valores: [s.values[0]] }),
    );
  assert.equal(
    (
      await post("liberacoes", {
        resultado_id: draft,
        pendencias_confirmadas: true,
      })
    ).statusCode,
    409,
  );
  const values = [
    s.values[0],
    {
      atributo_id: s.attrs.booleano,
      situacao: "nao_obtido",
      texto_original: "Não obtido na simulação",
      qualificador: "nao_aplicavel",
      referencia_status: "pendente",
      observacao: "Motivo fictício registrado",
    },
  ];
  const next = await create(
    "resultados",
    resultBody(s, { versao_esperada: 1, valores: values }),
  );
  assert.equal(
    (
      await post("liberacoes", {
        resultado_id: next,
        pendencias_confirmadas: false,
      })
    ).statusCode,
    409,
  );
  await release(next);
  assert.equal(
    (await row("resultado_exame_consulta", next)).tem_pendencias,
    true,
  );
});
test("resultado concorrente e retry preservam uma versão e um conjunto de valores", async () => {
  const s = await scenario(),
    body = resultBody(s),
    key = randomUUID();
  const rs = await Promise.all(
    Array.from({ length: 5 }, () => post("resultados", body, key)),
  );
  assert.ok(
    rs.every((r) => r.statusCode === 200),
    rs.map((r) => r.body).join(),
  );
  assert.equal(new Set(rs.map((r) => r.json().id)).size, 1);
  const nextBody = resultBody(s, { versao_esperada: 1 });
  const concurrent = await Promise.all([
    post("resultados", nextBody),
    post("resultados", { ...nextBody, referencia: randomUUID() }),
  ]);
  assert.deepEqual(concurrent.map((r) => r.statusCode).sort(), [200, 409]);
});
test("liberação guarda hash reproduzível; rascunho posterior não substitui liberado", async () => {
  const s = await scenario(),
    first = await create("resultados", resultBody(s)),
    published = await release(first);
  const docs = await app.inject({
    url: `/v1/exames/documentos?unidade_id=${f.unit}&resultado_id=${first}`,
    headers: { authorization: `Bearer ${f.adminToken}` },
  });
  assert.equal(docs.statusCode, 200, docs.body);
  const doc = docs.json().items[0];
  assert.equal(
    createHash("sha256").update(doc.conteudo_json).digest("hex"),
    doc.hash_conteudo,
  );
  assert.equal(
    (await row("liberacao_resultado", published)).hash_conteudo,
    doc.hash_conteudo,
  );
  const second = await create(
    "resultados",
    resultBody(s, {
      versao_esperada: 1,
      valores: s.values.map((v) =>
        v.atributo_id === s.attrs.numero
          ? { ...v, numero: "2.5", texto_original: "2,5 — correção fictícia" }
          : v,
      ),
    }),
  );
  assert.equal(
    (await row("resultado_exame_consulta", first)).substituido,
    false,
  );
  assert.equal(
    (await row("resultado_exame_consulta", first)).ha_versao_pendente,
    true,
  );
  await release(second);
  assert.equal(
    (await row("resultado_exame_consulta", first)).substituido,
    true,
  );
  assert.equal(
    (await admin.query("SELECT hash_resultado($1,$2) hash", [f.org, first]))
      .rows[0].hash,
    doc.hash_conteudo,
  );
});
test("amostra rejeitada bloqueia resultado; nova coleta aceita preserva rejeição", async () => {
  const s = await scenario(true),
    rejected = await sample(s);
  await create("amostras-decisoes", {
    coleta_id: rejected,
    situacao: "rejeitada",
    avaliada_em: "2026-09-01T13:00:00Z",
  });
  assert.equal(
    (await post("resultados", resultBody(s, { coleta_id: rejected })))
      .statusCode,
    409,
  );
  const accepted = await sample(s);
  await create("amostras-decisoes", {
    coleta_id: accepted,
    situacao: "aceita",
    avaliada_em: "2026-09-01T13:00:00Z",
  });
  const result = await create(
    "resultados",
    resultBody(s, { coleta_id: accepted }),
  );
  await release(result);
  assert.equal(
    (await row("coleta_exame_consulta", rejected)).situacao_amostra,
    "rejeitada",
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
test("coleta interna referencia execução e retificação exige revisão do resultado", async () => {
  const s = await scenario(true),
    execution = await external("/clinica/execucoes", {
      ordem_versao_id: s.version,
      evento_referencia: randomUUID(),
      executada_em: clinicalTime,
      quantidade_aplicada: "1",
      unidade_medida_id: s.measure,
      resultado: "integral",
      situacao_material: "nao_utilizado",
      confirmacao_humana: true,
      motivo: "Coleta fictícia confirmada",
    });
  const collect = await create("coletas", {
    item_exame_id: s.examItem,
    referencia: randomUUID(),
    coletada_em: clinicalTime,
    material: "material-ficticio",
    origem: "interna",
    execucao_id: execution,
    evidencia: "Execução fictícia referenciada",
  });
  await create("amostras-decisoes", {
    coleta_id: collect,
    situacao: "aceita",
    avaliada_em: "2026-09-01T13:00:00Z",
  });
  const result = await create(
    "resultados",
    resultBody(s, { coleta_id: collect }),
  );
  await release(result);
  await external(`/clinica/execucoes/${execution}/retificar`, {
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
    (await row("resultado_exame_consulta", result)).necessita_revisao,
    true,
  );
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    "20.000000",
  );
});
test("referência exige espécie, atributo e idade informada nos limites explícitos", async () => {
  const s = await scenario(),
    ref = await create("referencias", {
      atributo_id: s.attrs.numero,
      versao: 1,
      codigo: "ref-ficticia",
      especie_codigo: "canina",
      idade_min_dias: 1,
      idade_max_dias: 2,
      inclui_idade_min: true,
      inclui_idade_max: false,
      limite_inferior: "-10",
      limite_superior: "10",
      inclui_inferior: true,
      inclui_superior: true,
      descricao: "Intervalo fictício, sem interpretação clínica",
    });
  const values = s.values.map((v) =>
    v.atributo_id === s.attrs.numero
      ? { ...v, referencia_id: ref, referencia_status: "informada" }
      : v,
  );
  for (const opts of [
    { idade_dias: 2, origem_idade: "informada" },
    { idade_dias: 1, origem_idade: "estimada" },
    { origem_idade: "desconhecida" },
  ])
    assert.equal(
      (await post("resultados", resultBody(s, { valores: values, ...opts })))
        .statusCode,
      409,
    );
  const result = await create(
    "resultados",
    resultBody(s, {
      valores: values,
      idade_dias: 1,
      origem_idade: "informada",
    }),
  );
  await release(result, false);
  assert.equal(
    (await row("resultado_exame_consulta", result)).tem_pendencias,
    false,
  );
});
test("mistura de atributos desfaz resultado inteiro e preserva próxima versão", async () => {
  const s = await scenario(),
    other = await scenario();
  assert.equal(
    (
      await post(
        "resultados",
        resultBody(s, {
          valores: [
            s.values[0],
            { ...s.values[1], atributo_id: other.attrs.booleano },
          ],
        }),
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.resultado_versao WHERE item_exame_id=$1",
        [s.examItem],
      )
    ).rows[0].n,
    0,
  );
  await create("resultados", resultBody(s));
});
test("cancelamento preserva rascunho e não apaga resultado liberado", async () => {
  const s = await scenario(),
    draft = await create("resultados", resultBody(s));
  await create("cancelamentos", { item_exame_id: s.examItem });
  assert.equal(
    (
      await post("liberacoes", {
        resultado_id: draft,
        pendencias_confirmadas: true,
      })
    ).statusCode,
    409,
  );
  const other = await scenario(),
    published = await create("resultados", resultBody(other));
  await release(published);
  assert.equal(
    (await post("cancelamentos", { item_exame_id: other.examItem })).statusCode,
    409,
  );
});
test("papéis e contexto impedem ler ou escrever exames de outra organização/unidade", async () => {
  const s = await scenario();
  assert.equal(
    (await post("resultados", resultBody(s), randomUUID(), f.nurseToken))
      .statusCode,
    403,
  );
  assert.ok(
    [404, 409].includes(
      (await post("resultados", resultBody(s, { unidade_id: f.otherUnit })))
        .statusCode,
    ),
  );
  assert.ok(
    [404, 409].includes(
      (
        await post(
          "resultados",
          resultBody(s, { unidade_id: foreign.unit }),
          randomUUID(),
          foreign.adminToken,
        )
      ).statusCode,
    ),
  );
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('hvb.org',$1,true)", [foreign.org]);
    assert.equal(
      (
        await client.query("SELECT id FROM hvb.item_exame WHERE id=$1", [
          s.examItem,
        ])
      ).rowCount,
      0,
    );
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
});
test("SQL não acrescenta valor a resultado confirmado nem modifica liberação", async () => {
  const s = await scenario(),
    id = await create("resultados", resultBody(s)),
    published = await release(id),
    r = await row("resultado_versao", id);
  await assert.rejects(
    admin.query(
      "INSERT INTO hvb.valor_resultado(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,resultado_id,atributo_id,situacao,texto_original,qualificador,referencia_status,observacao) VALUES($1,$2,$3,$4,$5,'Fictício',$6,$7,'nao_obtido','Fictício','nao_aplicavel','pendente','Fictício')",
      [randomUUID(), f.org, f.unit, f.admin, r.comando_id, id, s.attrs.numero],
    ),
    { code: "23514" },
  );
  await assert.rejects(
    admin.query(
      "UPDATE hvb.liberacao_resultado SET hash_conteudo=repeat('0',64) WHERE id=$1",
      [published],
    ),
    { code: "23514" },
  );
  await assert.rejects(
    admin.query("SELECT '1.123456789'::hvb.decimal_resultado"),
    { code: "23514" },
  );
});
test("consultas limitadas preservam tipos e documento exige resultado específico", async () => {
  const s = await scenario(),
    id = await create("resultados", resultBody(s));
  await release(id);
  for (const l of examLists) {
    const r = await app.inject({
      url: `/v1${l.path}?unidade_id=${f.unit}&limit=2${l.path.endsWith("/documentos") ? `&resultado_id=${id}` : ""}`,
      headers: { authorization: `Bearer ${f.adminToken}` },
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.ok(r.json().items.length <= 2);
  }
  const denied = await app.inject({
    url: `/v1/exames/documentos?unidade_id=${f.unit}`,
    headers: { authorization: `Bearer ${f.adminToken}` },
  });
  assert.equal(denied.statusCode, 400);
});
