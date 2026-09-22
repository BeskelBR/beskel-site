import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { command } from "../src/domain/core.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { medicalScenario } from "../scripts/medical-scenario.ts";
let app: FastifyInstance,
  db: pg.Pool,
  admin: pg.Pool,
  f: Awaited<ReturnType<typeof seedFixture>>,
  foreign: typeof f;
type Scenario = Awaited<ReturnType<typeof medicalScenario>>;
const post = (
  path: string,
  payload: Record<string, unknown>,
  token = f.adminToken,
  key = randomUUID(),
) =>
  app.inject({
    method: "POST",
    url: `/v1/prontuario/${path}`,
    headers: { authorization: `Bearer ${token}`, "idempotency-key": key },
    payload,
  });
const read = (path: string, token = f.adminToken, unit = f.unit) =>
  app.inject({
    url: `/v1/prontuario/${path}${path.includes("?") ? "&" : "?"}unidade_id=${unit}`,
    headers: { authorization: `Bearer ${token}` },
  });
const scenario = () => medicalScenario(app, f.adminToken, f.unit);
const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const common = () => ({
  unidade_id: f.unit,
  motivo: "Complemento fictício DEV",
  simulacao: true,
  confirmacao_humana: true,
});
const fields = [
  { codigo: "relato", rotulo: "Relato fictício", obrigatorio: true },
  { codigo: "observacao", rotulo: "Observação", obrigatorio: false },
];
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1kAAAAASUVORK5CYII=",
  "base64",
);
const source = (s: Scenario) => ({
  ...s.common,
  evolucao_versao_id: s.evolutionVersion,
  hash_evolucao: hash(s.body.conteudo),
});
const attachment = (s: Scenario) => ({
  ...source(s),
  nome: "pixel-ficticio.png",
  mime: "image/png",
  conteudo_base64: png.toString("base64"),
});
async function model() {
  const payload = {
    ...common(),
    codigo: `m_${randomUUID().replaceAll("-", "").slice(0, 20)}`,
    nome: "Modelo fictício",
    tipo: "evolucao",
    versao_esperada: 0,
    campos: fields,
  };
  const r = await post("modelos", payload);
  assert.equal(r.statusCode, 200, r.body);
  return { id: r.json().id as string, payload };
}
const modeled = (s: Scenario, id: string) => ({
  ...s.common,
  paciente_id: s.patient,
  episodio_id: s.episode,
  modelo_versao_id: id,
  referencia: randomUUID(),
  ocorrida_em: s.body.ocorrida_em,
  respostas: [{ codigo: "relato", valor: "Nariz fictício azul" }],
});
const revise = (s: Scenario) =>
  post("versoes", {
    ...s.common,
    evolucao_id: s.evolution,
    versao_esperada: 1,
    estado: "registrada",
    ocorrida_em: s.body.ocorrida_em,
    conteudo: "Novo registro sintético violeta",
  });
