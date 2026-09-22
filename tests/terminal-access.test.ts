import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { clinicalScenario } from "../scripts/clinical-scenario.ts";
import { createDevEvidenceAdapter } from "../src/domain/terminal-access/evidence.ts";
import type { VerifiedEvidence } from "../src/domain/terminal-access/evidence.ts";
const simulator = createDevEvidenceAdapter(randomBytes(32));
let app: FastifyInstance,
  closed: FastifyInstance,
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
  app = await buildApp(db, false, simulator.adapter);
  closed = await buildApp(db);
});
after(async () => {
  await app?.close();
  await closed?.close();
  await db?.end();
  await admin?.end();
});
const common = () => ({ unidade_id: f.unit, motivo: "Ensaio fictício C14" });
const post = (
  path: string,
  payload: Record<string, unknown>,
  device?: string,
  key = randomUUID(),
  token = f.adminToken,
  server = app,
) =>
  server.inject({
    method: "POST",
    url: `/v1${path}`,
    headers: {
      authorization: `Bearer ${token}`,
      "idempotency-key": key,
      ...(device ? { "x-device-id": device } : {}),
    },
    payload,
  });
async function create(
  path: string,
  payload: Record<string, unknown>,
  device?: string,
) {
  const r = await post(path, payload, device);
  assert.equal(r.statusCode, 200, r.body);
  return r.json().id as string;
}
const get = (path: string, query = "", token = f.adminToken) =>
  app.inject({
    url: `/v1${path}?unidade_id=${f.unit}${query}`,
    headers: { authorization: `Bearer ${token}` },
  });
async function row(table: string, id: string) {
  return (await admin.query(`SELECT * FROM hvb.${table} WHERE id=$1`, [id]))
    .rows[0];
}
async function fixture(sensitive = false) {
  const s = await clinicalScenario(app, f.adminToken, f.unit);
  const device = await create("/dispositivos", {
    unidade_id: f.unit,
    nome: "Terminal integrado DEV C14",
  });
  const body = {
    ...common(),
    episodio_id: s.episode,
    observacao: "Pedido fictício",
    itens: [
      {
        produto_id: s.product,
        quantidade_solicitada: "2",
        sensivel: sensitive,
        exige_lote: true,
        observacao: "Conferir no Mobile futuro",
      },
    ],
  };
  const order = await create("/retiradas/ordens", body);
  await create(`/retiradas/ordens/${order}/submit`, common());
  return { ...s, device, order, body };
}
async function challenge(device: string, token = f.adminToken) {
  const r = await post(
    "/terminal/acesso/desafios",
    common(),
    device,
    randomUUID(),
    token,
  );
  assert.equal(r.statusCode, 200, r.body);
  const d = await row("desafio_acesso", r.json().id);
  const claims: VerifiedEvidence = {
    desafio_id: d.id,
    nonce: d.nonce,
    usuario_id: d.autor_id,
    terminal_id: d.dispositivo_id,
    dispositivo_biometrico_id: d.dispositivo_id,
    capturada_em: new Date().toISOString(),
    expira_em: d.expira_em.toISOString(),
    face_match: true,
    liveness: true,
    identity_claim: true,
    engine: "DEV-HMAC",
    versao: "1",
    modo: "SIMULADO_DEV",
  };
  return {
    d,
    claims,
    body: { ...common(), desafio_id: d.id, evidencia: simulator.sign(claims) },
  };
}
async function authenticate(device: string) {
  const c = await challenge(device);
  return create("/terminal/acesso/autenticacoes", c.body, device);
}
async function session(
  s: Awaited<ReturnType<typeof fixture>>,
  sensivel = false,
  ordens = [s.order],
) {
  const auth = await authenticate(s.device);
  return create(
    "/terminal/acesso/sessoes",
    { ...common(), autenticacao_id: auth, sensivel, ordens },
    s.device,
  );
}
const eventBody = (tipo: string) => ({
  ...common(),
  tipo,
  referencia: randomUUID(),
  ocorrida_em: new Date().toISOString(),
});
async function event(id: string, dev: string, tipo: string) {
  return create(`/terminal/acesso/sessoes/${id}/eventos`, eventBody(tipo), dev);
}
async function countEffects() {
  return (
    await admin.query(
      "SELECT (SELECT count(*) FROM hvb.transacao_estoque WHERE organizacao_id=$1)::int estoque,(SELECT count(*) FROM hvb.execucao WHERE organizacao_id=$1)::int execucao,(SELECT count(*) FROM hvb.evento_cobravel WHERE organizacao_id=$1)::int financeiro",
      [f.org],
    )
  ).rows[0];
}

