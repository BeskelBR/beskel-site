import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { portalScenario } from "../scripts/portal-scenario.ts";
import { portalLists } from "../src/domain/portal/service.ts";
import { command, digest } from "../src/domain/core.ts";
let app: FastifyInstance,
  db: pg.Pool,
  admin: pg.Pool,
  f: Awaited<ReturnType<typeof seedFixture>>,
  foreign: typeof f;
type Scenario = Awaited<ReturnType<typeof portalScenario>>;
const common = () => ({
  unidade_id: f.unit,
  motivo: "Portal fictício",
  simulacao: true,
  confirmacao_humana: true,
});
const post = (
  path: string,
  body: Record<string, unknown>,
  key = randomUUID(),
  token = f.adminToken,
) =>
  app.inject({
    method: "POST",
    url: `/v1/comunicacao/${path}`,
    headers: { authorization: `Bearer ${token}`, "idempotency-key": key },
    payload: { ...common(), ...body },
  });
async function create(path: string, body: Record<string, unknown>) {
  const r = await post(path, body);
  assert.equal(r.statusCode, 200, r.body);
  return r.json().id as string;
}
const scenario = (audience = "responsavel") =>
  portalScenario(app, f.adminToken, f.unit, randomUUID(), audience);
const read = (url: string, token: string) =>
  app.inject({ url, headers: { authorization: `Bearer ${token}` } });
