import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { coreJourney } from "../scripts/core-journey.ts";

let app: FastifyInstance,
  db: pg.Pool,
  admin: pg.Pool,
  f: Awaited<ReturnType<typeof seedFixture>>;
const post = (
  path: string,
  body: Record<string, unknown>,
  key: string = randomUUID(),
) =>
  app.inject({
    method: "POST",
    url: `/v1${path}`,
    headers: {
      authorization: `Bearer ${f.adminToken}`,
      "idempotency-key": key,
    },
    payload: body,
  });
const read = (url: string, token = f.adminToken) =>
  app.inject({
    url: `/v1${url}`,
    headers: { authorization: `Bearer ${token}` },
  });
async function row(table: string, id: string) {
  return (await admin.query(`SELECT * FROM hvb.${table} WHERE id=$1`, [id]))
    .rows[0];
}
const scenario = () => coreJourney(app, f.adminToken, f.unit);
before(async () => {
  const url = process.env.TEST_MIGRATION_DATABASE_URL ?? "";
  assert.equal(new URL(url).pathname, "/hvb_sistema_test");
  await migrate(url);
  f = await seedFixture(url);
  admin = pool(url, 1);
  db = pool(process.env.TEST_DATABASE_URL ?? "", 5);
  app = await buildApp(db);
});
after(async () => {
  await app?.close();
  await db?.end();
  await admin?.end();
});

test("jornada conserva episódio único, custo físico e cobrança incluída sem dívida", async () => {
  const s = await scenario();
  assert.equal(s.medical.episode, s.daily.episode);
  assert.equal(s.portal.episode, s.daily.episode);
  assert.equal(s.financial.episode, s.daily.episode);
  const ci = (
    await admin.query("SELECT * FROM hvb.consumo_item WHERE consumo_id=$1", [
      s.consumption,
    ])
  ).rows[0];
  assert.equal(ci.quantidade_base, "2.000000");
  assert.equal(ci.custo_total_snapshot, "2.500000000000");
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    "8.000000",
  );
  assert.equal(
    (await row("avaliacao_cobranca", s.evaluation)).resultado,
    "incluido",
  );
  assert.equal((await row("item_conta", s.item)).valor, "0.00");
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.responsabilidade WHERE item_conta_id=$1",
        [s.item],
      )
    ).rows[0].n,
    0,
  );
  const r = await read(
    `/prontuario/linha-do-tempo?unidade_id=${f.unit}&paciente_id=${s.daily.patient}&episodio_id=${s.daily.episode}&inicio_registro=2026-01-01T00:00:00Z&fim_registro=2027-01-01T00:00:00Z&fontes=evolucoes,clinica,documentos`,
  );
  assert.equal(r.statusCode, 200, r.body);
  for (const id of [
    s.financial.execution,
    s.consumption,
    s.medical.evolutionVersion,
    s.portal.document,
  ])
    assert.equal(
      r.json().items.filter((i: { id: string }) => i.id === id).length,
      1,
    );
  assert.equal(
    r.json().items.filter((i: { tipo: string }) => i.tipo === "execucao")
      .length,
    1,
  );
});

test("retomada da jornada repete comandos sem duplicar consumo, cobertura ou documento", async () => {
  const a = await scenario(),
    b = await coreJourney(app, f.adminToken, f.unit, a.prefix);
  for (const field of [
    "consumption",
    "coverage",
    "evaluation",
    "item",
    "message",
  ] as const)
    assert.equal(a[field], b[field]);
  assert.equal(a.medical.evolutionVersion, b.medical.evolutionVersion);
  assert.equal(a.portal.document, b.portal.document);
  assert.equal(
    (await row("posicao_estoque", a.position)).saldo_base,
    "8.000000",
  );
  const retry = await post(
    "/clinica/consumos",
    a.consumptionBody,
    `${a.prefix}-jornada-consumo`,
  );
  assert.equal(retry.statusCode, 200, retry.body);
  assert.equal(retry.json().repetido, true);
});

