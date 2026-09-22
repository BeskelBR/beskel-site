import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { terminalScenario } from "../scripts/terminal-scenario.ts";
let app: FastifyInstance,
  db: pg.Pool,
  admin: pg.Pool,
  f: Awaited<ReturnType<typeof seedFixture>>,
  foreign: typeof f;
type Scenario = Awaited<ReturnType<typeof terminalScenario>>;
const scenario = () => terminalScenario(app, f.adminToken, f.unit);
const post = (
  path: string,
  body: Record<string, unknown>,
  device?: string,
  key: string = randomUUID(),
  token = f.adminToken,
) =>
  app.inject({
    method: "POST",
    url: `/v1${path}`,
    headers: {
      authorization: `Bearer ${token}`,
      "idempotency-key": key,
      ...(device ? { "x-device-id": device } : {}),
    },
    payload: body,
  });
const read = (path: string, device: string, token = f.adminToken) =>
  app.inject({
    url: `/v1${path}`,
    headers: { authorization: `Bearer ${token}`, "x-device-id": device },
  });
async function row(table: string, id: string) {
  return (await admin.query(`SELECT * FROM hvb.${table} WHERE id=$1`, [id]))
    .rows[0];
}
async function create(
  path: string,
  body: Record<string, unknown>,
  device?: string,
) {
  const r = await post(path, body, device);
  assert.equal(r.statusCode, 200, r.body);
  return r.json().id as string;
}
const revoke = (s: Scenario) =>
  create("/terminal/revogacoes", { ...s.common, etiqueta_id: s.label });
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

