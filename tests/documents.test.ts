import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { documentScenario } from "../scripts/document-scenario.ts";
import { documentLists } from "../src/domain/documents/service.ts";
let app: FastifyInstance,
  db: pg.Pool,
  admin: pg.Pool,
  f: Awaited<ReturnType<typeof seedFixture>>,
  foreign: typeof f;
type Scenario = Awaited<ReturnType<typeof documentScenario>>;
const common = () => ({
  unidade_id: f.unit,
  simulacao: true,
  confirmacao_humana: true,
  motivo: "Teste documental fictício",
});
const post = (
  path: string,
  body: Record<string, unknown>,
  key = randomUUID(),
  token = f.adminToken,
) =>
  app.inject({
    method: "POST",
    url: `/v1/documentos/${path}`,
    headers: { authorization: `Bearer ${token}`, "idempotency-key": key },
    payload: { ...common(), ...body },
  });
async function create(path: string, body: Record<string, unknown>) {
  const r = await post(path, body);
  assert.equal(r.statusCode, 200, r.body);
  return r.json().id as string;
}
const scenario = (audience = "responsavel") =>
  documentScenario(app, f.adminToken, f.unit, randomUUID(), audience);
async function row(table: string, id: string) {
  return (await admin.query(`SELECT * FROM hvb.${table} WHERE id=$1`, [id]))
    .rows[0];
}
const versionBody = (s: Scenario, extra: Record<string, unknown> = {}) => ({
  solicitacao_id: s.request,
  modelo_versao_id: s.modelVersion,
  versao_esperada: 0,
  campos: s.fields,
  ...extra,
});
const authorize = (s: Scenario, decision = "permitida") =>
  create("autorizacoes", {
    solicitacao_id: s.request,
    decisao: decision,
    valida_ate: "2099-12-31T23:59:59Z",
    evidencia: "Decisão fictícia explícita",
  });