test("autenticação e acesso com duas ordens: só ENTRY_CONFIRMED inicia separação, sem estoque/clínica/financeiro", async () => {
  const s = await fixture();
  const second = await create("/retiradas/ordens", s.body);
  await create(`/retiradas/ordens/${second}/submit`, common());
  const before = await countEffects(),
    id = await session(s, false, [s.order, second]);
  assert.deepEqual(await countEffects(), before);
  await event(id, s.device, "DOOR_AUTHORIZED");
  for (const o of [s.order, second])
    assert.equal(
      (await row("ordem_retirada_consulta", o)).estado,
      "AGUARDANDO_RETIRADA",
    );
  await event(id, s.device, "DOOR_OPEN");
  await event(id, s.device, "ENTRY_CONFIRMED");
  for (const o of [s.order, second])
    assert.equal(
      (await row("ordem_retirada_consulta", o)).estado,
      "EM_SEPARACAO",
    );
  for (const type of ["DOOR_CLOSED", "ACCESS_ACTIVE", "EXIT", "ACCESS_CLOSED"])
    await event(id, s.device, type);
  assert.equal(
    (await row("sessao_acesso_consulta", id)).estado,
    "ACCESS_CLOSED",
  );
  assert.deepEqual(await countEffects(), before);
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    "20.000000",
  );
  const r = await get("/terminal/acesso/eventos", `&sessao_id=${id}`);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().items.length, 8);
});
test("retry concorrente produz um evento, payload diferente conflita e referência duplicada é rejeitada", async () => {
  const s = await fixture(),
    id = await session(s),
    b = eventBody("DOOR_AUTHORIZED"),
    key = randomUUID();
  const path = `/terminal/acesso/sessoes/${id}/eventos`;
  const rs = await Promise.all([
    post(path, b, s.device, key),
    post(path, b, s.device, key),
  ]);
  for (const r of rs) assert.equal(r.statusCode, 200, r.body);
  assert.equal(rs[0]?.json().id, rs[1]?.json().id);
  assert.equal(
    (await post(path, { ...b, motivo: "Outro motivo" }, s.device, key))
      .statusCode,
    409,
  );
  assert.equal(
    (await post(path, { ...b, tipo: "DOOR_OPEN" }, s.device)).statusCode,
    409,
  );
  assert.equal((await row("sessao_acesso_consulta", id)).versao, 2);
});
test("simulação exige adaptador no servidor; UI não fornece flags de confiança", async () => {
  const s = await fixture();
  assert.equal(
    (
      await post(
        "/terminal/acesso/desafios",
        common(),
        s.device,
        randomUUID(),
        f.adminToken,
        closed,
      )
    ).statusCode,
    503,
  );
  const c = await challenge(s.device);
  assert.equal(
    (
      await post(
        "/terminal/acesso/autenticacoes",
        { ...c.body, face_match: true },
        s.device,
      )
    ).statusCode,
    400,
  );
  const forged = createDevEvidenceAdapter(randomBytes(32)).sign(c.claims);
  assert.equal(
    (
      await post(
        "/terminal/acesso/autenticacoes",
        { ...c.body, evidencia: forged },
        s.device,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await post(
        "/terminal/acesso/autenticacoes",
        {
          ...c.body,
          evidencia: simulator.sign({ ...c.claims, nonce: randomUUID() }),
        },
        s.device,
      )
    ).statusCode,
    403,
  );
  const id = await create("/terminal/acesso/autenticacoes", c.body, s.device);
  assert.equal((await row("autenticacao_acesso", id)).nivel, "SIMULADO_DEV");
  assert.equal(
    (await post("/terminal/acesso/autenticacoes", c.body, s.device)).statusCode,
    409,
  );
});
test("evidência expirada, futura ou negativa não autentica; falta de dispositivo e decimal numérico rejeitados", async () => {
  const s = await fixture(),
    c = await challenge(s.device);
  for (const changes of [
    { expira_em: new Date(Date.now() - 1000).toISOString() },
    { capturada_em: "2099-01-01T00:00:00Z" },
    { liveness: false },
    { identity_claim: false },
  ]) {
    const evidence = simulator.sign({
      ...c.claims,
      ...changes,
    } as VerifiedEvidence);
    assert.equal(
      (
        await post(
          "/terminal/acesso/autenticacoes",
          { ...c.body, evidencia: evidence },
          s.device,
        )
      ).statusCode,
      403,
    );
  }
  assert.equal(
    (await post("/terminal/acesso/desafios", common())).statusCode,
    400,
  );
  assert.equal(
    (
      await post("/retiradas/ordens", {
        ...s.body,
        itens: [{ ...s.body.itens[0], quantidade_solicitada: 2 }],
      })
    ).statusCode,
    400,
  );
});
test("escopo sensível é explícito; armário exige entrada e porta fechada", async () => {
  const s = await fixture(true),
    auth = await authenticate(s.device);
  assert.equal(
    (
      await post(
        "/terminal/acesso/sessoes",
        {
          ...common(),
          autenticacao_id: auth,
          sensivel: false,
          ordens: [s.order],
        },
        s.device,
      )
    ).statusCode,
    409,
  );
  const id = await create(
    "/terminal/acesso/sessoes",
    { ...common(), autenticacao_id: auth, sensivel: true, ordens: [s.order] },
    s.device,
  );
  for (const type of ["DOOR_AUTHORIZED", "DOOR_OPEN", "ENTRY_CONFIRMED"]) {
    assert.equal(
      (
        await post(
          `/terminal/acesso/sessoes/${id}/eventos`,
          eventBody("SENSITIVE_CABINET_AUTHORIZED"),
          s.device,
        )
      ).statusCode,
      409,
    );
    await event(id, s.device, type);
  }
  assert.equal(
    (
      await post(
        `/terminal/acesso/sessoes/${id}/eventos`,
        eventBody("SENSITIVE_CABINET_AUTHORIZED"),
        s.device,
      )
    ).statusCode,
    409,
  );
  for (const type of [
    "DOOR_CLOSED",
    "SENSITIVE_CABINET_AUTHORIZED",
    "SENSITIVE_CABINET_OPEN",
    "SENSITIVE_CABINET_CLOSED",
    "ACCESS_ACTIVE",
    "EXIT",
    "ACCESS_CLOSED",
  ])
    await event(id, s.device, type);
});
test("operador sem permissão sensível não cria sessão sensível", async () => {
  const s = await fixture(true);
  await admin.query(
    "INSERT INTO hvb.papel_permissao(organizacao_id,papel_id,permissao) SELECT $1,$2,unnest($3::text[]) ON CONFLICT DO NOTHING",
    [
      f.org,
      f.nurseRole,
      ["terminal:autenticar", "terminal:acessar", "retiradas:ler"],
    ],
  );
  const c = await challenge(s.device, f.nurseToken),
    r = await post(
      "/terminal/acesso/autenticacoes",
      c.body,
      s.device,
      randomUUID(),
      f.nurseToken,
    );
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(
    (
      await post(
        "/terminal/acesso/sessoes",
        {
          ...common(),
          autenticacao_id: r.json().id,
          sensivel: true,
          ordens: [s.order],
        },
        s.device,
        randomUUID(),
        f.nurseToken,
      )
    ).statusCode,
    403,
  );
});
test("ordem não pode pertencer a duas sessões ativas concorrentes", async () => {
  const s = await fixture(),
    a = await authenticate(s.device),
    b = await authenticate(s.device);
  const rs = await Promise.all(
    [a, b].map((autenticacao_id) =>
      post(
        "/terminal/acesso/sessoes",
        { ...common(), autenticacao_id, sensivel: false, ordens: [s.order] },
        s.device,
      ),
    ),
  );
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal(
    (await post(`/retiradas/ordens/${s.order}/cancelar`, common())).statusCode,
    409,
  );
});
test("RLS, unidade, episódio encerrado e dispositivo alheio mantêm fronteiras", async () => {
  const s = await fixture(),
    auth = await authenticate(s.device);
  await transaction(db, foreign.org, async (tx) =>
    assert.equal(
      (await tx.query("SELECT id FROM ordem_retirada WHERE id=$1", [s.order]))
        .rowCount,
      0,
    ),
  );
  assert.equal(
    (
      await post(
        "/terminal/acesso/desafios",
        { ...common(), unidade_id: f.otherUnit },
        s.device,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await get("/retiradas/ordens", `&id=${s.order}`, foreign.adminToken)
    ).json().items.length,
    0,
  );
  const dev = await create("/dispositivos", {
    unidade_id: f.unit,
    nome: "Outro DEV",
  });
  assert.equal(
    (
      await post(
        "/terminal/acesso/sessoes",
        {
          ...common(),
          autenticacao_id: auth,
          sensivel: false,
          ordens: [s.order],
        },
        dev,
      )
    ).statusCode,
    403,
  );
  await create(`/episodios/${s.episode}/encerrar`, {
    ocorrido_em: new Date().toISOString(),
    versao_esperada: 1,
    motivo: "Saída fictícia",
  });
  assert.equal(
    (
      await post(
        "/terminal/acesso/sessoes",
        {
          ...common(),
          autenticacao_id: auth,
          sensivel: false,
          ordens: [s.order],
        },
        s.device,
      )
    ).statusCode,
    409,
  );
});
test("cancelamento e itens são append-only; novas confirmações de fulfillment não existem", async () => {
  const s = await fixture();
  await create(`/retiradas/ordens/${s.order}/cancelar`, common());
  assert.equal(
    (await row("ordem_retirada_consulta", s.order)).estado,
    "CANCELADA",
  );
  assert.equal(
    (await post(`/retiradas/ordens/${s.order}/submit`, common())).statusCode,
    409,
  );
  await assert.rejects(
    admin.query(
      "UPDATE hvb.item_ordem_retirada SET quantidade_solicitada=3 WHERE ordem_id=$1",
      [s.order],
    ),
  );
  await assert.rejects(
    admin.query("DELETE FROM hvb.evento_ordem_retirada WHERE ordem_id=$1", [
      s.order,
    ]),
  );
  assert.equal(
    (await post("/retiradas/fulfillments", { ordem_id: s.order })).statusCode,
    404,
  );
  const source = await readFile("src/domain/terminal/service.ts", "utf8");
  assert.doesNotMatch(
    source,
    /inventoryActions|movimento\.run|\/estoque\/retiradas/,
  );
});
test("evento futuro, fora de ordem e expansão de escopo são rejeitados atomicamente", async () => {
  const s = await fixture(),
    id = await session(s),
    path = `/terminal/acesso/sessoes/${id}/eventos`;
  assert.equal(
    (
      await post(
        path,
        {
          ...eventBody("DOOR_AUTHORIZED"),
          ocorrida_em: "2099-01-01T00:00:00Z",
        },
        s.device,
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (await post(path, eventBody("ENTRY_CONFIRMED"), s.device)).statusCode,
    409,
  );
  for (const type of [
    "DOOR_AUTHORIZED",
    "DOOR_OPEN",
    "ENTRY_CONFIRMED",
    "DOOR_CLOSED",
  ])
    await event(id, s.device, type);
  assert.equal(
    (await post(path, eventBody("SENSITIVE_CABINET_AUTHORIZED"), s.device))
      .statusCode,
    409,
  );
  assert.equal((await row("sessao_acesso_consulta", id)).estado, "DOOR_CLOSED");
});
test("nova credencial não assume sessão vinculada à credencial original", async () => {
  const s = await fixture(),
    id = await session(s),
    token = randomBytes(32).toString("hex");
  await create("/credenciais", {
    usuario_id: f.admin,
    tipo: "api",
    token,
    expira_em: new Date(Date.now() + 86400000).toISOString(),
  });
  assert.equal(
    (
      await post(
        `/terminal/acesso/sessoes/${id}/eventos`,
        eventBody("DOOR_AUTHORIZED"),
        s.device,
        randomUUID(),
        token,
      )
    ).statusCode,
    403,
  );
});

test("autenticação curta expirada não abre acesso; desativação do dispositivo bloqueia evento", async () => {
  const s = await fixture(),
    c = await challenge(s.device);
  const body = {
    ...c.body,
    evidencia: simulator.sign({
      ...c.claims,
      expira_em: new Date(Date.now() + 750).toISOString(),
    }),
  };
  const auth = await create("/terminal/acesso/autenticacoes", body, s.device);
  await new Promise((resolve) => setTimeout(resolve, 800));
  assert.equal(
    (
      await post(
        "/terminal/acesso/sessoes",
        {
          ...common(),
          autenticacao_id: auth,
          sensivel: false,
          ordens: [s.order],
        },
        s.device,
      )
    ).statusCode,
    409,
  );
  const id = await session(s);
  await admin.query("UPDATE hvb.dispositivo SET ativo=false WHERE id=$1", [
    s.device,
  ]);
  assert.equal(
    (
      await post(
        `/terminal/acesso/sessoes/${id}/eventos`,
        eventBody("DOOR_AUTHORIZED"),
        s.device,
      )
    ).statusCode,
    403,
  );
});

test("consultas tipadas, filtros, auditoria e outbox preservam evidência sem expor assinatura", async () => {
  const s = await fixture(),
    id = await session(s);
  const lists = [
    ["/retiradas/ordens", `&id=${s.order}`],
    ["/retiradas/itens", `&ordem_id=${s.order}`],
    ["/retiradas/eventos", `&ordem_id=${s.order}`],
    ["/terminal/acesso/sessoes", `&id=${id}`],
    ["/terminal/acesso/vinculos", `&sessao_id=${id}`],
    ["/terminal/acesso/desafios", `&dispositivo_id=${s.device}`],
    ["/terminal/acesso/autenticacoes", `&dispositivo_id=${s.device}`],
  ];
  for (const [path, q] of lists) {
    const r = await get(path ?? "", q);
    assert.equal(r.statusCode, 200, r.body);
    assert.ok(r.json().items.length > 0);
    assert.doesNotMatch(r.body, /hash_atestacao|evidencia":|token_hash/);
  }
  const sc = await row("sessao_acesso", id);
  const evidence = await admin.query(
    "SELECT (SELECT count(*)::int FROM hvb.evento_auditoria WHERE comando_id=$1) audit,(SELECT count(*)::int FROM hvb.outbox WHERE comando_id=$1) outbox",
    [sc.comando_id],
  );
  assert.deepEqual(evidence.rows[0], { audit: 1, outbox: 1 });
  assert.ok(
    (
      await admin.query(
        "SELECT 1 FROM hvb.leitura_auditada WHERE organizacao_id=$1 AND rota='/v1/terminal/acesso/sessoes'",
        [f.org],
      )
    ).rowCount,
  );
});
