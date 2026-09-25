import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { pool, localUrl } from "../src/persistence/database.ts";
import { buildApp } from "../src/api/app.ts";
import { seedFixture } from "../scripts/seed.ts";
let admin: pg.Pool, db: pg.Pool, app: FastifyInstance;
let f: Awaited<ReturnType<typeof seedFixture>>, foreign: typeof f;
const owner = randomUUID(),
  foreignOwner = randomUUID();
const ownerFields = {
  nome: "  Responsavel   Sintetico 102 ",
  cpf: "529.982.247-25",
  telefone_whatsapp: "(11) 99999-4321",
  email: "  TESTE102@EXAMPLE.INVALID ",
  data_nascimento: "1990-05-20",
  cep: "01001-000",
  logradouro: " Rua   Sintetica ",
  numero: " 12A ",
  complemento: " Bloco  B ",
  bairro: " Centro ",
  cidade: " Sao   Paulo ",
  uf: " sp ",
};
const post = (path: string, body: unknown, token = f.adminToken) =>
  app.inject({
    method: "POST",
    url: `/v1${path}`,
    payload: body as object,
    headers: {
      authorization: `Bearer ${token}`,
      "idempotency-key": randomUUID(),
    },
  });
const get = (path: string, token = f.adminToken) =>
  app.inject({
    url: `/v1${path}`,
    headers: { authorization: `Bearer ${token}` },
  });
