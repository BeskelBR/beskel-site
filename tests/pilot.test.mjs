import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createPilotClient } from "../assets/pilot-api.js";
import { createFrontendServer } from "../scripts/frontend.mjs";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { seedFixture } from "../scripts/seed.ts";
import { loginWeb } from "./web-session-helper.mjs";

let fixture, db, app, server, client, base, patient, episode, session;
before(async () => {
  const url = process.env.TEST_MIGRATION_DATABASE_URL;
  assert.equal(new URL(url).pathname, "/hvb_sistema_test");
  fixture = await seedFixture(url);
  db = pool(process.env.TEST_DATABASE_URL, 3);
  app = await buildApp(db);
  await app.listen({ host: "127.0.0.1", port: 0 });
  server = createFrontendServer(
    `http://127.0.0.1:${app.server.address().port}`,
  );
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  base = `http://127.0.0.1:${server.address().port}`;
  session = await loginWeb(base, fixture.adminToken);
  client = createPilotClient({ base, fetcher: session.fetcher });
});
after(async () => {
  if (server)
    await new Promise((done) => {
      server.closeAllConnections();
      server.close(done);
    });
  await app?.close();
  await db?.end();
});
test("piloto: paciente, episódio, evolução e leitura protegida pelo proxy real", async () => {
  assert.equal((await client.read("/v1/me")).usuario_id, fixture.admin);
  const create = (path, body) => client.send(client.prepare(path, body));
  patient = (
    await create("/v1/pacientes", {
      nome: "Paciente fictício piloto",
      especie_codigo: "felina",
      estado_vital: "vivo",
    })
  ).id;
  assert.ok(
    (await client.read("/v1/pacientes?limit=100")).items.some(
      (p) => p.id === patient,
    ),
  );
  episode = (
    await create("/v1/episodios", {
      unidade_id: fixture.unit,
      paciente_id: patient,
      tipo: "atendimento",
      admitido_em: new Date().toISOString(),
    })
  ).id;
  const intent = client.prepare("/v1/prontuario/evolucoes", {
    unidade_id: fixture.unit,
    paciente_id: patient,
    episodio_id: episode,
    tipo: "evolucao",
    referencia: randomUUID(),
    ocorrida_em: new Date().toISOString(),
    conteudo: "Texto fictício completo. <script>texto</script>\nSegunda linha.",
    motivo: "Teste de piloto",
    simulacao: true,
    confirmacao_humana: true,
  });
  // Simulates loss of the receipt after the API has already committed.
  let dropped = false;
  const unreliable = createPilotClient({
    base,
    token: fixture.adminToken,
    fetcher: async (...args) => {
      const response = await session.fetcher(...args);
      if (!dropped) {
        dropped = true;
        await response.text();
        throw new TypeError("connection lost after commit");
      }
      return response;
    },
  });
  await assert.rejects(unreliable.send(intent), TypeError);
  const receipt = await unreliable.send(intent);
  assert.equal(receipt.repetido, true);
  const versions = await client.read(
    `/v1/prontuario/versoes?unidade_id=${fixture.unit}&episodio_id=${episode}&paciente_id=${patient}`,
  );
  assert.equal(versions.items.length, 1);
  const content = await client.read(
    `/v1/prontuario/versoes/${receipt.evolucao_versao_id}?unidade_id=${fixture.unit}`,
  );
  assert.equal(content.conteudo, JSON.parse(intent.body).conteudo);
  assert.equal(content.autor_id, fixture.admin);
});
test("piloto: RBAC, unidade e sessão inválida são preservados", async () => {
  const reader = createPilotClient({
    base,
    fetcher: (await loginWeb(base, fixture.readerToken)).fetcher,
  });
  await assert.rejects(
    reader.send(
      reader.prepare("/v1/pacientes", {
        nome: "Recusado",
        especie_codigo: "canina",
        estado_vital: "vivo",
      }),
    ),
    { status: 403 },
  );
  await assert.rejects(
    reader.read(`/v1/prontuario/versoes?unidade_id=${fixture.unit}`),
    { status: 403 },
  );
  const operator = createPilotClient({
    base,
    fetcher: (await loginWeb(base, fixture.nurseToken)).fetcher,
  });
  await assert.rejects(
    operator.send(
      operator.prepare("/v1/episodios", {
        unidade_id: fixture.otherUnit,
        paciente_id: patient,
        tipo: "atendimento",
        admitido_em: new Date().toISOString(),
      }),
    ),
    { status: 403 },
  );
  await assert.rejects(
    createPilotClient({ base, token: "0".repeat(64) }).read("/v1/me"),
    { status: 401 },
  );
});
test("piloto: intenção é imutável e resposta não confirmada não vira sucesso", async () => {
  const input = { nome: "Original" };
  const intent = client.prepare("/v1/pacientes", input);
  input.nome = "Alterado";
  assert.equal(JSON.parse(intent.body).nome, "Original");
  assert.ok(Object.isFrozen(intent));
  const invalid = createPilotClient({
    base,
    token: "ficticio",
    fetcher: async () => new Response("{}", { status: 200 }),
  });
  await assert.rejects(invalid.send(intent), { uncertain: true });
});

test("contexto próprio: escopos, organizações e revogação sem permissão administrativa", async () => {
  const operatorSession = await loginWeb(base, fixture.nurseToken);
  const operator = createPilotClient({
    base,
    fetcher: operatorSession.fetcher,
  });
  let context = await operator.read("/v1/me/contexto");
  assert.equal(context.usuario_id, fixture.nurse);
  assert.deepEqual(context.permissoes_globais, []);
  assert.deepEqual(
    context.unidades.map((u) => u.id),
    [fixture.unit],
  );
  assert.ok(context.unidades[0].permissoes.includes("episodios:escrever"));
  assert.ok(!context.unidades[0].permissoes.includes("acesso:administrar"));
  await assert.rejects(operator.read("/v1/unidades"), { status: 403 });
  const foreign = await seedFixture(process.env.TEST_MIGRATION_DATABASE_URL);
  const foreignClient = createPilotClient({
    base,
    fetcher: (await loginWeb(base, foreign.adminToken)).fetcher,
  });
  const foreignContext = await foreignClient.read("/v1/me/contexto");
  assert.ok(
    foreignContext.unidades.every(
      (u) => ![fixture.unit, fixture.otherUnit].includes(u.id),
    ),
  );
  const assignment = (
    await client.read("/v1/atribuicoes?limit=100")
  ).items.find((a) => a.usuario_id === fixture.nurse);
  await client.send(
    client.prepare(`/v1/atribuicoes/${assignment.id}/revisoes`, {
      versao_esperada: 0,
      ativo: false,
      motivo: "Teste de revogação do contexto",
      simulacao: true,
      confirmacao_humana: true,
    }),
  );
  context = await operator.read("/v1/me/contexto");
  assert.deepEqual(context.unidades, []);
  await assert.rejects(
    operator.read(`/v1/episodios?unidade_id=${fixture.unit}`),
    { status: 403 },
  );
});

test("sessão web respeita revogação real da credencial e contrato Bearer direto", async () => {
  const direct = await app.inject({
    url: "/v1/me",
    headers: { Authorization: `Bearer ${fixture.adminToken}` },
  });
  assert.equal(direct.statusCode, 200);
  await client.send(
    client.prepare(`/v1/credenciais/${fixture.credential}/revogar`, {
      motivo: "Encerramento de teste sintético",
    }),
  );
  await assert.rejects(client.read("/v1/me"), { status: 401 });
  assert.equal((await session.fetcher(`${base}/session`)).status, 401);
});