test("scan identifica contexto sem criar movimento, execução ou cobrança", async () => {
  const s = await scenario();
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    "20.000000",
  );
  const scan = await row("leitura_terminal_consulta", s.scan);
  assert.equal(scan.posicao_id, s.position);
  assert.equal(scan.episodio_id, s.episode);
  assert.equal(scan.utilizada, false);
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.execucao WHERE episodio_id=$1",
        [s.episode],
      )
    ).rows[0].n,
    0,
  );
  const code = randomUUID();
  await create("/terminal/etiquetas", {
    ...s.common,
    codigo: code,
    paciente_id: s.patient,
  });
  const id = await create(
    "/terminal/leituras",
    {
      ...s.scanBody,
      codigo: code,
      referencia: randomUUID(),
      episodio_id: undefined,
    },
    s.device,
  );
  assert.equal(
    (await row("leitura_terminal_consulta", id)).paciente_id,
    s.patient,
  );
  assert.equal((await row("leitura_terminal_consulta", id)).episodio_id, null);
});
test("retirada legada bloqueia novos comandos sem movimentar estoque", async () => {
  const s = await scenario(),
    key = randomUUID();
  for (let n = 0; n < 2; n++) {
    const r = await post(
      "/terminal/retiradas",
      s.withdrawalBody,
      s.device,
      key,
    );
    assert.equal(r.statusCode, 409, r.body);
    assert.equal(r.json().erro, "terminal_retirada_legada_use_mobile_api");
  }
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    "20.000000",
  );
  const status = await read(
    `/terminal/comandos/${key}?unidade_id=${f.unit}`,
    s.device,
  );
  assert.equal(status.statusCode, 404, status.body);
});
test("dispositivo, confirmação literal e credencial API são obrigatórios", async () => {
  const s = await scenario();
  assert.equal((await post("/terminal/leituras", s.scanBody)).statusCode, 400);
  for (const extra of [
    { confirmacao_humana: false },
    { confirmacao_humana: "true" },
    { simulacao: false },
    { quantidade_base: 2 },
  ])
    assert.equal(
      (
        await post(
          "/terminal/retiradas",
          { ...s.withdrawalBody, ...extra },
          s.device,
        )
      ).statusCode,
      400,
    );
  const token = randomBytes(32).toString("hex");
  await create("/credenciais", {
    usuario_id: f.admin,
    tipo: "nfc",
    token,
    expira_em: new Date(Date.now() + 86400000).toISOString(),
  });
  assert.equal(
    (
      await post(
        "/terminal/leituras",
        s.scanBody,
        s.device,
        randomUUID(),
        token,
      )
    ).statusCode,
    401,
  );
  assert.equal(
    (
      await post(
        "/terminal/leituras",
        {
          ...s.scanBody,
          referencia: randomUUID(),
          ocorrida_em: "2099-01-01T00:00:00Z",
        },
        s.device,
      )
    ).statusCode,
    409,
  );
});
test("revogação entre scan e confirmação bloqueia retirada sem perder histórico", async () => {
  const s = await scenario();
  await revoke(s);
  assert.equal(
    (await post("/terminal/retiradas", s.withdrawalBody, s.device)).statusCode,
    409,
  );
  assert.equal(
    (
      await post(
        "/terminal/leituras",
        { ...s.scanBody, referencia: randomUUID() },
        s.device,
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    "20.000000",
  );
  assert.equal(
    (await row("leitura_terminal_consulta", s.scan)).etiqueta_ativa,
    false,
  );
  await assert.rejects(
    admin.query("DELETE FROM hvb.leitura_terminal WHERE id=$1", [s.scan]),
  );
});
test("outro operador ou dispositivo não reutiliza leitura alheia", async () => {
  const s = await scenario(),
    device = await create("/dispositivos", {
      unidade_id: f.unit,
      nome: "Outro terminal fictício",
    });
  assert.equal(
    (await post("/terminal/retiradas", s.withdrawalBody, device)).statusCode,
    409,
  );
  await admin.query(
    "INSERT INTO hvb.papel_permissao(organizacao_id,papel_id,permissao) SELECT $1,$2,unnest($3::text[]) ON CONFLICT DO NOTHING",
    [
      f.org,
      f.nurseRole,
      ["terminal:ler", "terminal:usar", "estoque:ler", "estoque:movimentar"],
    ],
  );
  assert.equal(
    (
      await post(
        "/terminal/retiradas",
        s.withdrawalBody,
        s.device,
        randomUUID(),
        f.nurseToken,
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await read(
        `/terminal/comandos/${s.prefix}-terminal-leitura?unidade_id=${f.unit}`,
        s.device,
        f.nurseToken,
      )
    ).statusCode,
    404,
  );
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    "20.000000",
  );
});
test("episódio escolhido deve ser compatível e continuar aberto na confirmação", async () => {
  const s = await scenario(),
    other = await scenario();
  assert.equal(
    (
      await post(
        "/terminal/leituras",
        { ...s.scanBody, referencia: randomUUID(), episodio_id: other.episode },
        s.device,
      )
    ).statusCode,
    409,
  );
  await create(`/episodios/${s.episode}/encerrar`, {
    ocorrido_em: "2026-09-01T13:00:00Z",
    versao_esperada: 1,
    motivo: "Saída fictícia",
  });
  assert.equal(
    (await post("/terminal/retiradas", s.withdrawalBody, s.device)).statusCode,
    409,
  );
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    "20.000000",
  );
});
test("RLS, unidade, alvo e saldo inválidos não deixam retirada parcial", async () => {
  const s = await scenario();
  for (const extra of [
    { origem_id: s.destination },
    { destino_id: randomUUID() },
    { quantidade_base: "21" },
  ])
    assert.equal(
      (
        await post(
          "/terminal/retiradas",
          { ...s.withdrawalBody, ...extra },
          s.device,
        )
      ).statusCode,
      409,
    );
  assert.equal(
    (
      await post(
        "/terminal/leituras",
        { ...s.scanBody, unidade_id: f.otherUnit },
        s.device,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await post(
        "/terminal/leituras",
        s.scanBody,
        s.device,
        randomUUID(),
        f.readerToken,
      )
    ).statusCode,
    403,
  );
  await transaction(db, foreign.org, async (tx) =>
    assert.equal(
      (await tx.query("SELECT id FROM leitura_terminal WHERE id=$1", [s.scan]))
        .rowCount,
      0,
    ),
  );
  const r = await read(
    `/terminal/leituras?unidade_id=${f.unit}&dispositivo_id=${s.device}`,
    s.device,
  );
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().items[0].utilizada, false);
  assert.equal(
    (await row("posicao_estoque", s.position)).saldo_base,
    "20.000000",
  );
});
test("desativação concorrente do dispositivo é revalidada antes do comando", async () => {
  const s = await scenario(),
    held = await admin.connect();
  let pending: ReturnType<typeof post> | undefined;
  try {
    await held.query("BEGIN");
    await held.query("SELECT id FROM hvb.dispositivo WHERE id=$1 FOR UPDATE", [
      s.device,
    ]);
    pending = post(
      "/terminal/leituras",
      { ...s.scanBody, referencia: randomUUID() },
      s.device,
    );
    const running = Promise.resolve(pending);
    let blocked = false;
    for (let n = 0; n < 100; n++) {
      const r = await held.query(
        "SELECT 1 FROM pg_stat_activity WHERE wait_event='transactionid' AND query LIKE 'SELECT unidade_id,ativo FROM dispositivo%' LIMIT 1",
      );
      if (r.rowCount) {
        blocked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(
      blocked,
      true,
      "Comando deve aguardar a alteração do dispositivo",
    );
    await held.query("UPDATE hvb.dispositivo SET ativo=false WHERE id=$1", [
      s.device,
    ]);
    await held.query("COMMIT");
    assert.equal((await running).statusCode, 403);
  } finally {
    await held.query("ROLLBACK");
    held.release();
    if (pending) await pending;
  }
});
