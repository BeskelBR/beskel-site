import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { scheduleScenario } from "../scripts/schedule-scenario.ts";
import { scheduleLists } from "../src/domain/schedule/service.ts";
import { command } from "../src/domain/core.ts";
let app: FastifyInstance,
  db: pg.Pool,
  admin: pg.Pool,
  f: Awaited<ReturnType<typeof seedFixture>>,
  foreign: typeof f;
type Scenario = Awaited<ReturnType<typeof scheduleScenario>>;
const common = () => ({
  unidade_id: f.unit,
  motivo: "Teste fictício agenda",
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
    url: `/v1/agenda/${path}`,
    headers: { authorization: `Bearer ${token}`, "idempotency-key": key },
    payload: { ...common(), ...body },
  });
async function create(path: string, body: Record<string, unknown>) {
  const r = await post(path, body);
  assert.equal(r.statusCode, 200, r.body);
  return r.json();
}
const scenario = () => scheduleScenario(app, f.adminToken, f.unit);
const get = (path: string, query = "", token = f.adminToken) =>
  app.inject({
    url: `/v1/agenda/${path}?unidade_id=${f.unit}&${query}`,
    headers: { authorization: `Bearer ${token}` },
  });
const interval = (start: number, end: number) => ({
  inicio: `2026-09-01T${String(start).padStart(2, "0")}:00:00Z`,
  fim: `2026-09-01T${String(end).padStart(2, "0")}:00:00Z`,
});
const booking = (s: Scenario, start = 12, end = 13) => ({
  ...s.body,
  referencia: randomUUID(),
  ...interval(start, end),
});
const change = (s: Scenario, start = 12, end = 13) => ({
  agendamento_id: s.appointment,
  versao_esperada: 1,
  observacao: "Reprogramação fictícia",
  recursos: [s.resource],
  ...interval(start, end),
});
const transition = (
  s: Scenario,
  state: string,
  expected = "planejado",
  time = "2026-09-01T11:00:00Z",
) => ({
  agendamento_versao_id: s.appointmentVersion,
  estado: state,
  estado_esperado: expected,
  ocorrida_em: time,
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
test("recursos tipados preservam identidade e unidade", async () => {
  assert.equal(
    (await post("recursos", { nome: "Inválido", tipo: "profissional" }))
      .statusCode,
    409,
  );
  assert.equal(
    (
      await post("recursos", {
        nome: "Inválido",
        tipo: "institucional",
        usuario_id: f.admin,
      })
    ).statusCode,
    409,
  );
  await create("recursos", {
    nome: "Profissional fictício",
    tipo: "profissional",
    usuario_id: f.admin,
  });
  const team = await create("equipes", { nome: "Equipe fictícia" });
  await create("recursos", {
    nome: "Equipe",
    tipo: "equipe",
    equipe_id: team.id,
  });
  assert.equal(
    (
      await post("recursos", {
        unidade_id: f.otherUnit,
        nome: "Outra unidade",
        tipo: "equipe",
        equipe_id: team.id,
      })
    ).statusCode,
    409,
  );
});
test("disponibilidade explícita, bloqueio e fronteiras sem sobreposição", async () => {
  const s = await scenario();
  assert.equal((await post("agendamentos", booking(s, 7, 8))).statusCode, 409);
  await create("disponibilidades", {
    recurso_id: s.resource,
    tipo: "bloqueio",
    ...interval(13, 14),
  });
  await create("agendamentos", booking(s, 12, 13));
  assert.equal(
    (await post("agendamentos", booking(s, 13, 14))).statusCode,
    409,
  );
  await create("agendamentos", booking(s, 14, 15));
  assert.equal(
    (await post("agendamentos", booking(s, 15, 15))).statusCode,
    409,
  );
});
test("concorrência reserva uma única vez e falha multirrecurso é atômica", async () => {
  const s = await scenario();
  const results = await Promise.all([
    post("agendamentos", booking(s)),
    post("agendamentos", booking(s)),
  ]);
  assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
  const res = await create("recursos", {
    nome: "Sem disponibilidade",
    tipo: "institucional",
  });
  const b = { ...booking(s, 14, 15), recursos: [s.resource, res.id] };
  assert.equal((await post("agendamentos", b)).statusCode, 409);
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.agendamento WHERE referencia=$1",
        [b.referencia],
      )
    ).rows[0].n,
    0,
  );
  await create("agendamentos", booking(s, 14, 15));
  await create("disponibilidades", {
    recurso_id: res.id,
    tipo: "disponivel",
    ...interval(8, 18),
  });
  const opposite = await Promise.all([
    post("agendamentos", {
      ...booking(s, 16, 17),
      recursos: [s.resource, res.id],
    }),
    post("agendamentos", {
      ...booking(s, 16, 17),
      recursos: [res.id, s.resource],
    }),
  ]);
  assert.deepEqual(opposite.map((r) => r.statusCode).sort(), [200, 409]);
});
test("retry concorrente tem efeito único e referência não duplica", async () => {
  const s = await scenario(),
    key = randomUUID(),
    b = booking(s);
  const rs = await Promise.all([
    post("agendamentos", b, key),
    post("agendamentos", b, key),
  ]);
  for (const r of rs) assert.equal(r.statusCode, 200, r.body);
  assert.equal(rs[0]?.json().id, rs[1]?.json().id);
  assert.equal((await post("agendamentos", b)).statusCode, 409);
});
test("reprogramação preserva histórico, reinicia confirmação e libera horário anterior", async () => {
  const s = await scenario();
  await create("transicoes", transition(s, "confirmado"));
  const v = await create("versoes", change(s));
  assert.equal(v.versao, 2);
  const rows = (await get("versoes", `agendamento_id=${s.appointment}`)).json()
    .items;
  assert.equal(rows.length, 2);
  assert.equal(
    rows.find((r: { id: string }) => r.id === s.appointmentVersion).atual,
    false,
  );
  assert.equal(
    rows.find((r: { id: string }) => r.id === v.id).situacao,
    "planejado",
  );
  await create("agendamentos", booking(s, 10, 11));
  assert.equal(
    (await post("transicoes", transition(s, "chegou", "confirmado")))
      .statusCode,
    409,
  );
});
test("versão esperada serializa correções e conflito preserva reserva atual", async () => {
  const s = await scenario();
  await create("agendamentos", booking(s));
  assert.equal((await post("versoes", change(s))).statusCode, 409);
  assert.equal(
    (await post("agendamentos", booking(s, 10, 11))).statusCode,
    409,
  );
  const rs = await Promise.all([
    post("versoes", change(s, 14, 15)),
    post("versoes", change(s, 16, 17)),
  ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
});
test("revogação sinaliza revisão sem liberar reserva e reprogramação resolve", async () => {
  const s = await scenario();
  await create("revogacoes", { disponibilidade_id: s.availability });
  const q = `inicio=2026-09-01T08:00:00Z&fim=2026-09-01T18:00:00Z&paciente_id=${s.patient}`;
  assert.equal((await get("mapa", q)).json().items[0].necessita_revisao, true);
  assert.equal(
    (await post("transicoes", transition(s, "confirmado"))).statusCode,
    409,
  );
  await create("disponibilidades", {
    recurso_id: s.resource,
    tipo: "disponivel",
    ...interval(8, 18),
  });
  assert.equal(
    (await post("agendamentos", booking(s, 10, 11))).statusCode,
    409,
  );
  const block = await create("disponibilidades", {
    recurso_id: s.resource,
    tipo: "bloqueio",
    ...interval(10, 11),
  });
  await create("versoes", change(s));
  assert.equal((await get("mapa", q)).json().items[0].necessita_revisao, false);
  await create("revogacoes", { disponibilidade_id: block.id });
  await create("agendamentos", booking(s, 10, 11));
});
test("estados operacionais exigem sequência e não criam execução ou cobrança", async () => {
  const s = await scenario();
  assert.equal(
    (await post("transicoes", transition(s, "concluido"))).statusCode,
    409,
  );
  assert.equal(
    (
      await post(
        "transicoes",
        transition(s, "nao_compareceu", "planejado", "2026-09-01T10:59:59Z"),
      )
    ).statusCode,
    409,
  );
  await create(
    "transicoes",
    transition(s, "chegou", "planejado", "2026-09-01T10:00:00Z"),
  );
  assert.equal(
    (await post("transicoes", transition(s, "confirmado"))).statusCode,
    409,
  );
  await create("transicoes", transition(s, "concluido", "chegou"));
  assert.equal((await post("versoes", change(s))).statusCode, 409);
  await create("agendamentos", booking(s, 10, 11));
  for (const table of ["execucao", "item_conta"]) {
    const r = await admin.query(
      `SELECT count(*)::int n FROM hvb.${table} WHERE organizacao_id=$1`,
      [f.org],
    );
    assert.equal(r.rows[0].n, 0);
  }
});
test("cancelamento e ausência liberam recursos, futuro não prova ocorrência", async () => {
  const s = await scenario();
  assert.equal(
    (
      await post(
        "transicoes",
        transition(s, "cancelado", "planejado", "2099-01-01T00:00:00Z"),
      )
    ).statusCode,
    409,
  );
  await create("transicoes", transition(s, "cancelado"));
  const next = await create("agendamentos", booking(s, 10, 11));
  await create("transicoes", {
    ...transition(s, "nao_compareceu"),
    agendamento_versao_id: next.agendamento_versao_id,
  });
  await create("agendamentos", booking(s, 10, 11));
});
test("mapa limitado usa interseção, fuso, recurso e versão atual", async () => {
  const s = await scenario();
  assert.equal((await get("mapa")).statusCode, 400);
  assert.equal(
    (await get("mapa", "inicio=2026-09-01T00:00:00Z&fim=2026-09-09T00:00:00Z"))
      .statusCode,
    400,
  );
  const q = `inicio=2026-09-01T07:30:00-03:00&fim=2026-09-01T08:30:00-03:00&recurso_id=${s.resource}&paciente_id=${s.patient}`;
  assert.equal((await get("mapa", q)).json().items.length, 1);
  assert.equal(
    (
      await get(
        "mapa",
        `inicio=2026-09-01T11:00:00Z&fim=2026-09-01T12:00:00Z&recurso_id=${s.resource}`,
      )
    ).json().items.length,
    0,
  );
  for (const list of scheduleLists) {
    const r = await get(
      list.path.replace("/agenda/", ""),
      list.path === "/agenda/mapa" ? q : "",
    );
    assert.equal(r.statusCode, 200, r.body);
  }
});
test("RBAC, unidade e RLS isolam agenda", async () => {
  const s = await scenario();
  assert.equal((await get("agendamentos", "", f.readerToken)).statusCode, 403);
  assert.equal(
    (await post("agendamentos", booking(s), randomUUID(), f.readerToken))
      .statusCode,
    403,
  );
  assert.equal(
    (await post("agendamentos", { ...booking(s), unidade_id: f.otherUnit }))
      .statusCode,
    409,
  );
  assert.equal(
    (await post("agendamentos", booking(s), randomUUID(), foreign.adminToken))
      .statusCode,
    409,
  );
  await transaction(db, foreign.org, async (tx) => {
    assert.equal(
      (
        await tx.query("SELECT count(*)::int n FROM agendamento WHERE id=$1", [
          s.appointment,
        ])
      ).rows[0].n,
      0,
    );
  });
});
test("histórico SQL é imutável e não aceita reutilizar comando concluído", async () => {
  const s = await scenario();
  await assert.rejects(
    admin.query(
      "UPDATE hvb.agendamento_versao SET observacao='alterado' WHERE id=$1",
      [s.appointmentVersion],
    ),
    /imut|append|alter|permit/i,
  );
  await assert.rejects(
    admin.query(
      "INSERT INTO hvb.agendamento_recurso(id,organizacao_id,unidade_id,agendamento_versao_id,recurso_id,autor_id,comando_id,motivo,criada_em) SELECT gen_random_uuid(),organizacao_id,unidade_id,agendamento_versao_id,recurso_id,autor_id,comando_id,motivo,criada_em FROM hvb.agendamento_recurso WHERE agendamento_versao_id=$1",
      [s.appointmentVersion],
    ),
    /Comando de exame ausente ou concluido/,
  );
  for (const empty of ["header", "resources"]) {
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
          "teste.agenda",
          {},
          undefined,
          randomUUID(),
          async (cmd) => {
            const id = randomUUID();
            if (empty === "header")
              await tx.query(
                "INSERT INTO agendamento(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,paciente_id,responsavel_id,tipo,referencia) VALUES($1,$2,$3,$4,$5,'teste',$6,$7,'consulta',$8)",
                [
                  id,
                  f.org,
                  f.unit,
                  f.admin,
                  cmd,
                  s.patient,
                  s.responsible,
                  randomUUID(),
                ],
              );
            else
              await tx.query(
                "INSERT INTO agendamento_versao(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,agendamento_id,versao,anterior_id,inicio,fim,observacao) VALUES($1,$2,$3,$4,$5,'teste',$6,2,$7,'2026-09-01T12:00:00Z','2026-09-01T13:00:00Z','teste')",
                [
                  id,
                  f.org,
                  f.unit,
                  f.admin,
                  cmd,
                  s.appointment,
                  s.appointmentVersion,
                ],
              );
            return { id };
          },
        ),
      ),
      empty === "header"
        ? /Agendamento sem versao inicial atomica/
        : /Versao sem recursos/,
    );
  }
});
