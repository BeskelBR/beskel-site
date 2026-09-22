import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { digest } from "../src/domain/core.ts";
import { auditedTransaction } from "../src/domain/links-audit/read-audit.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { scheduleScenario } from "../scripts/schedule-scenario.ts";
import { medicalScenario } from "../scripts/medical-scenario.ts";
import { portalScenario } from "../scripts/portal-scenario.ts";
let app: FastifyInstance,
  db: pg.Pool,
  admin: pg.Pool,
  f: Awaited<ReturnType<typeof seedFixture>>,
  foreign: typeof f;
type Scenario = Awaited<ReturnType<typeof scheduleScenario>>;
const post = (
  path: string,
  body: Record<string, unknown>,
  token = f.adminToken,
  key = randomUUID(),
) =>
  app.inject({
    method: "POST",
    url: `/v1/agenda/${path}`,
    headers: { authorization: `Bearer ${token}`, "idempotency-key": key },
    payload: {
      unidade_id: f.unit,
      motivo: "Vínculo fictício",
      simulacao: true,
      confirmacao_humana: true,
      ...body,
    },
  });
const read = (url: string, token = f.adminToken) =>
  app.inject({ url, headers: { authorization: `Bearer ${token}` } });
const link = (s: Scenario) => ({
  agendamento_versao_id: s.appointmentVersion,
  episodio_id: s.episode,
  episodio_versao_esperada: 1,
});
const list = (s: Scenario) =>
  read(
    `/v1/agenda/vinculos-episodios?unidade_id=${f.unit}&agendamento_id=${s.appointment}`,
  );
const audit = async (correlation: unknown) =>
  (
    await admin.query(
      "SELECT * FROM hvb.leitura_auditada WHERE correlation_id=$1",
      [correlation],
    )
  ).rows;
const window = () =>
  `inicio=${encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}&fim=${encodeURIComponent(new Date(Date.now() + 86400000).toISOString())}`;