test("falha de consumo adicional desfaz efeitos e estorno não apaga cobertura ou documento", async () => {
  const s = await scenario();
  const fail = await post("/clinica/consumos", {
    ...s.consumptionBody,
    execucao_id: undefined,
    evento_referencia: randomUUID(),
    itens: [
      { posicao_id: s.position, quantidade_base: "1" },
      { posicao_id: randomUUID(), quantidade_base: "1" },
    ],
  });
  assert.ok([404, 409].includes(fail.statusCode), fail.body);
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    "8.000000",
  );
  const reverse = await post(`/clinica/consumos/${s.consumption}/reverter`, {
    ocorrido_em: "2026-09-01T13:00:00Z",
    motivo: "Revisão sintética C3",
  });
  assert.equal(reverse.statusCode, 200, reverse.body);
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    "10.000000",
  );
  assert.equal(
    (await row("execucao_consulta", s.financial.execution))
      .conciliacao_material,
    "pendente",
  );
  // A cobertura é da execução: estornar material não desfaz esse ato.
  assert.equal(
    (await row("avaliacao_cobertura_consulta", s.coverage)).situacao_atual,
    "incluido",
  );
  assert.equal((await row("item_conta", s.item)).valor, "0.00");
  assert.ok(await row("documento_versao", s.portal.document));
  const correction = await post(
    `/clinica/execucoes/${s.financial.execution}/retificar`,
    {
      evento_referencia: randomUUID(),
      executada_em: "2026-09-01T12:00:00Z",
      quantidade_aplicada: "1",
      unidade_medida_id: s.daily.measure,
      resultado: "integral",
      situacao_material: "nao_utilizado",
      confirmacao_humana: true,
      motivo: "Correção fictícia explícita C3",
    },
  );
  assert.equal(correction.statusCode, 200, correction.body);
  assert.equal(
    (await row("item_conta_consulta", s.item)).necessita_revisao,
    true,
  );
  assert.ok(await row("evolucao_clinica_versao", s.medical.evolutionVersion));
});

test("entrega simulada libera só documento autorizado; revogação preserva fatos internos", async () => {
  const s = await scenario(),
    token = randomBytes(32).toString("hex");
  await admin.query(
    "INSERT INTO hvb.credencial_portal(id,organizacao_id,conta_portal_id,token_hash,expira_em) VALUES($1,$2,$3,$4,$5)",
    [
      randomUUID(),
      f.org,
      s.portal.account,
      createHash("sha256").update(token).digest("hex"),
      "2099-01-01T00:00:00Z",
    ],
  );
  assert.equal(
    (await read(`/portal/mensagens/${s.message}`, token)).statusCode,
    404,
  );
  const attempt = await s.portal.portal("tentativa", "tentativas", {
    mensagem_id: s.message,
    sequencia_esperada: 0,
  });
  await s.portal.portal("retorno", "retornos", {
    tentativa_id: attempt,
    sequencia_esperada: 0,
    estado: "entregue",
    ocorrido_em: new Date().toISOString(),
    evidencia: "Retorno sintético local",
    referencia: randomUUID(),
  });
  const response = await read(`/portal/mensagens/${s.message}`, token);
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().documentos[0].id, s.portal.document);
  assert.equal(
    createHash("sha256")
      .update(response.json().documentos[0].conteudo)
      .digest("hex"),
    response.json().documentos[0].hash_conteudo,
  );
  assert.equal(
    (
      await read(
        `/prontuario/versoes/${s.medical.evolutionVersion}?unidade_id=${f.unit}`,
        token,
      )
    ).statusCode,
    401,
  );
  await s.portal.doc("revogacao", "revogacoes", {
    autorizacao_id: s.portal.authorization,
  });
  assert.equal(
    (await read(`/portal/mensagens/${s.message}`, token)).statusCode,
    404,
  );
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    "8.000000",
  );
  assert.equal((await row("item_conta", s.item)).valor, "0.00");
  assert.ok(await row("evolucao_clinica_versao", s.medical.evolutionVersion));
});