async function create(path: string, body: unknown) {
  const r = await post(path, body);
  assert.equal(r.statusCode, 200);
  return r.json().id as string;
}
const patient = (more: Record<string, unknown> = {}) =>
  create("/pacientes", {
    nome: "Paciente 102",
    especie_codigo: "canina",
    estado_vital: "vivo",
    responsavel_id: owner,
    papel_responsavel: "legal",
    ...more,
  });
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
before(async () => {
  const url = localUrl(process.env.TEST_MIGRATION_DATABASE_URL);
  assert.equal(new URL(url).pathname, "/hvb_sistema_test");
  admin = pool(url, 2);
  assert.ok(
    !/onedrive/i.test(
      (await admin.query("SHOW data_directory")).rows[0].data_directory,
    ),
  );
  f = await seedFixture(url);
  foreign = await seedFixture(url);
  db = pool(localUrl(process.env.TEST_DATABASE_URL), 5);
  app = await buildApp(db);
  // Independent read tests use administrative synthetic fixtures. This does NOT
  // replace the separate runtime POST /responsaveis acceptance test below.
  for (const [id, org] of [
    [owner, f.org],
    [foreignOwner, foreign.org],
  ])
    await admin.query(
      `INSERT INTO hvb.responsavel(id,organizacao_id,${Object.keys(ownerFields).join(",")}) VALUES($1,$2,${Object.keys(
        ownerFields,
      )
        .map((_, i) => `$${i + 3}`)
        .join(",")})`,
      [id, org, ...Object.values(ownerFields)],
    );
});
after(async () => {
  await app?.close();
  await db?.end();
  await admin?.end();
});
test("102: cadastro responsavel pelo runtime suporta campos estruturados", async () => {
  const response = await post("/responsaveis", { ...ownerFields, cpf: null });
  assert.equal(
    response.statusCode,
    200,
    "Runtime deve poder avaliar cpf_valido na constraint, inclusive CPF NULL",
  );
});
test("102: leitura normalizada e busca responsavel por nome, CPF, telefone, email e UUID", async () => {
  for (const q of [
    "Sintetico 102",
    "529.982.247-25",
    "(11) 99999-4321",
    "TESTE102@EXAMPLE.INVALID",
    owner,
  ]) {
    const r = await get(`/responsaveis?q=${encodeURIComponent(q)}`);
    assert.equal(r.statusCode, 200);
    assert.ok(r.json().items.some((v: { id: string }) => v.id === owner));
    assert.ok(
      r.json().items.every((v: { id: string }) => v.id !== foreignOwner),
    );
  }
  const record = (await get(`/responsaveis?q=${owner}`)).json().items[0];
  assert.equal(record.cpf, "52998224725");
  assert.equal(record.telefone_whatsapp, "11999994321");
  assert.equal(record.email, "teste102@example.invalid");
  assert.equal(record.cep, "01001000");
  assert.equal(record.numero, "12A");
  assert.equal(record.cidade, "Sao Paulo");
  assert.equal(record.uf, "SP");
  assert.equal(record.data_nascimento, "1990-05-20");
  assert.ok(!("endereco" in record));
});
test("102: paciente e vinculo atomicos, microchip NULL, contato opcional e tenant", async () => {
  const id = await patient({
    microchip: null,
    castrado: false,
    data_nascimento: "2020-02-01",
  });
  const record = (await get(`/pacientes?q=${id}`)).json().items[0];
  assert.equal(record.microchip, null);
  assert.equal(record.castrado, false);
  assert.equal(record.data_nascimento, "2020-02-01");
  const byPatient = (await get(`/vinculos?paciente_id=${id}`)).json().items;
  const byOwner = (await get(`/vinculos?responsavel_id=${owner}`)).json().items;
  assert.equal(byPatient.length, 1);
  assert.equal(byPatient[0].estado, "ativo");
  assert.equal(byPatient[0].id, byPatient[0].vinculo_id);
  assert.equal(byPatient[0].paciente_nome, "Paciente 102");
  assert.ok(byOwner.some((v: { id: string }) => v.id === byPatient[0].id));
  assert.equal(
    (await get(`/vinculos?paciente_id=${id}`, foreign.adminToken)).json().items
      .length,
    0,
  );
  assert.equal(
    (
      await post("/pacientes", {
        nome: "Sem vinculo",
        especie_codigo: "canina",
        estado_vital: "vivo",
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await post("/pacientes", {
        nome: "Tenant incorreto",
        especie_codigo: "canina",
        estado_vital: "vivo",
        responsavel_id: foreignOwner,
        papel_responsavel: "legal",
      })
    ).statusCode,
    404,
  );
  assert.equal(
    (
      await post("/pacientes", {
        nome: "Emergencia incompleta",
        especie_codigo: "canina",
        estado_vital: "vivo",
        responsavel_id: owner,
        papel_responsavel: "legal",
        contato_emergencia_nome: "Pessoa sintetica",
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (await get("/pacientes?q=Emergencia%20incompleta")).json().items.length,
    0,
  );
});
test("102: busca por microchip/nome, revisao mantem identidade e normalizacao", async () => {
  const chip = `CHIP${randomUUID().replaceAll("-", "")}`;
  const id = await patient({
    microchip: chip.toLowerCase(),
    sexo: " FEMEA ",
    observacoes: " Observacao ",
    contato_emergencia_nome: " Maria  Teste ",
    contato_emergencia_telefone: "(11) 98888-4321",
    contato_emergencia_vinculo: " Amiga ",
  });
  const records = (await get(`/pacientes?q=${chip.toLowerCase()}`)).json()
    .items;
  assert.equal(records[0].id, id);
  assert.equal(records[0].sexo, "femea");
  assert.equal(records[0].contato_emergencia_telefone, "11988884321");
  assert.ok(
    (await get("/pacientes?q=Paciente%20102"))
      .json()
      .items.some((p: { id: string }) => p.id === id),
  );
  const revision = await post(`/pacientes/${id}/revisoes`, {
    versao_esperada: 0,
    simulacao: true,
    confirmacao_humana: true,
    motivo: "Teste 102",
    dados: {
      nome: "Paciente revisado 102",
      especie_codigo: "canina",
      estado_vital: "vivo",
      microchip: null,
      observacoes: "Nova observacao",
    },
  });
  assert.equal(revision.statusCode, 200);
  const history = await get(`/pacientes/${id}/revisoes`);
  assert.equal(history.statusCode, 200);
  assert.equal(history.json().atual.microchip, null);
  assert.equal(history.json().atual.contato_emergencia_vinculo, "Amiga");
  for (const legacy of [
    "nascimento_estimado",
    "cirurgias_procedimentos_relevantes",
    "contato_emergencia",
  ])
    assert.ok(!(legacy in history.json().atual));
  const responsibleRevision = await post(`/responsaveis/${owner}/revisoes`, {
    versao_esperada: 0,
    simulacao: true,
    confirmacao_humana: true,
    motivo: "Teste endereco",
    dados: {
      nome: "Responsavel Sintetico 102",
      numero: "14B",
      complemento: null,
    },
  });
  assert.equal(responsibleRevision.statusCode, 200);
  assert.equal(
    (await get(`/responsaveis?q=${owner}`)).json().items[0].numero,
    "14B",
  );
});
test("102: views canonicas de episodio/ocupacao e transicoes preservadas", async () => {
  const p = await patient();
  const ep = await create("/episodios", {
    unidade_id: f.unit,
    paciente_id: p,
    tipo: "internacao",
    admitido_em: ago(60000),
  });
  const local = await create("/locais", {
    unidade_id: f.unit,
    nome: "Box 102",
    tipo: "box",
    capacidade: 1,
  });
  const occ = await create("/ocupacoes", {
    episodio_id: ep,
    local_id: local,
    vaga: 1,
    inicio: ago(1000),
  });
  const episode = () => get(`/episodios?unidade_id=${f.unit}&paciente_id=${p}`);
  const occupancy = () =>
    get(`/ocupacoes?unidade_id=${f.unit}&episodio_id=${ep}`);
  assert.equal((await episode()).json().items[0].estado, "ativo");
  const oc = (await occupancy()).json().items[0];
  assert.equal(oc.estado, "ativa");
  assert.equal(oc.local_nome, "Box 102");
  assert.equal(oc.paciente_nome, "Paciente 102");
  assert.equal(
    (
      await post(`/episodios/${ep}/encerrar`, {
        versao_esperada: 1,
        ocorrido_em: ago(0),
        motivo: "Saida sintetica",
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await post(`/episodios/${ep}/alta`, {
        versao_esperada: 1,
        ocorrido_em: ago(0),
        motivo: "Alta sintetica",
      })
    ).statusCode,
    200,
  );
  assert.equal((await episode()).json().items[0].estado, "alta_clinica");
  assert.equal(
    (await occupancy()).json().items[0].episodio_estado,
    "alta_clinica",
  );
  assert.equal(
    (
      await post(`/ocupacoes/${occ}/encerrar`, {
        fim: ago(0),
        motivo: "Fim sintetico",
      })
    ).statusCode,
    200,
  );
  assert.equal((await occupancy()).json().items[0].estado, "encerrada");
  assert.equal(
    (
      await post(`/episodios/${ep}/encerrar`, {
        versao_esperada: 2,
        ocorrido_em: ago(0),
        motivo: "Saida sintetica",
      })
    ).statusCode,
    200,
  );
  assert.equal((await episode()).json().items[0].estado, "encerrado");
});
test("102: atribuicao explicita global, ausencia de unidade e readiness", async () => {
  const r = await get("/atribuicoes?limit=100");
  assert.equal(r.statusCode, 200);
  const global = r
    .json()
    .items.find(
      (v: { usuario_id: string; unidade_id: string | null }) =>
        v.usuario_id === f.admin && v.unidade_id === null,
    );
  assert.equal(global.escopo, "global");
  assert.ok(global.usuario_nome);
  assert.ok(global.papel_nome);
  assert.equal(global.unidade_nome, null);
  assert.equal((await app.inject("/ready")).statusCode, 200);
  const history = await get(`/atribuicoes/${global.id}/revisoes`);
  assert.equal(history.statusCode, 200);
  assert.equal(history.json().escopo, "global");
});
