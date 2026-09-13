import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { claim, deliverLocal, fail, runBatch } from "../src/worker/outbox.ts";
import { lists } from "../src/domain/foundation.ts";

let app: FastifyInstance, db: pg.Pool, admin: pg.Pool, worker: pg.Pool;
let f: Awaited<ReturnType<typeof seedFixture>>, foreign: typeof f;
const ago = (minutes = 5) =>
  new Date(Date.now() - minutes * 60000).toISOString();
async function post(
  path: string,
  body: unknown,
  key = randomUUID(),
  token = f.adminToken,
  device?: string,
) {
  return app.inject({
    method: "POST",
    url: `/v1${path}`,
    payload: body as Record<string, unknown>,
    headers: {
      authorization: `Bearer ${token}`,
      "idempotency-key": key,
      ...(device ? { "x-device-id": device } : {}),
    },
  });
}
async function create(path: string, body: unknown, token = f.adminToken) {
  const r = await post(path, body, randomUUID(), token);
  assert.equal(r.statusCode, 200, r.body);
  return r.json().id as string;
}
async function patient() {
  return create("/pacientes", {
    nome: "Paciente Fictício",
    especie_codigo: "canina",
    estado_vital: "desconhecido",
  });
}
async function episode(unit = f.unit) {
  return create("/episodios", {
    paciente_id: await patient(),
    unidade_id: unit,
    tipo: "internacao",
    admitido_em: ago(60),
  });
}
before(async () => {
  const url = process.env.TEST_MIGRATION_DATABASE_URL ?? "";
  assert.equal(
    new URL(url).pathname,
    "/hvb_sistema_test",
    "Integração exige banco TEST separado.",
  );
  await migrate(url);
  await migrate(url);
  admin = pool(url, 2);
  db = pool(process.env.TEST_DATABASE_URL ?? "", 5);
  worker = pool(process.env.TEST_WORKER_DATABASE_URL ?? "", 3);
  f = await seedFixture(url);
  foreign = await seedFixture(url);
  app = await buildApp(db);
});
after(async () => {
  await app?.close();
  await Promise.all([db?.end(), admin?.end(), worker?.end()]);
});

test("todas as consultas publicadas serializam conforme contrato sem SELECT irrestrito", async () => {
  for (const list of lists) {
    const route = `/v1${list.path}?limit=1${list.unit ? `&unidade_id=${f.unit}` : ""}`;
    const r = await app.inject({
      url: route,
      headers: { authorization: `Bearer ${f.adminToken}` },
    });
    assert.equal(r.statusCode, 200, `${route}: ${r.body}`);
    assert.ok(Array.isArray(r.json().items));
  }
});

test("retry transacional desfaz tentativa anterior e respeita limite de três tentativas", async () => {
  let attempts = 0;
  const id = randomUUID();
  await transaction(db, f.org, async (tx) => {
    attempts++;
    await tx.query(
      "INSERT INTO responsavel(id,organizacao_id,nome) VALUES($1,$2,'Fictício Retry')",
      [id, f.org],
    );
    if (attempts === 1)
      await tx.query(
        "DO $$ BEGIN RAISE EXCEPTION 'retry ficticio' USING ERRCODE='40001'; END $$",
      );
  });
  assert.equal(attempts, 2);
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int AS n FROM hvb.responsavel WHERE id=$1",
        [id],
      )
    ).rows[0].n,
    1,
  );
  attempts = 0;
  await assert.rejects(
    () =>
      transaction(db, f.org, async (tx) => {
        attempts++;
        await tx.query(
          "DO $$ BEGIN RAISE EXCEPTION 'retry ficticio' USING ERRCODE='40001'; END $$",
        );
      }),
    { code: "40001" },
  );
  assert.equal(attempts, 3);
});