async function approve(id: string) {
  const a = await create("aprovacoes", { documento_versao_id: id });
  return (
    await admin.query(
      "SELECT criada_em::text instante FROM hvb.aprovacao_documento WHERE id=$1",
      [a],
    )
  ).rows[0].instante as string;
}
const delivery = (s: Scenario, id: string, time: string) => ({
  documento_versao_id: id,
  destinatario_id: s.responsible,
  entregue_em: time,
  canal: "registro_manual_dev",
  evidencia: "Registro fictício, nenhum envio realizado",
  referencia: randomUUID(),
});
const get = (path: string, query: string, token = f.adminToken) =>
  app.inject({
    url: `/v1/documentos/${path}?unidade_id=${f.unit}&${query}`,
    headers: { authorization: `Bearer ${token}` },
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
test("modelo exige aprovação, campos atômicos e marcadores conhecidos", async () => {
  const s = await scenario(),
    v = await create("modelos-versoes", {
      ...s.modelBody,
      versao: 2,
      texto_base: "{{paciente}} {{registro}} {{observacao}} {{desconhecido}}",
    });
  assert.equal(
    (await post("modelos-aprovacoes", { modelo_versao_id: v })).statusCode,
    409,
  );
  assert.equal(
    (await post("versoes", versionBody(s, { modelo_versao_id: v }))).statusCode,
    409,
  );
  assert.equal(
    (await post("modelos-versoes", { ...s.modelBody, versao: 4 })).statusCode,
    409,
  );
  await assert.rejects(
    admin.query(
      "UPDATE hvb.modelo_documento_versao SET titulo='alterado' WHERE id=$1",
      [s.modelVersion],
    ),
  );
  assert.equal(
    (
      await post("modelos-aprovacoes", {
        modelo_versao_id: s.modelVersion,
        simulacao: "true",
      })
    ).statusCode,
    400,
  );
});
test("preenchimento é texto exato, não recursivo, com hash reproduzível", async () => {
  const s = await scenario(),
    fields = {
      ...s.fields,
      paciente: "{{registro}}",
      registro: "<script>fictício</script> & ç",
    };
  const id = await create("versoes", versionBody(s, { campos: fields })),
    r = await get("conteudos", `documento_versao_id=${id}`);
  assert.equal(r.statusCode, 200, r.body);
  const d = r.json().items[0];
  assert.ok(d.conteudo.includes("Paciente: {{registro}}"));
  assert.ok(d.conteudo.includes(fields.registro));
  assert.equal(
    createHash("sha256").update(d.conteudo).digest("hex"),
    d.hash_conteudo,
  );
  assert.equal(
    (
      await post(
        "versoes",
        versionBody(s, {
          versao_esperada: 1,
          campos: { ...s.fields, registro: 123 },
        }),
      )
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await post(
        "versoes",
        versionBody(s, {
          versao_esperada: 1,
          campos: { ...s.fields, registro: " " },
        }),
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await post(
        "versoes",
        versionBody(s, {
          versao_esperada: 1,
          campos: { ...s.fields, extra: "texto" },
        }),
      )
    ).statusCode,
    409,
  );
});
test("solicitação preserva protocolo e exige contexto coerente de paciente", async () => {
  const s = await scenario(),
    other = await scenario();
  assert.equal(
    (
      await post("solicitacoes", {
        ...s.requestBody,
        episodio_id: other.episode,
        protocolo: randomUUID(),
      })
    ).statusCode,
    409,
  );
  assert.equal((await post("solicitacoes", s.requestBody)).statusCode, 409);
  const body = { ...s.requestBody, protocolo: randomUUID() },
    key = randomUUID();
  const rs = await Promise.all([
    post("solicitacoes", body, key),
    post("solicitacoes", body, key),
  ]);
  assert.ok(rs.every((r) => r.statusCode === 200));
  assert.equal(rs[0]?.json().id, rs[1]?.json().id);
  const r = await get("solicitacoes", `paciente_id=${s.patient}`);
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().items[0].acesso_vigente, false);
});
test("autorização ausente ou negada impede aprovação; revogação impede entrega", async () => {
  const s = await scenario(),
    id = await create("versoes", versionBody(s));
  assert.equal(
    (await post("aprovacoes", { documento_versao_id: id })).statusCode,
    409,
  );
  const auth = await authorize(s),
    time = await approve(id);
  await create("revogacoes", { autorizacao_id: auth });
  assert.equal((await post("entregas", delivery(s, id, time))).statusCode, 409);
  const denied = await scenario(),
    d = await create("versoes", versionBody(denied));
  await authorize(denied, "negada");
  assert.equal(
    (await post("aprovacoes", { documento_versao_id: d })).statusCode,
    409,
  );
});
test("concorrência de versões e repetição não deixam documentos parciais", async () => {
  const s = await scenario(),
    body = versionBody(s),
    key = randomUUID();
  const rs = await Promise.all(
    Array.from({ length: 5 }, () => post("versoes", body, key)),
  );
  assert.ok(rs.every((r) => r.statusCode === 200));
  assert.equal(new Set(rs.map((r) => r.json().id)).size, 1);
  const next = await Promise.all([
    post("versoes", versionBody(s, { versao_esperada: 1 })),
    post("versoes", versionBody(s, { versao_esperada: 1 })),
  ]);
  assert.deepEqual(next.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.documento_versao WHERE solicitacao_id=$1",
        [s.request],
      )
    ).rows[0].n,
    2,
  );
});
test("correção mantém conteúdo e entrega anteriores; rascunho bloqueia nova entrega obsoleta", async () => {
  const s = await scenario();
  await authorize(s);
  const id = await create("versoes", versionBody(s)),
    time = await approve(id),
    old = await row("documento_versao", id);
  await create("entregas", delivery(s, id, time));
  const next = await create(
    "versoes",
    versionBody(s, {
      versao_esperada: 1,
      campos: { ...s.fields, registro: "Texto corrigido" },
    }),
  );
  assert.equal((await post("entregas", delivery(s, id, time))).statusCode, 409);
  let list = (await get("versoes", `solicitacao_id=${s.request}`)).json().items;
  assert.equal(
    list.find((v: { id: string }) => v.id === id).substituido,
    false,
  );
  await approve(next);
  list = (await get("versoes", `solicitacao_id=${s.request}`)).json().items;
  assert.equal(list.find((v: { id: string }) => v.id === id).substituido, true);
  assert.equal(
    (await row("documento_versao", id)).hash_conteudo,
    old.hash_conteudo,
  );
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.entrega_documento WHERE documento_versao_id=$1",
        [id],
      )
    ).rows[0].n,
    1,
  );
});
test("documento interno e destinatário diferente não admitem entrega ao responsável", async () => {
  const s = await scenario("interno");
  await authorize(s);
  const id = await create("versoes", versionBody(s)),
    time = await approve(id);
  assert.equal((await post("entregas", delivery(s, id, time))).statusCode, 409);
  const other = await scenario();
  await authorize(other);
  const d = await create("versoes", versionBody(other)),
    t = await approve(d);
  assert.equal(
    (
      await post("entregas", {
        ...delivery(other, d, t),
        destinatario_id: s.responsible,
      })
    ).statusCode,
    409,
  );
});
test("assinatura declarada permanece não verificada e ligada ao hash exato", async () => {
  const s = await scenario();
  await authorize(s);
  const id = await create("versoes", versionBody(s)),
    time = await approve(id),
    d = await row("documento_versao", id);
  const body = {
    documento_versao_id: id,
    signatario_responsavel_id: s.responsible,
    mecanismo: "declaracao_dev",
    hash_conteudo: d.hash_conteudo,
    declarada_em: time,
    evidencia: "Somente declaração fictícia",
    referencia: randomUUID(),
  };
  assert.equal(
    (await post("assinaturas", { ...body, hash_conteudo: "0".repeat(64) }))
      .statusCode,
    409,
  );
  assert.equal(
    (await post("assinaturas", { ...body, estado: "validada" })).statusCode,
    400,
  );
  const signature = await create("assinaturas", body);
  assert.equal(
    (await row("assinatura_documento", signature)).estado,
    "declarada_nao_verificada",
  );
  assert.equal((await post("assinaturas", body)).statusCode, 409);
});
test("metadados não concedem leitura do conteúdo e RLS não vaza organização", async () => {
  const s = await scenario(),
    id = await create("versoes", versionBody(s));
  await admin.query(
    "INSERT INTO hvb.papel_permissao(organizacao_id,papel_id,permissao) VALUES($1,$2,'documentos:ler') ON CONFLICT DO NOTHING",
    [f.org, f.readerRole],
  );
  const list = await get(
    "versoes",
    `solicitacao_id=${s.request}`,
    f.readerToken,
  );
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().items[0].conteudo, undefined);
  assert.equal(
    (await get("conteudos", `documento_versao_id=${id}`, f.readerToken))
      .statusCode,
    403,
  );
  assert.equal((await get("conteudos", "limit=1")).statusCode, 400);
  assert.equal(
    await transaction(
      db,
      foreign.org,
      async (tx) =>
        (await tx.query("SELECT id FROM documento_versao WHERE id=$1", [id]))
          .rowCount,
    ),
    0,
  );
  assert.equal(
    (await post("versoes", versionBody(s, { unidade_id: foreign.unit })))
      .statusCode,
    404,
  );
});
test("tabelas imutáveis não aceitam efeitos anexados a comando confirmado", async () => {
  const s = await scenario(),
    id = await create("versoes", versionBody(s)),
    d = await row("documento_versao", id);
  await assert.rejects(
    admin.query(
      "UPDATE hvb.documento_versao SET conteudo='outro' WHERE id=$1",
      [id],
    ),
  );
  await assert.rejects(
    admin.query(
      "INSERT INTO hvb.modelo_documento(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,codigo,nome,tipo) VALUES($1,$2,$3,$4,$5,'tentativa','tentativa','tentativa','outro')",
      [randomUUID(), f.org, f.unit, d.autor_id, d.comando_id],
    ),
  );
});
test("todas as listas documentais seguem contrato e paginação", async () => {
  const s = await scenario(),
    id = await create("versoes", versionBody(s));
  for (const list of documentLists) {
    const query = `limit=2${list.path.endsWith("/conteudos") ? `&documento_versao_id=${id}` : ""}`;
    const r = await get(list.path.replace("/documentos/", ""), query);
    assert.equal(r.statusCode, 200, `${list.path}: ${r.body}`);
    assert.ok(r.json().items.length <= 2);
  }
});
