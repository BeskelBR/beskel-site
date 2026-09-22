import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { authorize, command } from "../src/domain/core.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
let app: FastifyInstance,
  db: pg.Pool,
  admin: pg.Pool,
  f: Awaited<ReturnType<typeof seedFixture>>,
  foreign: typeof f;
const post = (
  path: string,
  payload: Record<string, unknown>,
  token = f.adminToken,
  key = randomUUID(),
) =>
  app.inject({
    method: "POST",
    url: `/v1${path}`,
    headers: { authorization: `Bearer ${token}`, "idempotency-key": key },
    payload,
  });
const read = (path: string, token = f.adminToken) =>
  app.inject({
    url: `/v1${path}`,
    headers: { authorization: `Bearer ${token}` },
  });
const common = (versao_esperada = 0) => ({
  versao_esperada,
  motivo: "Correção fictícia",
  simulacao: true,
  confirmacao_humana: true,
});
async function create(path: string, b: Record<string, unknown>) {
  const r = await post(path, b);
  assert.equal(r.statusCode, 200, r.body);
  return r.json().id as string;
}
const patient = () =>
  create("/pacientes", {
    nome: "Paciente fictício",
    especie_codigo: "canina",
    estado_vital: "desconhecido",
  });
const patientData = {
  nome: "Paciente corrigido",
  especie_codigo: "felina",
  estado_vital: "vivo",
};
const revise = (
  path: string,
  dados: Record<string, unknown>,
  extra: Record<string, unknown> = {},
  token = f.adminToken,
  key = randomUUID(),
) => post(`${path}/revisoes`, { ...common(), dados, ...extra }, token, key);
async function bed() {
  const p = await patient(),
    e = await create("/episodios", {
      unidade_id: f.unit,
      paciente_id: p,
      tipo: "internacao",
      admitido_em: "2026-09-01T08:00:00Z",
    }),
    l = await create("/locais", {
      unidade_id: f.unit,
      nome: "Box fictício",
      tipo: "box",
      capacidade: 2,
    });
  return { p, e, l };
}
const occupy = (s: Awaited<ReturnType<typeof bed>>) =>
  post("/ocupacoes", {
    episodio_id: s.e,
    local_id: s.l,
    vaga: 2,
    inicio: "2026-09-01T09:00:00Z",
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
test("paciente mantém ID, estado original e revisões encadeadas sem perder vínculos", async () => {
  const p = await patient(),
    e = await create("/episodios", {
      unidade_id: f.unit,
      paciente_id: p,
      tipo: "atendimento",
      admitido_em: "2026-09-01T08:00:00Z",
    });
  const initial = await read(`/pacientes/${p}/revisoes`);
  assert.equal(initial.json().versao, 0);
  assert.equal(initial.json().items.length, 0);
  const key = randomUUID(),
    r = await revise(`/pacientes/${p}`, patientData, {}, f.adminToken, key);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().versao, 1);
  assert.equal(
    (await revise(`/pacientes/${p}`, patientData, {}, f.adminToken, key)).json()
      .repetido,
    true,
  );
  const second = await revise(
    `/pacientes/${p}`,
    { ...patientData, nome: "Segundo nome fictício" },
    { versao_esperada: 1 },
  );
  assert.equal(second.statusCode, 200, second.body);
  const history = (await read(`/pacientes/${p}/revisoes`)).json();
  assert.equal(history.versao, 2);
  assert.equal(history.atual.nome, "Segundo nome fictício");
  assert.equal(history.items.length, 2);
  const first = history.items.find((x: { versao: number }) => x.versao === 1);
  assert.equal(first.antes.nome, "Paciente fictício");
  assert.equal(first.depois.nome, patientData.nome);
  assert.equal(
    history.items.find((x: { versao: number }) => x.versao === 2).anterior_id,
    first.id,
  );
  assert.equal(
    (await admin.query("SELECT paciente_id FROM hvb.episodio WHERE id=$1", [e]))
      .rows[0].paciente_id,
    p,
  );
});
test("concorrência, alteração vazia e dados inválidos não deixam revisão parcial", async () => {
  const p = await patient(),
    rs = await Promise.all([
      revise(`/pacientes/${p}`, patientData),
      revise(`/pacientes/${p}`, {
        ...patientData,
        nome: "Concorrente fictício",
      }),
    ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  const h = (await read(`/pacientes/${p}/revisoes`)).json();
  assert.equal(
    (await revise(`/pacientes/${p}`, h.atual, { versao_esperada: 1 }))
      .statusCode,
    409,
  );
  assert.equal(
    (
      await revise(
        `/pacientes/${p}`,
        { ...patientData, especie_codigo: "inventada" },
        { versao_esperada: 1 },
      )
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await revise(
        `/pacientes/${p}`,
        { ...patientData, estado_vital: "desconhecido" },
        { versao_esperada: 1 },
      )
    ).statusCode,
    200,
  );
  assert.equal(
    (await read(`/pacientes/${p}/revisoes?limit=1`)).json().items.length,
    1,
  );
});
test("responsável, unidade, dispositivo e usuário recebem revisão sem mudar identidade ou credenciais", async () => {
  const responsible = await create("/responsaveis", {
      nome: "Responsável original",
    }),
    device = await create("/dispositivos", {
      nome: "Leitor original",
      unidade_id: f.unit,
    }),
    user = await create("/usuarios", {
      nome: "Pessoa original",
      login: `p.${randomBytes(5).toString("hex")}`,
    });
  const token = randomBytes(32).toString("hex");
  await create("/credenciais", {
    usuario_id: user,
    tipo: "api",
    token,
    expira_em: new Date(Date.now() + 3600000).toISOString(),
  });
  for (const [path, dados] of [
    [`/responsaveis/${responsible}`, { nome: "Responsável corrigido" }],
    [`/unidades/${f.unit}`, { nome: "Unidade corrigida" }],
    [`/dispositivos/${device}`, { nome: "Leitor corrigido" }],
    [
      `/usuarios/${user}`,
      {
        nome: "Pessoa corrigida",
        login: `nova.${randomBytes(5).toString("hex")}`,
      },
    ],
  ] as const) {
    const r = await revise(path, dados);
    assert.equal(r.statusCode, 200, r.body);
    assert.deepEqual((await read(`${path}/revisoes`)).json().atual, dados);
  }
  assert.equal((await read("/me", token)).json().usuario_id, user);
  assert.equal(
    (
      await revise(
        `/usuarios/${user}`,
        { nome: "Duplicado", login: "admin.dev" },
        { versao_esperada: 1 },
      )
    ).statusCode,
    409,
  );
  assert.equal((await read(`/usuarios/${user}/revisoes`)).json().versao, 1);
  assert.equal(
    (
      await admin.query("SELECT unidade_id FROM hvb.dispositivo WHERE id=$1", [
        device,
      ])
    ).rows[0].unidade_id,
    f.unit,
  );
});
test("capacidade protege maior vaga ocupada e permite reduzir após encerramento", async () => {
  const s = await bed(),
    o = await occupy(s);
  assert.equal(o.statusCode, 200, o.body);
  const extra = { unidade_id: f.unit };
  assert.equal(
    (
      await revise(
        `/locais/${s.l}`,
        { nome: "Box reduzido", capacidade: 1 },
        extra,
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (await read(`/locais/${s.l}/revisoes?unidade_id=${f.unit}`)).json().versao,
    0,
  );
  const end = await post(`/ocupacoes/${o.json().id}/encerrar`, {
    fim: "2026-09-01T10:00:00Z",
    motivo: "Saída fictícia",
  });
  assert.equal(end.statusCode, 200, end.body);
  assert.equal(
    (
      await revise(
        `/locais/${s.l}`,
        { nome: "Box reduzido", capacidade: 1 },
        extra,
      )
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await admin.query("SELECT vaga FROM hvb.ocupacao WHERE id=$1", [
        o.json().id,
      ])
    ).rows[0].vaga,
    2,
  );
  assert.equal(
    (
      await revise(
        `/locais/${s.l}`,
        { nome: "Box fechado", capacidade: 0 },
        { ...extra, versao_esperada: 1 },
      )
    ).statusCode,
    200,
  );
});
test("redução de capacidade concorrente com ocupação tem um vencedor coerente", async () => {
  const s = await bed(),
    rs = await Promise.all([
      occupy(s),
      revise(
        `/locais/${s.l}`,
        { nome: "Box reduzido", capacidade: 1 },
        { unidade_id: f.unit },
      ),
    ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  const state = (
    await admin.query(
      "SELECT l.capacidade,coalesce(max(o.vaga),0) vaga FROM hvb.local l LEFT JOIN hvb.ocupacao o ON o.local_id=l.id AND o.fim IS NULL WHERE l.id=$1 GROUP BY l.capacidade",
      [s.l],
    )
  ).rows[0];
  assert.ok(state.vaga <= state.capacidade);
});
test("permissões e unidades limitam leitura/escrita; trigger privilegiado não atravessa organização", async () => {
  const p = await patient(),
    s = await bed();
  assert.equal(
    (await revise(`/pacientes/${p}`, patientData, {}, f.readerToken))
      .statusCode,
    403,
  );
  assert.equal(
    (await read(`/pacientes/${p}/revisoes`, f.readerToken)).statusCode,
    200,
  );
  assert.equal(
    (await revise(`/pacientes/${p}`, patientData, {}, foreign.adminToken))
      .statusCode,
    404,
  );
  assert.equal(
    (
      await revise(
        `/locais/${s.l}`,
        { nome: "Fora", capacidade: 1 },
        { unidade_id: f.otherUnit },
      )
    ).statusCode,
    404,
  );
  assert.equal(
    (await read(`/locais/${s.l}/revisoes?unidade_id=${f.otherUnit}`))
      .statusCode,
    404,
  );
  await transaction(admin, f.org, (tx) =>
    tx.query(
      "INSERT INTO papel_permissao(organizacao_id,papel_id,permissao) VALUES($1,$2,'locais:retificar')",
      [f.org, f.nurseRole],
    ),
  );
  assert.equal(
    (
      await revise(
        `/locais/${s.l}`,
        { nome: "Box nome novo", capacidade: 2 },
        { unidade_id: f.unit },
        f.nurseToken,
      )
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await revise(
        `/locais/${s.l}`,
        { nome: "Fora", capacidade: 2 },
        { unidade_id: f.otherUnit },
        f.nurseToken,
      )
    ).statusCode,
    403,
  );
});
test("SQL direto não altera cadastro; revisão exige comando aberto e mantém história imutável", async () => {
  const p = await patient();
  await assert.rejects(
    () =>
      transaction(db, f.org, (tx) =>
        tx.query("UPDATE paciente SET nome='Sem trilha' WHERE id=$1", [p]),
      ),
    { code: "42501" },
  );
  const r = await revise(`/pacientes/${p}`, patientData);
  assert.equal(r.statusCode, 200, r.body);
  await assert.rejects(
    () =>
      admin.query("DELETE FROM hvb.revisao_cadastro WHERE id=$1", [
        r.json().id,
      ]),
    { code: "23514" },
  );
  await assert.rejects(
    () =>
      transaction(db, f.org, (tx) =>
        tx.query(
          "INSERT INTO revisao_cadastro(id,organizacao_id,autor_id,comando_id,motivo,tipo,alvo_id,paciente_id,versao,anterior_id,depois) VALUES($1,$2,$3,$4,'Comando concluído','paciente',$5,$5,2,$6,$7)",
          [
            randomUUID(),
            f.org,
            f.admin,
            r.json().comando_id,
            p,
            r.json().id,
            JSON.stringify({ ...patientData, nome: "Sem autorização" }),
          ],
        ),
      ),
    { code: "23514" },
  );
  assert.equal((await read(`/pacientes/${p}/revisoes`)).json().versao, 1);
});
test("falha após atualizar projeção desfaz cadastro, revisão e comando juntos", async () => {
  const p = await patient(),
    actor = {
      organizacao_id: f.org,
      usuario_id: f.admin,
      credencial_id: f.credential,
    };
  await assert.rejects(
    () =>
      transaction(db, f.org, (tx) =>
        command(
          tx,
          actor,
          randomUUID(),
          "rollback-c13",
          {},
          undefined,
          randomUUID(),
          async (cmd) => {
            await tx.query(
              "INSERT INTO revisao_cadastro(id,organizacao_id,autor_id,comando_id,motivo,tipo,alvo_id,paciente_id,versao,depois) VALUES($1,$2,$3,$4,'Rollback fictício','paciente',$5,$5,1,$6)",
              [
                randomUUID(),
                f.org,
                f.admin,
                cmd,
                p,
                JSON.stringify(patientData),
              ],
            );
            throw new Error("falha posterior");
          },
        ),
      ),
    /falha posterior/,
  );
  const h = (await read(`/pacientes/${p}/revisoes`)).json();
  assert.equal(h.versao, 0);
  assert.equal(h.atual.nome, "Paciente fictício");
});
async function assignment() {
  return (
    await admin.query(
      "SELECT id FROM hvb.usuario_papel WHERE organizacao_id=$1 AND usuario_id=$2 AND papel_id=$3",
      [f.org, f.nurse, f.nurseRole],
    )
  ).rows[0].id as string;
}
test("revogação e restauração de atribuição preservam origem e afetam autorização imediatamente", async () => {
  const id = await assignment(),
    path = `/atribuicoes/${id}/revisoes`,
    b = { ...common(), ativo: false },
    key = randomUUID();
  const r = await post(path, b, f.adminToken, key);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal((await post(path, b, f.adminToken, key)).json().repetido, true);
  assert.equal(
    (await read(`/episodios?unidade_id=${f.unit}`, f.nurseToken)).statusCode,
    403,
  );
  assert.equal((await read("/me", f.nurseToken)).statusCode, 200);
  const current = (await read(path)).json();
  assert.equal(current.ativo, false);
  assert.equal(current.versao, 1);
  const listed = (await read("/atribuicoes"))
    .json()
    .items.find((x: { id: string }) => x.id === id);
  assert.equal(listed.ativo, false);
  assert.equal(
    (await post(path, { ...common(1), ativo: true })).statusCode,
    200,
  );
  assert.equal(
    (await read(`/episodios?unidade_id=${f.unit}`, f.nurseToken)).statusCode,
    200,
  );
  const restored = (await read(path)).json();
  assert.equal(restored.items.length, 2);
  assert.equal(restored.papel_id, f.nurseRole);
  assert.equal(
    (await post(path, { ...common(2), ativo: "false" })).statusCode,
    400,
  );
});
test("revisões concorrentes de acesso admitem uma transição e negam administrador restrito", async () => {
  const id = await assignment(),
    path = `/atribuicoes/${id}/revisoes`,
    rs = await Promise.all([
      post(path, { ...common(2), ativo: false }),
      post(path, { ...common(2), ativo: false }),
    ]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal(
    (await post(path, { ...common(3), ativo: true }, f.readerToken)).statusCode,
    403,
  );
  assert.equal(
    (await post(path, { ...common(3), ativo: true }, foreign.adminToken))
      .statusCode,
    404,
  );
  assert.equal(
    (await post(path, { ...common(3), ativo: true })).statusCode,
    200,
  );
});
test("revogar aguarda transação já autorizada e bloqueia a seguinte", async () => {
  const id = await assignment(),
    tx = await db.connect();
  await tx.query("BEGIN");
  await tx.query("SELECT set_config('hvb.org',$1,true)", [f.org]);
  await authorize(
    tx,
    { organizacao_id: f.org, usuario_id: f.nurse, credencial_id: f.credential },
    "episodios:ler",
    f.unit,
  );
  const pending = post(`/atribuicoes/${id}/revisoes`, {
    ...common(4),
    ativo: false,
  });
  // Start the injection while the other connection holds the shared authorization lock.
  const running = Promise.resolve(pending);
  let waiting = false;
  try {
    for (let i = 0; i < 40; i++) {
      const r = await admin.query(
        "SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted) waiting",
      );
      if (r.rows[0].waiting) {
        waiting = true;
        break;
      }
      await setTimeout(15);
    }
    assert.equal(waiting, true);
  } finally {
    await tx.query("ROLLBACK");
    tx.release();
  }
  const result = await running;
  assert.equal(result.statusCode, 200, result.body);
  assert.equal(
    (await read(`/episodios?unidade_id=${f.unit}`, f.nurseToken)).statusCode,
    403,
  );
  assert.equal(
    (await post(`/atribuicoes/${id}/revisoes`, { ...common(5), ativo: true }))
      .statusCode,
    200,
  );
});