test("health, readiness, organização, contrato OpenAPI e autenticação", async () => {
  assert.equal((await app.inject("/health")).statusCode, 200);
  assert.equal((await app.inject("/ready")).statusCode, 200);
  assert.equal((await app.inject("/v1/me")).statusCode, 401);
  const r = await app.inject({
    url: "/v1/me",
    headers: { authorization: `Bearer ${f.adminToken}` },
  });
  assert.equal(r.json().organizacao_id, f.org);
  const org = await app.inject({
    url: "/v1/organizacao",
    headers: { authorization: `Bearer ${f.adminToken}` },
  });
  assert.equal(org.json().id, f.org);
  const contract = app.swagger().paths;
  assert.ok(contract?.["/v1/episodios/{id}/alta"]?.post);
  assert.ok(contract?.["/v1/ocupacoes"]?.post);
  assert.ok(contract?.["/v1/credenciais/{id}/revogar"]?.post);
});
test("cadastro, vínculo, papéis, dispositivo e proveniência sintética executáveis", async () => {
  const p = await patient();
  const r = await create("/responsaveis", { nome: "Responsável Fictício" });
  const link = await create("/vinculos", {
    paciente_id: p,
    responsavel_id: r,
    papel: "legal",
    inicio: ago(20),
  });
  assert.equal(
    (
      await post(`/vinculos/${link}/encerrar`, {
        fim: ago(10),
        motivo: "Vigência fictícia encerrada",
      })
    ).statusCode,
    200,
  );
  await create("/unidades", {
    nome: "Unidade Fictícia C",
    fuso: "America/Sao_Paulo",
  });
  const u = await create("/usuarios", {
    nome: "Pessoa Fictícia Nova",
    login: `teste.${randomBytes(4).toString("hex")}`,
  });
  const role = await create("/papeis", {
    nome: `Consulta ${randomUUID()}`,
    permissoes: ["cadastros:ler"],
  });
  await create("/atribuicoes", { usuario_id: u, papel_id: role });
  await create("/dispositivos", {
    nome: "Terminal Fictício",
    unidade_id: f.unit,
  });
  const batch = await create("/lotes-importacao", { origem: "sintetico-dev" });
  await create("/ids-externos", {
    lote_importacao_id: batch,
    entidade: "paciente",
    entidade_id: p,
    codigo_externo: "FICTICIO-001",
    qualidade: "pendente",
  });
  assert.equal(
    (await post("/lotes-importacao", { origem: "legado-real" })).statusCode,
    400,
  );
});
test("oito comandos concorrentes e retry após resposta perdida produzem um único efeito", async () => {
  const key = randomUUID(),
    body = {
      nome: "Repetição Fictícia",
      especie_codigo: "felina",
      estado_vital: "vivo",
    };
  const responses = await Promise.all(
    Array.from({ length: 8 }, () => post("/pacientes", body, key)),
  );
  for (const r of responses) assert.equal(r.statusCode, 200, r.body);
  assert.equal(new Set(responses.map((r) => r.json().id)).size, 1);
  assert.equal(responses.filter((r) => !r.json().repetido).length, 1);
  const retry = await post(
    "/pacientes",
    {
      estado_vital: "vivo",
      especie_codigo: "felina",
      nome: "Repetição Fictícia",
    },
    key,
  );
  assert.equal(retry.json().repetido, true);
  const cmd = retry.json().comando_id;
  for (const table of ["evento_auditoria", "outbox"]) {
    assert.equal(
      (
        await admin.query(
          `SELECT count(*)::int AS n FROM hvb.${table} WHERE comando_id=$1`,
          [cmd],
        )
      ).rows[0].n,
      1,
    );
  }
  assert.equal(
    (await post("/pacientes", { ...body, nome: "Outro Fictício" }, key))
      .statusCode,
    409,
  );
  assert.equal(
    (await post("/responsaveis", { nome: "Outro Fictício" }, key)).statusCode,
    409,
  );
});
test("falha de integridade reverte comando, domínio, auditoria e outbox", async () => {
  const key = randomUUID();
  const r = await post(
    "/episodios",
    {
      paciente_id: randomUUID(),
      unidade_id: f.unit,
      tipo: "internacao",
      admitido_em: ago(),
    },
    key,
  );
  assert.equal(r.statusCode, 409, r.body);
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int AS n FROM hvb.comando WHERE chave=$1",
        [key],
      )
    ).rows[0].n,
    0,
  );
});
test("FK composta e RLS bloqueiam outra organização; contexto não vaza no pool", async () => {
  const foreignPatient = await create(
    "/pacientes",
    {
      nome: "Paciente Fictício Organização B",
      especie_codigo: "outra",
      estado_vital: "desconhecido",
    },
    foreign.adminToken,
  );
  assert.equal(
    (
      await post("/episodios", {
        paciente_id: foreignPatient,
        unidade_id: f.unit,
        tipo: "atendimento",
        admitido_em: ago(),
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM hvb.paciente")).rows[0].n,
    0,
  );
  await assert.rejects(
    () =>
      transaction(db, f.org, async (tx) => {
        assert.equal(
          (
            await tx.query("SELECT id FROM paciente WHERE id=$1", [
              foreignPatient,
            ])
          ).rowCount,
          0,
        );
        await tx.query(
          "INSERT INTO paciente(id,organizacao_id,nome,especie_codigo) VALUES($1,$2,$3,$4)",
          [randomUUID(), foreign.org, "Fictício", "canina"],
        );
      }),
    { code: "42501" },
  );
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM hvb.paciente")).rows[0].n,
    0,
  );
});
test("RBAC nega escrita ao leitor e ABAC restringe unidade/dispositivo no servidor", async () => {
  assert.equal(
    (
      await post(
        "/pacientes",
        { nome: "Fictício", especie_codigo: "canina", estado_vital: "vivo" },
        randomUUID(),
        f.readerToken,
      )
    ).statusCode,
    403,
  );
  const p = await patient();
  const b = {
    paciente_id: p,
    unidade_id: f.unit,
    tipo: "atendimento",
    admitido_em: ago(),
  };
  assert.equal(
    (await post("/episodios", b, randomUUID(), f.nurseToken)).statusCode,
    200,
  );
  assert.equal(
    (
      await post(
        "/episodios",
        { ...b, unidade_id: f.otherUnit },
        randomUUID(),
        f.nurseToken,
      )
    ).statusCode,
    403,
  );
  const device = await create("/dispositivos", {
    nome: "Dispositivo Outra Unidade",
    unidade_id: f.otherUnit,
  });
  assert.equal(
    (await post("/episodios", b, randomUUID(), f.adminToken, device))
      .statusCode,
    403,
  );
  const list = await app.inject({
    url: `/v1/episodios?unidade_id=${f.otherUnit}`,
    headers: { authorization: `Bearer ${f.nurseToken}` },
  });
  assert.equal(list.statusCode, 403);
});
test("credencial opaca, expirada, NFC e revogada; desativação de usuário/dispositivo", async () => {
  const user = await create("/usuarios", {
    nome: "Pessoa Fictícia Revogação",
    login: `revoga.${randomBytes(4).toString("hex")}`,
  });
  const token = randomBytes(32).toString("hex"),
    nfc = randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 3600000).toISOString();
  const id = await create("/credenciais", {
    usuario_id: user,
    tipo: "api",
    token,
    expira_em: expiry,
  });
  await create("/credenciais", {
    usuario_id: user,
    tipo: "nfc",
    token: nfc,
    expira_em: expiry,
  });
  assert.equal(
    (
      await app.inject({
        url: "/v1/me",
        headers: { authorization: `Bearer ${nfc}` },
      })
    ).statusCode,
    401,
  );
  assert.equal(
    (
      await app.inject({
        url: "/v1/me",
        headers: { authorization: `Bearer ${token}` },
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await post(`/credenciais/${id}/revogar`, {
        motivo: "Teste fictício de revogação",
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await app.inject({
        url: "/v1/me",
        headers: { authorization: `Bearer ${token}` },
      })
    ).statusCode,
    401,
  );
  const token2 = randomBytes(32).toString("hex");
  const id2 = await create("/credenciais", {
    usuario_id: user,
    tipo: "api",
    token: token2,
    expira_em: expiry,
  });
  await admin.query(
    "UPDATE hvb.credencial SET criada_em=now()-interval '2 hours',expira_em=now()-interval '1 hour' WHERE id=$1",
    [id2],
  );
  assert.equal(
    (
      await app.inject({
        url: "/v1/me",
        headers: { authorization: `Bearer ${token2}` },
      })
    ).statusCode,
    401,
  );
  const token3 = randomBytes(32).toString("hex");
  await create("/credenciais", {
    usuario_id: user,
    tipo: "api",
    token: token3,
    expira_em: expiry,
  });
  await post(`/usuarios/${user}/desativar`, { motivo: "Teste fictício" });
  assert.equal(
    (
      await app.inject({
        url: "/v1/me",
        headers: { authorization: `Bearer ${token3}` },
      })
    ).statusCode,
    401,
  );
  const device = await create("/dispositivos", {
    nome: "Dispositivo Inativo Fictício",
    unidade_id: f.unit,
  });
  await post(`/dispositivos/${device}/desativar`, { motivo: "Teste fictício" });
  assert.equal(
    (
      await post(
        "/responsaveis",
        { nome: "Fictício" },
        randomUUID(),
        f.adminToken,
        device,
      )
    ).statusCode,
    403,
  );
  const credentials = await app.inject({
    url: "/v1/credenciais",
    headers: { authorization: `Bearer ${f.adminToken}` },
  });
  assert.ok(!credentials.body.includes("token_hash"));
  assert.ok(!credentials.body.includes(token));
});
test("capacidade por vaga, concorrência, intervalo e consistência de unidade", async () => {
  const [e1, e2, e3] = await Promise.all([episode(), episode(), episode()]);
  const local = await create("/locais", {
    nome: "Box Fictício Duplo",
    unidade_id: f.unit,
    tipo: "box",
    capacidade: 2,
  });
  const start = ago(30);
  const races = await Promise.all(
    [e1, e2].map((episodio_id) =>
      post("/ocupacoes", {
        episodio_id,
        local_id: local,
        vaga: 1,
        inicio: start,
      }),
    ),
  );
  assert.deepEqual(races.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal(
    (
      await post("/ocupacoes", {
        episodio_id: e3,
        local_id: local,
        vaga: 2,
        inicio: start,
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await post("/ocupacoes", {
        episodio_id: await episode(),
        local_id: local,
        vaga: 3,
        inicio: start,
      })
    ).statusCode,
    409,
  );
  const otherLocal = await create("/locais", {
    nome: "Box Fictício B",
    unidade_id: f.otherUnit,
    tipo: "box",
    capacidade: 1,
  });
  assert.equal(
    (
      await post("/ocupacoes", {
        episodio_id: await episode(),
        local_id: otherLocal,
        vaga: 1,
        inicio: start,
      })
    ).statusCode,
    409,
  );
  const occupied = races.find((r) => r.statusCode === 200)?.json().id;
  assert.equal(
    (
      await post(`/ocupacoes/${occupied}/encerrar`, {
        fim: ago(40),
        motivo: "Tempo inválido fictício",
      })
    ).statusCode,
    409,
  );
});
test("alta clínica separada da ocupação e saída, com versão esperada e histórico", async () => {
  const ep = await episode();
  const box = await create("/locais", {
    nome: "Box Alta Fictícia",
    unidade_id: f.unit,
    tipo: "box",
    capacidade: 1,
  });
  const oc = await create("/ocupacoes", {
    episodio_id: ep,
    local_id: box,
    vaga: 1,
    inicio: ago(30),
  });
  assert.equal(
    (
      await post(`/episodios/${ep}/alta`, {
        ocorrido_em: ago(20),
        motivo: "Alta fictícia",
        versao_esperada: 1,
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await post(`/episodios/${ep}/encerrar`, {
        ocorrido_em: ago(5),
        motivo: "Saída fictícia",
        versao_esperada: 1,
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await post(`/episodios/${ep}/encerrar`, {
        ocorrido_em: ago(5),
        motivo: "Saída fictícia",
        versao_esperada: 2,
      })
    ).statusCode,
    409,
  );
  await create(`/ocupacoes/${oc}/encerrar`, {
    fim: ago(10),
    motivo: "Saída do box fictícia",
  });
  assert.equal(
    (
      await post(`/episodios/${ep}/encerrar`, {
        ocorrido_em: ago(5),
        motivo: "Saída fictícia",
        versao_esperada: 2,
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await post("/ocupacoes", {
        episodio_id: ep,
        local_id: box,
        vaga: 1,
        inicio: ago(),
      })
    ).statusCode,
    409,
  );
  const row = (
    await admin.query(
      "SELECT alta_clinica_em,encerrado_em FROM hvb.episodio WHERE id=$1",
      [ep],
    )
  ).rows[0];
  assert.ok(row.alta_clinica_em < row.encerrado_em);
});
test("paginação keyset, limites, entradas desconhecidas e datas futuras", async () => {
  const headers = { authorization: `Bearer ${f.adminToken}` };
  const first = await app.inject({ url: "/v1/pacientes?limit=2", headers });
  assert.equal(first.statusCode, 200, first.body);
  assert.equal(first.json().items.length, 2);
  const second = await app.inject({
    url: `/v1/pacientes?limit=2&cursor=${first.json().next_cursor}`,
    headers,
  });
  assert.equal(second.statusCode, 200, second.body);
  assert.ok(
    !first
      .json()
      .items.some((a: { id: string }) =>
        second.json().items.some((b: { id: string }) => a.id === b.id),
      ),
  );
  for (const query of ["limit=101", "limit=0", "cursor=bad", "surpresa=true"])
    assert.equal(
      (await app.inject({ url: `/v1/pacientes?${query}`, headers })).statusCode,
      400,
    );
  assert.equal(
    (
      await post("/responsaveis", {
        nome: "Fictício",
        organizacao_id: foreign.org,
      })
    ).statusCode,
    400,
  );
  assert.equal((await post("/responsaveis", { nome: "  " })).statusCode, 400);
  assert.equal(
    (
      await post("/episodios", {
        paciente_id: await patient(),
        unidade_id: f.unit,
        tipo: "atendimento",
        admitido_em: new Date(Date.now() + 3600000).toISOString(),
      })
    ).statusCode,
    400,
  );
});
test("privilégios: app não altera auditoria, apaga cadastro, assume worker ou cria tabela", async () => {
  for (const sql of [
    "UPDATE evento_auditoria SET acao=acao",
    "DELETE FROM paciente",
    "CREATE TABLE hvb.invasao(id int)",
    "SELECT * FROM reservar_outbox(1,gen_random_uuid())",
  ]) {
    await assert.rejects(
      () => transaction(db, f.org, (tx) => tx.query(sql)),
      { code: "42501" },
      sql,
    );
  }
  const role = (
    await db.query(
      "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user",
    )
  ).rows[0];
  assert.equal(role.rolsuper, false);
  assert.equal(role.rolbypassrls, false);
  await assert.rejects(() =>
    admin.query(
      "UPDATE hvb.evento_auditoria SET acao=acao WHERE organizacao_id=$1",
      [f.org],
    ),
  );
});
test("workers concorrentes não reservam o mesmo job; inbox deduplica repetição", async () => {
  const [a, b] = await Promise.all([claim(worker, 10), claim(worker, 10)]);
  assert.equal(
    new Set([...a, ...b].map((j) => j.id)).size,
    a.length + b.length,
  );
  const job = a[0];
  assert.ok(job);
  assert.equal(await deliverLocal(worker, job), true);
  assert.equal(await deliverLocal(worker, job), false);
  const count = await admin.query(
    "SELECT count(*)::int AS n FROM hvb.inbox WHERE evento_id=$1",
    [job.id],
  );
  assert.equal(count.rows[0].n, 1);
  for (const j of [...a.slice(1), ...b]) await deliverLocal(worker, j);
});
test("lease expirada, fencing, backoff e erro permanente viram pendência", async () => {
  const jobs = await claim(worker, 1),
    job = jobs[0];
  assert.ok(job);
  await admin.query(
    "UPDATE hvb.outbox SET lease_ate=now()-interval '1 second',disponivel_em=now()-interval '1 day' WHERE id=$1",
    [job.id],
  );
  const replacement = (await claim(worker, 1))[0];
  assert.ok(replacement);
  assert.equal(replacement.id, job.id);
  assert.notEqual(replacement.lease_token, job.lease_token);
  assert.equal(await deliverLocal(worker, job), false);
  await fail(worker, replacement);
  const row = (
    await admin.query(
      "SELECT disponivel_em,lease_token FROM hvb.outbox WHERE id=$1",
      [job.id],
    )
  ).rows[0];
  assert.ok(row.disponivel_em > new Date());
  assert.equal(row.lease_token, null);
  await admin.query(
    "UPDATE hvb.outbox SET tentativas=5,lease_ate=now()-interval '1 second' WHERE id=$1",
    [job.id],
  );
  await runBatch(worker, 1);
  assert.ok(
    (
      await admin.query("SELECT pendente_em FROM hvb.outbox WHERE id=$1", [
        job.id,
      ])
    ).rows[0].pendente_em,
  );
});