async function credential(s: Scenario, expired = false) {
  const token = randomBytes(32).toString("hex");
  await admin.query(
    "INSERT INTO hvb.credencial_portal(id,organizacao_id,conta_portal_id,token_hash,expira_em) VALUES($1,$2,$3,$4,$5)",
    [
      randomUUID(),
      f.org,
      s.account,
      digest(token),
      expired ? "2020-01-01T00:00:00Z" : "2099-01-01T00:00:00Z",
    ],
  );
  return token;
}
async function attempt(id: string, seq = 0) {
  return create("tentativas", { mensagem_id: id, sequencia_esperada: seq });
}
async function result(id: string, state = "entregue", seq = 0) {
  return create("retornos", {
    tentativa_id: id,
    sequencia_esperada: seq,
    estado: state,
    ocorrido_em: new Date().toISOString(),
    evidencia: "Retorno fictício declarado DEV",
    referencia: randomUUID(),
  });
}
async function publish(s: Scenario) {
  const id = await create("mensagens", s.body);
  await result(await attempt(id));
  return id;
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
test("portal exige identidade separada e concessão explícita por vínculo", async () => {
  const s = await scenario(),
    token = await credential(s),
    id = await publish(s);
  assert.equal((await read("/v1/portal/caixa", f.adminToken)).statusCode, 401);
  assert.equal((await read("/v1/pacientes", token)).statusCode, 401);
  assert.equal(
    (await read(`/v1/portal/mensagens/${id}`, token)).statusCode,
    200,
  );
  assert.equal(
    (await read("/v1/portal/caixa", await credential(s, true))).statusCode,
    401,
  );
  assert.equal(
    (
      await post("concessoes", {
        conta_portal_id: s.account,
        paciente_id: randomUUID(),
        vinculo_id: s.relation,
        valida_ate: "2099-01-01T00:00:00Z",
        evidencia: "Inválida",
      })
    ).statusCode,
    409,
  );
});
test("portal entrega conteúdo exato sem expor metadados internos na caixa", async () => {
  const s = await scenario(),
    token = await credential(s),
    id = await create("mensagens", s.body);
  assert.equal((await read("/v1/portal/caixa", token)).json().items.length, 0);
  const t = await attempt(id);
  await result(t, "enviado");
  assert.equal(
    (await read(`/v1/portal/mensagens/${id}`, token)).statusCode,
    404,
  );
  await result(t, "entregue", 1);
  const list = await read("/v1/portal/caixa?limit=1", token);
  assert.equal(list.statusCode, 200, list.body);
  assert.equal(list.json().items.length, 1);
  assert.equal(list.json().items[0].texto, undefined);
  assert.equal(list.json().items[0].autor_id, undefined);
  const r = await read(`/v1/portal/mensagens/${id}`, token);
  assert.equal(r.statusCode, 200, r.body);
  const d = r.json().documentos[0];
  assert.equal(d.id, s.document);
  assert.equal(
    createHash("sha256").update(d.conteudo).digest("hex"),
    d.hash_conteudo,
  );
  assert.equal(r.json().situacao, "entregue");
  const reread = await read(`/v1/portal/mensagens/${id}`, token);
  assert.equal(reread.json().situacao, "entregue");
});
test("conta de outro responsável e organização não leem a mensagem", async () => {
  const a = await scenario(),
    b = await scenario(),
    id = await publish(a),
    token = await credential(b);
  assert.equal(
    (await read(`/v1/portal/mensagens/${id}`, token)).statusCode,
    404,
  );
  assert.equal((await read("/v1/portal/caixa", token)).json().items.length, 0);
  await transaction(db, foreign.org, async (tx) =>
    assert.equal(
      (await tx.query("SELECT id FROM mensagem_portal WHERE id=$1", [id]))
        .rowCount,
      0,
    ),
  );
  assert.equal(
    (await post("mensagens", a.body, randomUUID(), foreign.adminToken))
      .statusCode,
    404,
  );
});
test("documento interno, destinatário divergente e versão pendente não publicam", async () => {
  const internal = await scenario("interno");
  assert.equal((await post("mensagens", internal.body)).statusCode, 409);
  const s = await scenario(),
    other = await scenario();
  assert.equal(
    (await post("mensagens", { ...s.body, concessao_id: other.grant }))
      .statusCode,
    409,
  );
  assert.equal(
    (await post("mensagens", { ...s.body, documentos: [] })).statusCode,
    400,
  );
  const id = await publish(s),
    token = await credential(s);
  await s.doc(randomUUID(), "versoes", {
    solicitacao_id: s.request,
    modelo_versao_id: s.modelVersion,
    versao_esperada: 1,
    campos: { ...s.fields, registro: "Nova versão" },
  });
  assert.equal(
    (await read(`/v1/portal/mensagens/${id}`, token)).statusCode,
    404,
  );
  assert.equal(
    (await post("mensagens", { ...s.body, referencia: randomUUID() }))
      .statusCode,
    409,
  );
});
test("revogações de conta, concessão e documento suspendem acesso existente", async () => {
  for (const mode of ["conta", "concessao", "documento"]) {
    const s = await scenario(),
      id = await publish(s),
      token = await credential(s);
    if (mode === "conta")
      await create("contas-revogacoes", { conta_portal_id: s.account });
    else if (mode === "concessao")
      await create("concessoes-revogacoes", { concessao_id: s.grant });
    else
      await s.doc(randomUUID(), "revogacoes", {
        autorizacao_id: s.authorization,
      });
    assert.equal(
      (await read(`/v1/portal/mensagens/${id}`, token)).statusCode,
      mode === "conta" ? 401 : 404,
    );
  }
});
test("encerrar vínculo bloqueia leitura sem apagar concessão ou mensagem", async () => {
  const s = await scenario(),
    id = await publish(s),
    token = await credential(s);
  const r = await app.inject({
    method: "POST",
    url: `/v1/vinculos/${s.relation}/encerrar`,
    headers: {
      authorization: `Bearer ${f.adminToken}`,
      "idempotency-key": randomUUID(),
    },
    payload: { fim: new Date().toISOString(), motivo: "Encerramento fictício" },
  });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(
    (await read(`/v1/portal/mensagens/${id}`, token)).statusCode,
    404,
  );
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.mensagem_portal WHERE id=$1",
        [id],
      )
    ).rows[0].n,
    1,
  );
});
test("preferência tem histórico, concorrência e bloqueia nova tentativa", async () => {
  const s = await scenario(),
    id = await create("mensagens", s.body),
    b = {
      conta_portal_id: s.account,
      finalidade: "documento",
      versao_esperada: 1,
      permitida: false,
      evidencia: "Opt-out fictício",
    };
  const rs = await Promise.all([
    post("preferencias", b),
    post("preferencias", b),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal(
    (await post("tentativas", { mensagem_id: id, sequencia_esperada: 0 }))
      .statusCode,
    409,
  );
  assert.equal(
    (await post("mensagens", { ...s.body, referencia: randomUUID() }))
      .statusCode,
    409,
  );
  await create("preferencias", { ...b, versao_esperada: 2, permitida: true });
  await attempt(id);
});
test("resultado incerto exige conciliação e falha permite uma nova tentativa", async () => {
  const s = await scenario(),
    id = await create("mensagens", s.body),
    t = await attempt(id);
  assert.equal(
    (await post("tentativas", { mensagem_id: id, sequencia_esperada: 1 }))
      .statusCode,
    409,
  );
  await result(t, "incerto");
  assert.equal(
    (await post("tentativas", { mensagem_id: id, sequencia_esperada: 1 }))
      .statusCode,
    409,
  );
  await result(t, "falha", 1);
  const rs = await Promise.all([
    post("tentativas", { mensagem_id: id, sequencia_esperada: 1 }),
    post("tentativas", { mensagem_id: id, sequencia_esperada: 1 }),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  await result(rs.find((r) => r.statusCode === 200)?.json().id, "entregue");
  assert.equal(
    (await post("tentativas", { mensagem_id: id, sequencia_esperada: 2 }))
      .statusCode,
    409,
  );
});
test("retornos preservam sequência, tempo e enviado não implica lido", async () => {
  const s = await scenario(),
    id = await create("mensagens", s.body),
    t = await attempt(id);
  const b = {
    tentativa_id: t,
    sequencia_esperada: 0,
    estado: "enviado",
    ocorrido_em: "2020-01-01T00:00:00Z",
    evidencia: "Teste",
    referencia: randomUUID(),
  };
  assert.equal((await post("retornos", b)).statusCode, 409);
  assert.equal(
    (await post("retornos", { ...b, ocorrido_em: "2099-01-01T00:00:00Z" }))
      .statusCode,
    409,
  );
  await result(t, "enviado");
  await result(t, "entregue", 1);
  await result(t, "lido", 2);
  assert.equal(
    (
      await post("retornos", {
        ...b,
        sequencia_esperada: 3,
        ocorrido_em: new Date().toISOString(),
      })
    ).statusCode,
    409,
  );
});
test("retry e referência deduplicam e nenhum envio externo é aceito", async () => {
  const s = await scenario(),
    key = randomUUID(),
    rs = await Promise.all([
      post("mensagens", s.body, key),
      post("mensagens", s.body, key),
    ]);
  for (const r of rs) assert.equal(r.statusCode, 200, r.body);
  assert.equal(rs[0]?.json().id, rs[1]?.json().id);
  assert.equal((await post("mensagens", s.body)).statusCode, 409);
  assert.equal(
    (await post("mensagens", { ...s.body, canal: "email" })).statusCode,
    400,
  );
  assert.equal(
    (await post("mensagens", { ...s.body, simulacao: false })).statusCode,
    400,
  );
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.execucao WHERE organizacao_id=$1",
        [f.org],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.item_conta WHERE organizacao_id=$1",
        [f.org],
      )
    ).rows[0].n,
    0,
  );
});
test("listas seguem contrato, permissões e unidade sem conteúdo privado", async () => {
  const s = await scenario();
  await publish(s);
  for (const list of portalLists) {
    const r = await read(
      `/v1${list.path}?unidade_id=${f.unit}&limit=2`,
      f.adminToken,
    );
    assert.equal(r.statusCode, 200, r.body);
    assert.ok(r.json().items.length <= 2);
    assert.equal(r.json().items[0]?.texto, undefined);
  }
  assert.equal(
    (
      await read(
        `/v1/comunicacao/mensagens?unidade_id=${f.unit}`,
        f.readerToken,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (await post("mensagens", { ...s.body, unidade_id: f.otherUnit }))
      .statusCode,
    404,
  );
  assert.equal(
    (await read("/v1/portal/caixa?limit=101", await credential(s))).statusCode,
    400,
  );
});
test("SQL preserva histórico, comando fechado e documento atômico", async () => {
  const s = await scenario(),
    id = await create("mensagens", s.body);
  await assert.rejects(
    admin.query("UPDATE hvb.mensagem_portal SET texto='outro' WHERE id=$1", [
      id,
    ]),
  );
  await assert.rejects(
    admin.query(
      "INSERT INTO hvb.mensagem_documento(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,mensagem_id,documento_versao_id) SELECT gen_random_uuid(),organizacao_id,unidade_id,autor_id,comando_id,'teste',mensagem_id,documento_versao_id FROM hvb.mensagem_documento WHERE mensagem_id=$1",
      [id],
    ),
    /Comando de exame ausente ou concluido/,
  );
  await assert.rejects(
    transaction(admin, f.org, (tx) =>
      command(
        tx,
        {
          organizacao_id: f.org,
          usuario_id: f.admin,
          credencial_id: f.credential,
        },
        randomUUID(),
        "teste.portal",
        {},
        undefined,
        randomUUID(),
        async (cmd) => {
          const newId = randomUUID();
          await tx.query(
            "INSERT INTO mensagem_portal(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,concessao_id,finalidade,canal,origem,referencia,titulo,texto) VALUES($1,$2,$3,$4,$5,'teste',$6,'documento','portal_dev','registro_manual_dev',$7,'teste','teste')",
            [newId, f.org, f.unit, f.admin, cmd, s.grant, randomUUID()],
          );
          return { id: newId };
        },
      ),
    ),
    /Mensagem documental sem versao atomica/,
  );
});

test("mensagem de agenda exige paciente, responsável e versão exata vigente", async () => {
  const s = await scenario();
  async function agenda(path: string, body: Record<string, unknown>) {
    const r = await app.inject({
      method: "POST",
      url: `/v1/agenda/${path}`,
      headers: {
        authorization: `Bearer ${f.adminToken}`,
        "idempotency-key": randomUUID(),
      },
      payload: { ...common(), ...body },
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.json();
  }
  const resource = await agenda("recursos", {
    nome: "Agenda fictícia portal",
    tipo: "institucional",
  });
  await agenda("disponibilidades", {
    recurso_id: resource.id,
    tipo: "disponivel",
    inicio: "2026-09-01T08:00:00Z",
    fim: "2026-09-01T18:00:00Z",
  });
  const b = {
    paciente_id: s.patient,
    responsavel_id: s.responsible,
    tipo: "consulta",
    referencia: randomUUID(),
    inicio: "2026-09-01T10:00:00Z",
    fim: "2026-09-01T11:00:00Z",
    observacao: "Privado, não copiar automaticamente",
    recursos: [resource.id],
  };
  const a = await agenda("agendamentos", b),
    body = {
      ...s.body,
      finalidade: "agenda",
      documentos: [],
      agendamento_versao_id: a.agendamento_versao_id,
    };
  const id = await create("mensagens", body);
  await result(await attempt(id));
  const token = await credential(s);
  assert.equal(
    (await read(`/v1/portal/mensagens/${id}`, token)).statusCode,
    200,
  );
  await agenda("versoes", {
    agendamento_id: a.id,
    versao_esperada: 1,
    inicio: "2026-09-01T12:00:00Z",
    fim: "2026-09-01T13:00:00Z",
    observacao: b.observacao,
    recursos: b.recursos,
  });
  assert.equal(
    (await read(`/v1/portal/mensagens/${id}`, token)).statusCode,
    404,
  );
  assert.equal(
    (await post("mensagens", { ...body, referencia: randomUUID() })).statusCode,
    409,
  );
});
test("tentativas têm teto e retorno tardio não restaura acesso revogado", async () => {
  const s = await scenario(),
    id = await create("mensagens", s.body);
  for (let i = 0; i < 5; i++) await result(await attempt(id, i), "falha");
  assert.equal(
    (await post("tentativas", { mensagem_id: id, sequencia_esperada: 5 }))
      .statusCode,
    400,
  );
  const other = await create("mensagens", {
      ...s.body,
      referencia: randomUUID(),
    }),
    t = await attempt(other);
  await create("concessoes-revogacoes", { concessao_id: s.grant });
  await result(t, "entregue");
  assert.equal(
    (await read(`/v1/portal/mensagens/${other}`, await credential(s)))
      .statusCode,
    404,
  );
});