async function scenario() {
  const s = await scheduleScenario(app, f.adminToken, f.unit);
  const r = await post("transicoes", {
    agendamento_versao_id: s.appointmentVersion,
    estado_esperado: "planejado",
    estado: "chegou",
    ocorrida_em: "2026-09-01T10:00:00Z",
  });
  assert.equal(r.statusCode, 200, r.body);
  return s;
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
test("vínculo explícito preserva episódio e agenda, sem fabricar ato clínico", async () => {
  const s = await scenario(),
    key = randomUUID(),
    r = await post("vinculos-episodios", link(s), f.adminToken, key);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(
    (await post("vinculos-episodios", link(s), f.adminToken, key)).json().id,
    r.json().id,
  );
  const row = (await list(s)).json().items[0];
  assert.equal(row.episodio_id, s.episode);
  assert.equal(row.episodio_versao, 1);
  assert.equal(row.vigente, true);
  assert.equal(
    (
      await admin.query(
        "SELECT versao,alta_clinica_em FROM hvb.episodio WHERE id=$1",
        [s.episode],
      )
    ).rows[0].versao,
    1,
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
test("vínculo exige chegada, paciente/unidade corretos e versão esperada do episódio", async () => {
  const planned = await scheduleScenario(app, f.adminToken, f.unit);
  assert.equal(
    (await post("vinculos-episodios", link(planned))).statusCode,
    409,
  );
  const s = await scenario(),
    other = await scenario();
  for (const extra of [
    { episodio_id: other.episode },
    { unidade_id: f.otherUnit },
    { episodio_versao_esperada: 2 },
  ])
    assert.equal(
      (await post("vinculos-episodios", { ...link(s), ...extra })).statusCode,
      409,
    );
  assert.equal(
    (await post("vinculos-episodios", link(s), f.readerToken)).statusCode,
    403,
  );
  assert.equal(
    (
      await post(
        "vinculos-episodios",
        { ...link(s), unidade_id: foreign.unit },
        foreign.adminToken,
      )
    ).statusCode,
    409,
  );
});
test("concorrência permite um vínculo e correção preserva revogação antes de novo vínculo", async () => {
  const s = await scenario(),
    rs = await Promise.all([
      post("vinculos-episodios", link(s)),
      post("vinculos-episodios", link(s)),
    ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  const id = rs.find((r) => r.statusCode === 200)?.json().id;
  assert.equal(
    (await post("revogacoes-vinculos", { vinculo_id: id })).statusCode,
    200,
  );
  assert.equal(
    (await post("revogacoes-vinculos", { vinculo_id: id })).statusCode,
    409,
  );
  assert.equal((await post("vinculos-episodios", link(s))).statusCode, 200);
  const rows = (await list(s)).json().items;
  assert.equal(rows.length, 2);
  assert.equal(rows.filter((r: { vigente: boolean }) => r.vigente).length, 1);
  await assert.rejects(() =>
    admin.query("DELETE FROM hvb.vinculo_agendamento_episodio WHERE id=$1", [
      id,
    ]),
  );
});
test("cancelar depois do vínculo sinaliza revisão sem alterar episódio", async () => {
  const s = await scenario(),
    r = await post("vinculos-episodios", link(s));
  assert.equal(r.statusCode, 200, r.body);
  const cancel = await post("transicoes", {
    agendamento_versao_id: s.appointmentVersion,
    estado_esperado: "chegou",
    estado: "cancelado",
    ocorrida_em: "2026-09-01T11:00:00Z",
  });
  assert.equal(cancel.statusCode, 200, cancel.body);
  const row = (await list(s)).json().items[0];
  assert.equal(row.vigente, false);
  assert.equal(row.necessita_revisao, true);
  assert.equal(row.revogada, false);
  assert.equal((await post("vinculos-episodios", link(s))).statusCode, 409);
  assert.equal(
    (await post("revogacoes-vinculos", { vinculo_id: r.json().id })).statusCode,
    200,
  );
  assert.equal((await list(s)).json().items[0].necessita_revisao, false);
});
test("cancelamento concorrente não deixa vínculo vigente indevido", async () => {
  const s = await scenario();
  const [l, c] = await Promise.all([
    post("vinculos-episodios", link(s)),
    post("transicoes", {
      agendamento_versao_id: s.appointmentVersion,
      estado_esperado: "chegou",
      estado: "cancelado",
      ocorrida_em: "2026-09-01T11:00:00Z",
    }),
  ]);
  assert.equal(c.statusCode, 200, c.body);
  assert.ok([200, 409].includes(l.statusCode), l.body);
  assert.ok(
    (await list(s)).json().items.every((x: { vigente: boolean }) => !x.vigente),
  );
});
test("GET clínico grava identidade, rota-modelo e IDs sem texto nem token", async () => {
  const s = await medicalScenario(app, f.adminToken, f.unit),
    r = await read(
      `/v1/prontuario/versoes/${s.evolutionVersion}?unidade_id=${f.unit}`,
    );
  assert.equal(r.statusCode, 200, r.body);
  const rows = await audit(r.headers["x-correlation-id"]);
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.usuario_id, f.admin);
  assert.equal(row.credencial_id, f.credential);
  assert.equal(row.rota, "/v1/prontuario/versoes/:id");
  assert.equal(row.status_consulta, 200);
  assert.deepEqual(row.parametros, {
    id: s.evolutionVersion,
    unidade_id: f.unit,
  });
  const serialized = JSON.stringify(row);
  assert.equal(serialized.includes(s.body.conteudo), false);
  assert.equal(serialized.includes(f.adminToken), false);
  const query = "segredo_clinico_ficticio";
  const search = await read(
    `/v1/prontuario/busca?unidade_id=${f.unit}&paciente_id=${s.patient}&q=${query}`,
  );
  assert.equal(search.statusCode, 200, search.body);
  assert.equal(
    JSON.stringify(await audit(search.headers["x-correlation-id"])).includes(
      query,
    ),
    false,
  );
});
test("recusas autenticadas persistem 403/404, health e credencial desconhecida não criam identidade", async () => {
  const r = await read(
    `/v1/prontuario/versoes/${randomUUID()}?unidade_id=${f.unit}`,
    f.readerToken,
  );
  assert.equal(r.statusCode, 403);
  assert.equal(
    (await audit(r.headers["x-correlation-id"]))[0].status_consulta,
    403,
  );
  const absent = await read(
    `/v1/prontuario/versoes/${randomUUID()}?unidade_id=${f.unit}`,
  );
  assert.equal(absent.statusCode, 404);
  assert.equal(
    (await audit(absent.headers["x-correlation-id"]))[0].status_consulta,
    404,
  );
  for (const url of ["/health", "/ready"]) {
    const h = await app.inject({ url });
    assert.equal(h.statusCode, 200, h.body);
    assert.equal((await audit(h.headers["x-correlation-id"])).length, 0);
  }
  const invalid = await read("/v1/me", "0".repeat(64));
  assert.equal(invalid.statusCode, 401);
  assert.equal((await audit(invalid.headers["x-correlation-id"])).length, 0);
});
test("HEAD também deixa trilha e leitura da própria auditoria não recursa", async () => {
  const r = await app.inject({
    method: "HEAD",
    url: "/v1/me",
    headers: { authorization: `Bearer ${f.adminToken}` },
  });
  assert.equal(r.statusCode, 200);
  assert.equal(r.body, "");
  assert.equal((await audit(r.headers["x-correlation-id"]))[0].metodo, "HEAD");
  const query = await read(
    `/v1/auditoria/leituras?${window()}&correlation_id=${r.headers["x-correlation-id"]}`,
  );
  assert.equal(query.statusCode, 200, query.body);
  assert.equal(query.json().items.length, 1);
  assert.equal(query.json().items[0].credencial_id, undefined);
  assert.equal((await audit(query.headers["x-correlation-id"])).length, 1);
});
test("auditoria consultiva exige papel global, limita período e isola organização", async () => {
  await transaction(admin, f.org, (tx) =>
    tx.query(
      "INSERT INTO papel_permissao(organizacao_id,papel_id,permissao) VALUES($1,$2,'auditoria:leituras')",
      [f.org, f.nurseRole],
    ),
  );
  const url = `/v1/auditoria/leituras?${window()}`;
  assert.equal((await read(url, f.readerToken)).statusCode, 403);
  assert.equal(
    (await read(`${url}&unidade_id=${f.unit}`, f.nurseToken)).statusCode,
    403,
  );
  assert.equal(
    (
      await read(
        "/v1/auditoria/leituras?inicio=2026-01-01T00:00:00Z&fim=2027-01-01T00:00:00Z",
      )
    ).statusCode,
    400,
  );
  const event = await read("/v1/me");
  const alien = await read(
    `${url}&correlation_id=${event.headers["x-correlation-id"]}`,
    foreign.adminToken,
  );
  assert.equal(alien.statusCode, 200, alien.body);
  assert.equal(alien.json().items.length, 0);
  await transaction(db, foreign.org, async (tx) =>
    assert.equal(
      (
        await tx.query(
          "SELECT id FROM leitura_auditada WHERE correlation_id=$1",
          [event.headers["x-correlation-id"]],
        )
      ).rowCount,
      0,
    ),
  );
});
test("auditoria pagina conjunto isolado e mantém registros imutáveis", async () => {
  const user = randomUUID(),
    token = randomBytes(32).toString("hex");
  await admin.query(
    "INSERT INTO hvb.usuario(id,organizacao_id,nome,login) VALUES($1,$2,'Auditoria paginação fictícia',$3)",
    [user, f.org, `pagina.${user}`],
  );
  await admin.query(
    "INSERT INTO hvb.credencial(id,organizacao_id,usuario_id,tipo,token_hash,expira_em) VALUES($1,$2,$3,'api',$4,now()+interval '1 hour')",
    [randomUUID(), f.org, user, digest(token)],
  );
  for (let i = 0; i < 3; i++)
    assert.equal((await read("/v1/me", token)).statusCode, 200);
  const base = `/v1/auditoria/leituras?${window()}&usuario_id=${user}&limit=2`;
  const firstResponse = await read(base);
  assert.equal(firstResponse.statusCode, 200, firstResponse.body);
  const first = firstResponse.json();
  assert.ok(first.next_cursor);
  const secondResponse = await read(`${base}&cursor=${first.next_cursor}`);
  assert.equal(secondResponse.statusCode, 200, secondResponse.body);
  const second = secondResponse.json();
  assert.equal(first.items.length, 2);
  assert.equal(second.items.length, 1);
  assert.equal(second.next_cursor, null);
  assert.equal(
    new Set([...first.items, ...second.items].map((x) => x.id)).size,
    3,
  );
  await assert.rejects(() =>
    admin.query(
      "UPDATE hvb.leitura_auditada SET status_consulta=403 WHERE id=$1",
      [first.items[0].id],
    ),
  );
});
test("portal mantém identidade separada e audita caixa e mensagem indisponível", async () => {
  const s = await portalScenario(app, f.adminToken, f.unit),
    token = randomBytes(32).toString("hex"),
    credential = randomUUID();
  await admin.query(
    "INSERT INTO hvb.credencial_portal(id,organizacao_id,conta_portal_id,token_hash,expira_em) VALUES($1,$2,$3,$4,'2099-01-01T00:00:00Z')",
    [credential, f.org, s.account, digest(token)],
  );
  for (const [path, status] of [
    ["/v1/portal/caixa", 200],
    [`/v1/portal/mensagens/${randomUUID()}`, 404],
  ] as const) {
    const r = await read(path, token);
    assert.equal(r.statusCode, status, r.body);
    const row = (await audit(r.headers["x-correlation-id"]))[0];
    assert.equal(row.conta_portal_id, s.account);
    assert.equal(row.credencial_portal_id, credential);
    assert.equal(row.usuario_id, null);
    assert.equal(row.status_consulta, status);
    assert.equal(JSON.stringify(row).includes(token), false);
  }
});
test("falha ao persistir auditoria retém resultado e desfaz a transação", async () => {
  const broken = {
    connect: async () => {
      const tx = await db.connect();
      return {
        query: async (sql: string, values?: unknown[]) => {
          if (sql.startsWith("INSERT INTO leitura_auditada"))
            throw new Error("falha simulada");
          return tx.query(sql, values);
        },
        release: () => tx.release(),
      };
    },
  } as unknown as pg.Pool;
  const req = {
    method: "GET",
    query: {},
    params: {},
    id: randomUUID(),
    routeOptions: { url: "/v1/me" },
  } as FastifyRequest;
  const id = randomUUID();
  await assert.rejects(
    () =>
      auditedTransaction(
        broken,
        req,
        {
          organizacao_id: f.org,
          usuario_id: f.admin,
          credencial_id: f.credential,
        },
        async (tx) => {
          await tx.query(
            "INSERT INTO paciente(id,organizacao_id,nome,especie_codigo,estado_vital) VALUES($1,$2,'Teste rollback','canina','vivo')",
            [id, f.org],
          );
          return { conteudo: "não entregar" };
        },
      ),
    { statusCode: 503, code: "auditoria_indisponivel" },
  );
  assert.equal(
    (await admin.query("SELECT id FROM hvb.paciente WHERE id=$1", [id]))
      .rowCount,
    0,
  );
});