before(async () => {
  const url = process.env.TEST_MIGRATION_DATABASE_URL ?? "";
  assert.equal(new URL(url).pathname, "/hvb_sistema_test");
  await migrate(url);
  f = await seedFixture(url);
  foreign = await seedFixture(url);
  admin = pool(url, 1);
  db = pool(process.env.TEST_DATABASE_URL ?? "", 5);
  await transaction(admin, f.org, async (tx) => {
    await tx.query(
      "INSERT INTO papel_permissao(organizacao_id,papel_id,permissao) SELECT $1,$2,unnest($3::text[])",
      [
        f.org,
        f.nurseRole,
        [
          "prontuario:ler",
          "prontuario:conteudo",
          "prontuario:coautoria",
          "prontuario:anexar",
        ],
      ],
    );
    await tx.query(
      "INSERT INTO papel_permissao(organizacao_id,papel_id,permissao) VALUES($1,$2,'prontuario:ler')",
      [f.org, f.readerRole],
    );
  });
  app = await buildApp(db);
});
after(async () => {
  await app?.close();
  await db?.end();
  await admin?.end();
});
test("modelo versionado compõe texto exato na evolução original e preserva respostas privadas", async () => {
  const s = await scenario(),
    m = await model();
  const b = {
    ...modeled(s, m.id),
    respostas: [
      { codigo: "observacao", valor: "Texto informado" },
      { codigo: "relato", valor: "Azul fictício" },
    ],
  };
  const key = randomUUID(),
    r = await post("evolucoes-modeladas", b, f.adminToken, key);
  assert.equal(r.statusCode, 200, r.body);
  const retry = await post("evolucoes-modeladas", b, f.adminToken, key);
  assert.equal(retry.json().id, r.json().id);
  assert.equal(retry.json().repetido, true);
  const note = await read(`versoes/${r.json().evolucao_versao_id}`);
  assert.equal(
    note.json().conteudo,
    "Relato fictício\nAzul fictício\n\nObservação\nTexto informado",
  );
  const list = await read(
    `preenchimentos?evolucao_versao_id=${r.json().evolucao_versao_id}`,
  );
  assert.equal(list.json().items.length, 1);
  assert.equal(list.json().items[0].respostas, undefined);
  const id = list.json().items[0].id;
  assert.deepEqual(
    (await read(`preenchimentos/${id}`)).json().respostas,
    b.respostas,
  );
  assert.equal(
    (await read(`preenchimentos/${id}`, f.readerToken)).statusCode,
    403,
  );
  assert.deepEqual((await read(`modelos/${m.id}`)).json().campos, fields);
});
test("modelo aceita versão explicitamente escolhida e concorrência produz um sucessor", async () => {
  const m = await model(),
    next = { ...m.payload, versao_esperada: 1, nome: "Revisão fictícia" };
  const rs = await Promise.all([post("modelos", next), post("modelos", next)]);
  assert.deepEqual(rs.map((r) => r.statusCode).sort(), [200, 409]);
  assert.equal((await read(`modelos/${m.id}`)).json().versao, 1);
  const s = await scenario();
  assert.equal(
    (await post("evolucoes-modeladas", modeled(s, m.id))).statusCode,
    200,
  );
  const rows = (await read("modelos?limit=100"))
    .json()
    .items.filter((x: { codigo: string }) => x.codigo === m.payload.codigo);
  assert.equal(rows.filter((x: { atual: boolean }) => x.atual).length, 1);
});
test("campos duplicados, respostas desconhecidas, ausentes, numéricas e texto excessivo são rejeitados sem evolução parcial", async () => {
  const s = await scenario(),
    m = await model();
  const invalid = await post("modelos", {
    ...m.payload,
    codigo: `bad_${randomUUID().slice(0, 8)}`,
    campos: [fields[0], fields[0]],
  });
  assert.equal(invalid.statusCode, 409, invalid.body);
  for (const respostas of [
    [{ codigo: "observacao", valor: "Sem obrigatório" }],
    [{ codigo: "outro", valor: "X" }],
    [
      { codigo: "relato", valor: "A" },
      { codigo: "relato", valor: "B" },
    ],
    [{ codigo: "relato", valor: 12 }],
    [{ codigo: "relato", valor: "x".repeat(8000) }],
  ]) {
    const b = { ...modeled(s, m.id), respostas };
    const r = await post("evolucoes-modeladas", b);
    assert.ok([400, 409].includes(r.statusCode), r.body);
    assert.equal(
      (
        await admin.query(
          "SELECT count(*)::int n FROM hvb.evolucao_clinica WHERE referencia=$1",
          [b.referencia],
        )
      ).rows[0].n,
      0,
    );
  }
});
test("anexo é privado, transacional, tipado e idempotente com hash dos bytes", async () => {
  const s = await scenario(),
    b = attachment(s),
    key = randomUUID(),
    r = await post("anexos", b, f.adminToken, key);
  assert.equal(r.statusCode, 200, r.body);
  const retry = await post("anexos", b, f.adminToken, key);
  assert.equal(retry.json().id, r.json().id);
  assert.equal(retry.json().repetido, true);
  const list = await read(
      `anexos?evolucao_versao_id=${s.evolutionVersion}`,
      f.readerToken,
    ),
    item = list.json().items[0];
  assert.equal(list.json().items.length, 1);
  assert.equal(item.conteudo, undefined);
  assert.equal(item.conteudo_base64, undefined);
  assert.equal(item.tamanho, png.length);
  assert.equal(item.revogada, false);
  assert.equal(item.hash_conteudo, hash(png));
  const body = await read(`anexos/${r.json().id}/conteudo`);
  assert.equal(body.json().conteudo_base64, b.conteudo_base64);
  assert.equal(body.headers["cache-control"], "no-store");
  assert.equal(
    (await read(`anexos/${r.json().id}/conteudo`, f.readerToken)).statusCode,
    403,
  );
  assert.equal(
    (
      await read(
        `anexos/${r.json().id}/conteudo`,
        foreign.adminToken,
        foreign.unit,
      )
    ).statusCode,
    404,
  );
});
test("limite de anexo, base64 canônico, MIME, nome e hash de origem são conferidos", async () => {
  const s = await scenario(),
    b = attachment(s);
  for (const extra of [
    { conteudo_base64: b.conteudo_base64 + "\n" },
    { conteudo_base64: "!!!!" },
    { mime: "application/pdf" },
    { nome: "../escape.png" },
    { hash_evolucao: "0".repeat(64) },
    { conteudo_base64: Buffer.alloc(262145).toString("base64") },
  ]) {
    const r = await post("anexos", { ...b, ...extra });
    assert.ok([400, 409].includes(r.statusCode), r.body);
  }
  const bytes = Buffer.alloc(262144);
  png.copy(bytes, 0);
  const r = await post("anexos", {
    ...b,
    conteudo_base64: bytes.toString("base64"),
  });
  assert.equal(r.statusCode, 200, r.body);
  const oversized = await post("anexos", {
    ...b,
    conteudo_base64: "A".repeat(360001),
  });
  assert.equal(oversized.statusCode, 413);
  assert.equal(
    (await read(`anexos?evolucao_versao_id=${s.evolutionVersion}`)).json().items
      .length,
    1,
  );
});
test("retificar mantém anexo na versão histórica e somente seu autor pode revogar", async () => {
  const s = await scenario(),
    r = await post("anexos", attachment(s));
  assert.equal(r.statusCode, 200, r.body);
  const id = r.json().id;
  assert.equal((await revise(s)).statusCode, 200);
  const items = (
    await read(`anexos?evolucao_versao_id=${s.evolutionVersion}`)
  ).json().items;
  assert.equal(items[0].atual, false);
  assert.equal((await post("anexos", attachment(s))).statusCode, 409);
  assert.equal((await read(`anexos/${id}/conteudo`)).statusCode, 200);
  const b = { ...common(), anexo_id: id };
  assert.equal(
    (await post("revogacoes-anexos", b, f.nurseToken)).statusCode,
    409,
  );
  assert.equal((await post("revogacoes-anexos", b)).statusCode, 200);
  assert.equal((await read(`anexos/${id}/conteudo`)).statusCode, 409);
  assert.equal((await post("revogacoes-anexos", b)).statusCode, 409);
  assert.equal(
    (
      await admin.query(
        "SELECT octet_length(conteudo) n FROM hvb.anexo_evolucao WHERE id=$1",
        [id],
      )
    ).rows[0].n,
    png.length,
  );
});
test("coautoria declara somente o próprio usuário e impede duplicidade e autoria original", async () => {
  const s = await scenario(),
    b = source(s);
  assert.equal((await post("coautorias", b)).statusCode, 409);
  assert.equal(
    (await post("coautorias", { ...b, autor_id: f.admin }, f.nurseToken))
      .statusCode,
    400,
  );
  const key = randomUUID(),
    r = await post("coautorias", b, f.nurseToken, key);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(
    (await post("coautorias", b, f.nurseToken, key)).json().repetido,
    true,
  );
  assert.equal((await post("coautorias", b, f.nurseToken)).statusCode, 409);
  const item = (
    await read(`coautorias?evolucao_versao_id=${s.evolutionVersion}`)
  ).json().items[0];
  assert.equal(item.autor_id, f.nurse);
  assert.equal(item.vigente, true);
});
test("retificação encerra vigência da coautoria sem apagá-la, revogação é pessoal", async () => {
  const s = await scenario(),
    r = await post("coautorias", source(s), f.nurseToken);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal((await revise(s)).statusCode, 200);
  assert.equal(
    (await post("coautorias", source(s), f.nurseToken)).statusCode,
    409,
  );
  let item = (
    await read(`coautorias?evolucao_versao_id=${s.evolutionVersion}`)
  ).json().items[0];
  assert.equal(item.vigente, false);
  assert.equal(item.revogada, false);
  const b = { ...common(), coautoria_id: r.json().id };
  assert.equal((await post("revogacoes-coautorias", b)).statusCode, 409);
  assert.equal(
    (await post("revogacoes-coautorias", b, f.nurseToken)).statusCode,
    200,
  );
  item = (
    await read(`coautorias?evolucao_versao_id=${s.evolutionVersion}`)
  ).json().items[0];
  assert.equal(item.revogada, true);
});
test("coautoria concorrente com retificação nunca passa a valer para o texto novo", async () => {
  const s = await scenario();
  const [co, rev] = await Promise.all([
    post("coautorias", source(s), f.nurseToken),
    revise(s),
  ]);
  assert.equal(rev.statusCode, 200, rev.body);
  assert.ok([200, 409].includes(co.statusCode), co.body);
  const rows = (await read(`coautorias?evolucao_id=${s.evolution}`)).json()
    .items;
  assert.ok(rows.every((x: { vigente: boolean }) => !x.vigente));
});
test("busca exige acesso ao conteúdo, limita paciente/unidade e separa versão atual do histórico", async () => {
  const s = await scenario(),
    url = `busca?paciente_id=${s.patient}&q=prontuário`;
  const before = await read(url);
  assert.equal(before.statusCode, 200, before.body);
  assert.equal(before.json().items.length, 1);
  assert.equal(before.json().items[0].conteudo, undefined);
  assert.equal((await read(url, f.readerToken)).statusCode, 403);
  assert.equal((await read("busca?q=prontuário")).statusCode, 400);
  assert.equal(
    (await read(url, f.adminToken, f.otherUnit)).json().items.length,
    0,
  );
  assert.equal(
    (await read(url, foreign.adminToken, foreign.unit)).json().items.length,
    0,
  );
  assert.equal((await revise(s)).statusCode, 200);
  assert.equal((await read(url)).json().items.length, 0);
  const historical = await read(`${url}&historico=true`);
  assert.equal(historical.json().items[0].id, s.evolutionVersion);
  assert.equal(historical.json().items[0].atual, false);
  assert.equal(
    (await read(`busca?paciente_id=${s.patient}&q=violeta`)).json().items
      .length,
    1,
  );
});
test("busca pagina metadados sem repetições e trata consulta como dado", async () => {
  const s = await scenario();
  for (let i = 0; i < 2; i++) {
    const r = await post("evolucoes", { ...s.body, referencia: randomUUID() });
    assert.equal(r.statusCode, 200, r.body);
  }
  const base = `busca?paciente_id=${s.patient}&q=prontuário&limit=2`;
  const first = (await read(base)).json();
  assert.equal(first.items.length, 2);
  assert.ok(first.next_cursor);
  const second = (await read(`${base}&cursor=${first.next_cursor}`)).json();
  assert.equal(second.items.length, 1);
  assert.equal(second.next_cursor, null);
  assert.equal(
    new Set([...first.items, ...second.items].map((x) => x.id)).size,
    3,
  );
  const odd = await read(
    `busca?paciente_id=${s.patient}&q=${encodeURIComponent("' ; SELECT pg_sleep(20) --")}`,
  );
  assert.equal(odd.statusCode, 200, odd.body);
});
test("permissões, unidade e organização protegem comandos e preservam isolamento RLS", async () => {
  const s = await scenario(),
    m = await model();
  assert.equal(
    (
      await post(
        "modelos",
        { ...m.payload, codigo: "sem_permissao" },
        f.readerToken,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (await post("anexos", attachment(s), f.readerToken)).statusCode,
    403,
  );
  assert.equal(
    (await post("coautorias", source(s), f.readerToken)).statusCode,
    403,
  );
  assert.equal(
    (await post("anexos", { ...attachment(s), unidade_id: f.otherUnit }))
      .statusCode,
    409,
  );
  assert.equal(
    (
      await post(
        "anexos",
        { ...attachment(s), unidade_id: foreign.unit },
        foreign.adminToken,
      )
    ).statusCode,
    409,
  );
  const b = modeled(s, m.id);
  assert.equal(
    (await post("evolucoes-modeladas", { ...b, unidade_id: f.otherUnit }))
      .statusCode,
    404,
  );
  await transaction(db, foreign.org, async (tx) => {
    assert.equal(
      (
        await tx.query("SELECT id FROM modelo_evolucao_versao WHERE id=$1", [
          m.id,
        ])
      ).rowCount,
      0,
    );
  });
});
test("anexos e declarações em evolução invalidada são rejeitados", async () => {
  const s = await scenario();
  const r = await post("versoes", {
    ...s.common,
    evolucao_id: s.evolution,
    versao_esperada: 1,
    estado: "invalidada",
    ocorrida_em: s.body.ocorrida_em,
    conteudo: "Invalidado em teste fictício",
  });
  assert.equal(r.statusCode, 200, r.body);
  const extra = {
    evolucao_versao_id: r.json().id,
    hash_evolucao: hash("Invalidado em teste fictício"),
  };
  assert.equal(
    (await post("anexos", { ...attachment(s), ...extra })).statusCode,
    409,
  );
  assert.equal(
    (await post("coautorias", { ...source(s), ...extra }, f.nurseToken))
      .statusCode,
    409,
  );
});
test("integridade SQL rejeita proveniência falsa, alteração e uso de comando concluído", async () => {
  const s = await scenario(),
    m = await model();
  const actor = {
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
          "c11-invalid",
          {},
          undefined,
          randomUUID(),
          async (cmd) => {
            const id = randomUUID();
            await tx.query(
              "INSERT INTO preenchimento_modelo_evolucao(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,evolucao_versao_id,modelo_versao_id,respostas) VALUES($1,$2,$3,$4,$5,'Teste SQL fictício',$6,$7,$8)",
              [
                id,
                f.org,
                f.unit,
                f.admin,
                cmd,
                s.evolutionVersion,
                m.id,
                JSON.stringify([{ codigo: "relato", valor: "Conteúdo falso" }]),
              ],
            );
            return { id };
          },
        ),
      ),
    { code: "23514" },
  );
  const r = await post("anexos", attachment(s));
  assert.equal(r.statusCode, 200, r.body);
  await assert.rejects(() =>
    admin.query("UPDATE hvb.anexo_evolucao SET nome='outro.png' WHERE id=$1", [
      r.json().id,
    ]),
  );
  await assert.rejects(
    () =>
      transaction(db, f.org, (tx) =>
        tx.query(
          "INSERT INTO revogacao_anexo_evolucao(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,anexo_id) VALUES($1,$2,$3,$4,$5,'Comando concluído',$6)",
          [
            randomUUID(),
            f.org,
            f.unit,
            f.admin,
            r.json().comando_id,
            r.json().id,
          ],
        ),
      ),
    { code: "23514" },
  );
});
