import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/api/app.ts";
import { pool, transaction } from "../src/persistence/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { seedFixture } from "../scripts/seed.ts";
import { clinicalScenario } from "../scripts/clinical-scenario.ts";
import { createV1DevAdapter } from "../src/domain/terminal-v1/evidence.ts";
import type { V1Claims } from "../src/domain/terminal-v1/evidence.ts";
const simulator = createV1DevAdapter(randomBytes(32));
let app: FastifyInstance, closed: FastifyInstance, db: pg.Pool, admin: pg.Pool;
let f: Awaited<ReturnType<typeof seedFixture>>,
  other: typeof f,
  hospital: string;
type Device = { id: string; token: string; credential: string };
type Devices = Record<
  "ACCESS" | "BIOMETRIC" | "PICKING" | "CONTROLLER",
  Device
>;
before(async () => {
  const url = process.env.TEST_MIGRATION_DATABASE_URL ?? "";
  assert.equal(new URL(url).pathname, "/hvb_sistema_test");
  await migrate(url);
  f = await seedFixture(url);
  other = await seedFixture(url);
  admin = pool(url, 1);
  db = pool(process.env.TEST_DATABASE_URL ?? "", 5);
  app = await buildApp(db, false, undefined, simulator.adapter);
  closed = await buildApp(db);
  hospital = await create("/estoque/custodias", { tipo: "hospital" });
});
after(async () => {
  await app?.close();
  await closed?.close();
  await db?.end();
  await admin?.end();
});
const common = () => ({
  unidade_id: f.unit,
  motivo: "Ensaio sintético Terminal v1 C18",
});
const post = (
  path: string,
  body: object,
  device?: Device,
  key: string = randomUUID(),
  server = app,
  token = f.adminToken,
) =>
  server.inject({
    method: "POST",
    url: `/v1${path}`,
    headers: {
      authorization: `Bearer ${device?.token ?? token}`,
      "idempotency-key": key,
      ...(device ? { "x-device-id": device.id } : {}),
    },
    payload: body,
  });
async function create(
  path: string,
  body: object,
  device?: Device,
  key?: string,
) {
  const r = await post(path, body, device, key);
  assert.equal(r.statusCode, 200, `${path}: ${r.body}`);
  return r.json().id as string;
}
const vpost = (
  path: string,
  body: object = {},
  d?: Device,
  key?: string,
  server?: FastifyInstance,
) => post(`/terminal/v1${path}`, { ...common(), ...body }, d, key, server);
const vcreate = (path: string, body: object = {}, d?: Device, key?: string) =>
  create(`/terminal/v1${path}`, { ...common(), ...body }, d, key);
const get = (path: string, d?: Device, token = f.adminToken) =>
  app.inject({
    url: `/v1/terminal/v1${path}${path.includes("?") ? "&" : "?"}unidade_id=${f.unit}`,
    headers: {
      authorization: `Bearer ${d?.token ?? token}`,
      ...(d ? { "x-device-id": d.id } : {}),
    },
  });
async function row(table: string, id: string) {
  return (await admin.query(`SELECT * FROM hvb.${table} WHERE id=$1`, [id]))
    .rows[0];
}
async function fixture(
  sensitive = false,
  quantities = ["20"],
  expiry = ["2099-01-01"],
  employee: string = f.admin,
) {
  const clinical = await clinicalScenario(app, f.adminToken, f.unit);
  const local = await create("/locais", {
    unidade_id: f.unit,
    nome: "Sala DEV C18",
    tipo: "sala",
    capacidade: 1,
  });
  const transit = await create("/locais", {
    unidade_id: f.unit,
    nome: "Retirada em trânsito DEV C18",
    tipo: "armario",
    capacidade: 0,
  });
  const room = await vcreate("/rooms", {
    local_id: local,
    transit_local_id: transit,
    unlock_seconds: 15,
    session_seconds: 900,
  });
  const devices = {} as Devices;
  for (const role of [
    "ACCESS",
    "BIOMETRIC",
    "PICKING",
    "CONTROLLER",
  ] as const) {
    const id = await create("/dispositivos", {
      unidade_id: f.unit,
      nome: `Simulador ${role}`,
    });
    const token = randomBytes(32).toString("hex");
    const credential = await create("/credenciais", {
      usuario_id: f.admin,
      tipo: "api",
      token,
      expira_em: new Date(Date.now() + 86400000).toISOString(),
    });
    await vcreate("/devices", {
      room_id: room,
      device_id: id,
      credential_id: credential,
      role,
      mode: "SIMULADO_DEV",
    });
    devices[role] = { id, token, credential };
  }
  await vcreate("/product-policies", {
    product_id: clinical.product,
    sensitive,
  });
  const lots: {
    id: string;
    position: string;
    coordinate: string;
    occupancy: string;
  }[] = [];
  for (let n = 0; n < quantities.length; n++) {
    const coordinate = await vcreate("/coordinates", {
      room_id: room,
      code: `A-${n + 1}`,
      sensitive,
    });
    const c = await row("tv1_coordinate", coordinate);
    const id = await create("/estoque/lotes", {
      apresentacao_id: clinical.presentation,
      fabricante: "Fictício C18",
      codigo: `${room}-${n}`,
      situacao_validade: "conhecida",
      validade: expiry[n] ?? expiry[0],
      custo_base: "1.25",
    });
    const position = await create("/estoque/posicoes", {
      local_id: c.local_id,
      lote_id: id,
      custodia_id: hospital,
    });
    await create("/estoque/entradas", {
      posicao_id: position,
      quantidade_apresentacoes: quantities[n],
      ocorrido_em: `2026-09-${String(n + 1).padStart(2, "0")}T10:00:00Z`,
      motivo: "Recebimento fictício C18",
    });
    const occupancy = await vcreate("/occupancies", {
      coordinate_id: coordinate,
      position_id: position,
    });
    lots.push({ id, position, coordinate, occupancy });
  }
  const tag = randomUUID();
  const nfc = await vcreate("/employee-nfc", { employee_id: employee, tag });
  return { ...clinical, room, transit, devices, lots, tag, nfc };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function challenge(x: Fixture) {
  const id = await vcreate(
    "/nfc",
    { room_id: x.room, tag: x.tag },
    x.devices.ACCESS,
  );
  const r = await get(`/challenges/${id}`, x.devices.BIOMETRIC);
  assert.equal(r.statusCode, 200, r.body);
  const c = r.json();
  const claims: V1Claims = {
    challenge_id: id,
    nonce: c.nonce,
    employee_id: c.employee_id,
    access_terminal_device_id: x.devices.ACCESS.id,
    biometric_device_id: x.devices.BIOMETRIC.id,
    captured_at: new Date().toISOString(),
    expires_at: c.expires_at,
    face_match: true,
    liveness: true,
    mode: "SIMULADO_DEV",
  };
  return { id, claims, evidence: simulator.sign(claims) };
}
async function authenticate(x: Fixture) {
  const c = await challenge(x);
  return vcreate(
    "/biometric",
    { challenge_id: c.id, evidence: c.evidence },
    x.devices.BIOMETRIC,
  );
}
async function order(x: Fixture, quantity = "2") {
  return vcreate("/withdrawal-orders", {
    episode_id: x.episode,
    items: [
      {
        product_id: x.product,
        quantity,
        clinical_order_version_id: x.version,
        program_id: x.schedule,
      },
    ],
  });
}
async function start(
  x: Fixture,
  quantity = "2",
  orders?: string[],
  adjustment = "0",
) {
  const auth = await authenticate(x),
    os = orders ?? [await order(x, quantity)];
  const context = await vcreate(
    "/withdrawal-contexts",
    {
      auth_session_id: auth,
      orders: os,
      adjustments:
        adjustment === "0"
          ? []
          : [{ product_id: x.product, quantity: adjustment }],
    },
    x.devices.ACCESS,
  );
  const id = await vcreate(
    "/access-sessions",
    { context_id: context },
    x.devices.ACCESS,
  );
  return { id, context, auth, orders: os };
}
const physical = (
  x: Fixture,
  id: string,
  type: string,
  eventId = randomUUID(),
  key?: string,
) =>
  vpost(
    `/access-sessions/${id}/physical-events`,
    { type, event_id: eventId, occurred_at: new Date().toISOString() },
    x.devices.CONTROLLER,
    key,
  );
async function signal(x: Fixture, id: string, type: string) {
  const r = await physical(x, id, type);
  assert.equal(r.statusCode, 200, `${type}: ${r.body}`);
}
async function enter(x: Fixture, id: string) {
  await signal(x, id, "DOOR_OPEN");
  await signal(x, id, "ENTRY_CONFIRMED");
}
async function snapshot(x: Fixture, id: string) {
  const r = await get(`/access-sessions/${id}`, x.devices.PICKING);
  assert.equal(r.statusCode, 200, r.body);
  return r.json();
}
const pick = (
  x: Fixture,
  id: string,
  task: string,
  type: string,
  key?: string,
) =>
  vpost(
    `/access-sessions/${id}/picking-events`,
    {
      task_id: task,
      type,
      event_id: randomUUID(),
      occurred_at: new Date().toISOString(),
    },
    x.devices.PICKING,
    key,
  );
async function picked(x: Fixture, id: string, task: string, type = "CONFIRM") {
  const r = await pick(x, id, task, type);
  assert.equal(r.statusCode, 200, `${type}: ${r.body}`);
}
async function exit(x: Fixture, id: string) {
  await signal(x, id, "PRESENCE_CLEARED");
  await signal(x, id, "DOOR_CLOSED");
}

test("NFC inicia biometria automaticamente; identidade provisionada, replay e adaptador fechado", async () => {
  const x = await fixture();
  assert.equal(
    (
      await vpost(
        "/nfc",
        { room_id: x.room, tag: x.tag },
        x.devices.ACCESS,
        undefined,
        closed,
      )
    ).statusCode,
    503,
  );
  assert.equal(
    (
      await vpost(
        "/nfc",
        { room_id: x.room, tag: x.tag },
        { ...x.devices.ACCESS, token: f.adminToken },
      )
    ).statusCode,
    403,
  );
  const c = await challenge(x);
  const ev = (await get(`/events?challenge_id=${c.id}`)).json().items;
  assert.deepEqual(ev.map((e: { type: string }) => e.type).sort(), [
    "BIOMETRIC_REQUESTED",
    "NFC_VALIDATED",
  ]);
  const bad = simulator.sign({
    ...c.claims,
    biometric_device_id: x.devices.ACCESS.id,
  });
  assert.equal(
    (
      await vpost(
        "/biometric",
        { challenge_id: c.id, evidence: bad },
        x.devices.BIOMETRIC,
      )
    ).statusCode,
    403,
  );
  const body = { challenge_id: c.id, evidence: c.evidence },
    key = randomUUID();
  const first = await vpost("/biometric", body, x.devices.BIOMETRIC, key);
  assert.equal(first.statusCode, 200, first.body);
  const replay = await vpost("/biometric", body, x.devices.BIOMETRIC, key);
  assert.equal(replay.json().id, first.json().id);
  assert.equal(replay.json().repetido, true);
  assert.equal(
    (await vpost("/biometric", body, x.devices.BIOMETRIC)).statusCode,
    409,
  );
  await vcreate(`/employee-nfc/${x.nfc}/revoke`);
  assert.equal(
    (await vpost("/nfc", { room_id: x.room, tag: x.tag }, x.devices.ACCESS))
      .statusCode,
    403,
  );
  assert.equal((await get(`/challenges/${c.id}`, undefined)).statusCode, 400);
  assert.equal(
    (
      await get(`/events?challenge_id=${c.id}`, undefined, other.adminToken)
    ).json().items.length,
    0,
  );
});
test("FEFO/FIFO divide demanda e conserva ORs, ajustes e origens clínicas sem executar ou consumir", async () => {
  const x = await fixture(
    false,
    ["3", "4", "10"],
    ["2099-03-01", "2099-01-01", "2099-01-01"],
  );
  const orders = [await order(x, "3"), await order(x, "2")];
  const s = await start(x, "0", orders, "2");
  const snap = await snapshot(x, s.id);
  assert.deepEqual(
    snap.picking_tasks.map((t: { stock_lot_id: string; quantity: string }) => [
      t.stock_lot_id,
      t.quantity,
    ]),
    [
      [x.lots[1]?.id, "4.000000"],
      [x.lots[2]?.id, "3.000000"],
    ],
  );
  assert.equal(snap.picking_tasks[0].sources.length, 2);
  const active = await get(
    `/rooms/${x.room}/active-session`,
    x.devices.PICKING,
  );
  assert.equal(active.json().session.access_session_id, s.id);
  await enter(x, s.id);
  for (const t of snap.picking_tasks) await picked(x, s.id, t.id);
  assert.equal((await row("tv1_session", s.id)).state, "PICKING_READY");
  await exit(x, s.id);
  assert.equal((await row("tv1_session", s.id)).state, "CLOSED");
  for (const o of orders)
    assert.equal(
      (await row("tv1_order_status", o)).state,
      "RETIRADA_CONFIRMADA",
    );
  const movements = (await get("/movements")).json().items;
  assert.equal(movements.length, 2);
  for (const m of movements) {
    const t = await row("transacao_estoque", m.transaction_id);
    assert.equal(t.tipo, "retirada");
    assert.ok(t.destino_id);
  }
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.execucao WHERE episodio_id=$1",
        [x.episode],
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
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.transacao_estoque WHERE organizacao_id=$1 AND tipo='consumo'",
        [f.org],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (await get(`/rooms/${x.room}/active-session`, x.devices.PICKING)).json()
      .session,
    null,
  );
});
test("sessão única por sala, origem clínica tipada e entradas do cliente estritas", async () => {
  const x = await fixture();
  const a = await authenticate(x);
  assert.equal(
    (
      await vpost(
        "/withdrawal-contexts",
        {
          auth_session_id: a,
          orders: [],
          adjustments: [
            { product_id: x.product, quantity: "2", sensitive: false },
          ],
        },
        x.devices.ACCESS,
      )
    ).statusCode,
    400,
  );
  const o = await order(x);
  const contexts = await Promise.all(
    [a, await authenticate(x)].map((auth) =>
      vcreate(
        "/withdrawal-contexts",
        { auth_session_id: auth, orders: [o], adjustments: [] },
        x.devices.ACCESS,
      ),
    ),
  );
  const result = await Promise.all(
    contexts.map((context_id) =>
      vpost("/access-sessions", { context_id }, x.devices.ACCESS),
    ),
  );
  assert.deepEqual(result.map((r) => r.statusCode).sort(), [200, 409]);
  const id = result.find((r) => r.statusCode === 200)?.json().id;
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.tv1_session WHERE room_id=$1 AND closed_at IS NULL",
        [x.room],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await get(`/access-sessions/${id}`, {
        ...x.devices.PICKING,
        token: f.adminToken,
      })
    ).statusCode,
    403,
  );
  const y = await clinicalScenario(app, f.adminToken, f.unit);
  assert.equal(
    (
      await vpost("/withdrawal-orders", {
        episode_id: y.episode,
        items: [
          {
            product_id: x.product,
            quantity: "1",
            clinical_order_version_id: x.version,
          },
        ],
      })
    ).statusCode,
    404,
  );
});
test("não encontrado realoca automaticamente e exclui todos os lotes já falhos", async () => {
  const x = await fixture(false, ["10", "10", "10"]);
  const s = await start(x, "3");
  await enter(x, s.id);
  let snap = await snapshot(x, s.id);
  const task = snap.picking_tasks[0].id;
  await picked(x, s.id, task, "NOT_FOUND");
  snap = await snapshot(x, s.id);
  assert.equal(snap.picking_tasks[0].stock_lot_id, x.lots[1]?.id);
  await picked(x, s.id, task, "NOT_FOUND");
  snap = await snapshot(x, s.id);
  assert.equal(snap.picking_tasks[0].stock_lot_id, x.lots[2]?.id);
  const events = (
    await get(`/events?access_session_id=${s.id}&limit=100`)
  ).json().items;
  assert.equal(
    events.filter(
      (e: { type: string; automatic: boolean }) =>
        e.type === "PICKING_LOT_REALLOCATED" && e.automatic,
    ).length,
    2,
  );
  await picked(x, s.id, task);
  await exit(x, s.id);
  assert.equal((await row("tv1_session", s.id)).state, "CLOSED");
  assert.equal(
    (await row("posicao_estoque", x.lots[0]?.position ?? "")).saldo_base,
    "10.000000",
  );
});
test("alternativas insuficientes não fragmentam tarefa; parcial conserva origens e OR não atendida", async () => {
  const x = await fixture(false, ["10", "2", "2"]);
  const orders = [await order(x, "3"), await order(x, "2")];
  const s = await start(x, "0", orders);
  await enter(x, s.id);
  const task = (await snapshot(x, s.id)).picking_tasks[0].id;
  await picked(x, s.id, task, "NOT_FOUND");
  const snap = await snapshot(x, s.id);
  assert.equal(snap.picking_tasks.length, 1);
  assert.equal(snap.picking_tasks[0].status, "EXCEPTION");
  assert.equal(snap.picking_tasks[0].offered_quantity, "2.000000");
  assert.equal((await pick(x, s.id, task, "CONFIRM")).statusCode, 409);
  assert.equal((await physical(x, s.id, "PRESENCE_CLEARED")).statusCode, 409);
  await picked(x, s.id, task, "PARTIAL");
  await exit(x, s.id);
  assert.equal(
    (await row("tv1_order_status", orders[0] ?? "")).state,
    "RETIRADA_PARCIAL",
  );
  assert.equal(
    (await row("tv1_order_status", orders[1] ?? "")).state,
    "RETIRADA_NAO_ATENDIDA",
  );
});
test("sem alternativa resulta em exceção e indisponibilidade explícita, sem movimento", async () => {
  const x = await fixture();
  const s = await start(x);
  await enter(x, s.id);
  const task = (await snapshot(x, s.id)).picking_tasks[0].id;
  await picked(x, s.id, task, "NOT_FOUND");
  assert.equal((await snapshot(x, s.id)).picking_tasks[0].status, "EXCEPTION");
  await picked(x, s.id, task, "UNAVAILABLE");
  await exit(x, s.id);
  assert.equal(
    (await row("tv1_order_status", s.orders[0] ?? "")).state,
    "RETIRADA_NAO_ATENDIDA",
  );
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.tv1_movement WHERE task_id=$1",
        [task],
      )
    ).rows[0].n,
    0,
  );
});
test("PICKING_READY automático pode reabrir antes da saída, nunca depois de PRESENCE_CLEARED", async () => {
  const x = await fixture();
  const s = await start(x);
  await enter(x, s.id);
  const task = (await snapshot(x, s.id)).picking_tasks[0].id;
  await picked(x, s.id, task);
  await picked(x, s.id, task, "UNDO");
  assert.equal((await row("tv1_session", s.id)).state, "ENTRY_CONFIRMED");
  await picked(x, s.id, task);
  await signal(x, s.id, "PRESENCE_CLEARED");
  assert.equal((await pick(x, s.id, task, "UNDO")).statusCode, 409);
  await signal(x, s.id, "DOOR_CLOSED");
  assert.equal((await row("tv1_session", s.id)).state, "CLOSED");
});
test("armário sensível exige toque, abertura, fechamento e trava; mesma autenticação", async () => {
  const x = await fixture(true);
  const s = await start(x);
  await enter(x, s.id);
  const task = (await snapshot(x, s.id)).picking_tasks[0].id;
  assert.equal((await pick(x, s.id, task, "CONFIRM")).statusCode, 409);
  await vcreate(
    `/access-sessions/${s.id}/sensitive-access`,
    {},
    x.devices.PICKING,
  );
  assert.equal((await row("tv1_session", s.id)).sensitive_state, "GRANTED");
  await signal(x, s.id, "SENSITIVE_DOOR_OPENED");
  await picked(x, s.id, task);
  assert.equal((await row("tv1_session", s.id)).state, "ENTRY_CONFIRMED");
  assert.equal(
    (await physical(x, s.id, "SENSITIVE_LOCK_CONFIRMED")).statusCode,
    409,
  );
  await signal(x, s.id, "SENSITIVE_DOOR_CLOSED");
  await signal(x, s.id, "SENSITIVE_LOCK_CONFIRMED");
  assert.equal((await row("tv1_session", s.id)).state, "PICKING_READY");
  await picked(x, s.id, task, "UNDO");
  assert.equal((await row("tv1_session", s.id)).sensitive_state, "LOCKED");
  await vcreate(
    `/access-sessions/${s.id}/sensitive-access`,
    {},
    x.devices.PICKING,
  );
  await signal(x, s.id, "SENSITIVE_DOOR_OPENED");
  await picked(x, s.id, task);
  await signal(x, s.id, "SENSITIVE_DOOR_CLOSED");
  await signal(x, s.id, "SENSITIVE_LOCK_CONFIRMED");
  await exit(x, s.id);
  assert.equal((await row("tv1_session", s.id)).state, "CLOSED");
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.tv1_auth WHERE id=$1",
        [s.auth],
      )
    ).rows[0].n,
    1,
  );
});
test("reserva física não pode ser liberada por endpoint M2 enquanto sessão está ativa", async () => {
  const x = await fixture();
  const s = await start(x);
  const task = (await snapshot(x, s.id)).picking_tasks[0].id;
  const attempt = (await get(`/attempts?task_id=${task}`)).json().items[0];
  const r = await post(`/estoque/reservas/${attempt.reservation_id}/liberar`, {
    motivo: "Não pode roubar reserva Terminal",
  });
  assert.equal(r.statusCode, 409, r.body);
  assert.equal(
    (await row("reserva", attempt.reservation_id)).situacao,
    "ativa",
  );
});
test("erro técnico preserva DOOR_CLOSED e recovery confirma sem nova retirada", async () => {
  const x = await fixture();
  const s = await start(x);
  await enter(x, s.id);
  const task = (await snapshot(x, s.id)).picking_tasks[0].id;
  await picked(x, s.id, task);
  await signal(x, s.id, "PRESENCE_CLEARED");
  // Fault injection scoped to this synthetic test session, never a production hook.
  await admin.query(
    `CREATE FUNCTION hvb.tv1_test_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.task_id='${task}'::uuid THEN RAISE EXCEPTION 'synthetic fault'; END IF; RETURN NEW; END $$; CREATE TRIGGER tv1_test_fault BEFORE INSERT ON hvb.tv1_movement FOR EACH ROW EXECUTE FUNCTION hvb.tv1_test_fault()`,
  );
  try {
    await signal(x, s.id, "DOOR_CLOSED");
  } finally {
    await admin.query(
      "DROP TRIGGER tv1_test_fault ON hvb.tv1_movement; DROP FUNCTION hvb.tv1_test_fault()",
    );
  }
  const failed = await row("tv1_session", s.id);
  assert.equal(failed.state, "READY_TO_CONFIRM");
  assert.ok(failed.door_closed_at);
  const errors = (await get(`/events?access_session_id=${s.id}&limit=100`))
    .json()
    .items.filter(
      (e: { type: string }) => e.type === "WITHDRAWAL_CONFIRMATION_FAILED",
    );
  assert.equal(errors.length, 1);
  assert.equal(
    (await row("posicao_estoque", x.lots[0]?.position ?? "")).saldo_base,
    "20.000000",
  );
  await vcreate(`/access-sessions/${s.id}/recover`, {}, x.devices.CONTROLLER);
  assert.equal((await row("tv1_session", s.id)).state, "CLOSED");
  assert.equal(
    (await row("tv1_session", s.id)).door_closed_at.toISOString(),
    failed.door_closed_at.toISOString(),
  );
  await vcreate(`/access-sessions/${s.id}/recover`, {}, x.devices.CONTROLLER);
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.tv1_movement WHERE task_id=$1",
        [task],
      )
    ).rows[0].n,
    1,
  );
});
test("idempotência recursiva e eventos físicos reentregues não duplicam confirmação", async () => {
  const x = await fixture();
  const s = await start(x);
  await enter(x, s.id);
  const task = (await snapshot(x, s.id)).picking_tasks[0].id;
  await picked(x, s.id, task);
  await signal(x, s.id, "PRESENCE_CLEARED");
  const body = {
      type: "DOOR_CLOSED",
      event_id: randomUUID(),
      occurred_at: new Date().toISOString(),
    },
    key = randomUUID();
  const results = await Promise.all([
    vpost(
      `/access-sessions/${s.id}/physical-events`,
      body,
      x.devices.CONTROLLER,
      key,
    ),
    vpost(
      `/access-sessions/${s.id}/physical-events`,
      {
        occurred_at: body.occurred_at,
        event_id: body.event_id,
        type: body.type,
      },
      x.devices.CONTROLLER,
      key,
    ),
  ]);
  assert.ok(results.every((r) => r.statusCode === 200));
  assert.equal(results.filter((r) => r.json().repetido).length, 1);
  assert.equal(
    (
      await vpost(
        `/access-sessions/${s.id}/physical-events`,
        body,
        x.devices.CONTROLLER,
      )
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await vpost(
        `/access-sessions/${s.id}/physical-events`,
        { ...body, type: "DOOR_OPEN" },
        x.devices.CONTROLLER,
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await vpost(
        `/access-sessions/${s.id}/physical-events`,
        { ...body, type: "DOOR_OPEN" },
        x.devices.CONTROLLER,
        key,
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.tv1_movement WHERE task_id=$1",
        [task],
      )
    ).rows[0].n,
    1,
  );
});
test("RLS, trilha imutável e projeção protegida no banco", async () => {
  const x = await fixture();
  const s = await start(x);
  await transaction(db, other.org, async (tx) => {
    assert.equal(
      (await tx.query("SELECT id FROM tv1_session WHERE id=$1", [s.id]))
        .rowCount,
      0,
    );
  });
  await assert.rejects(
    transaction(db, f.org, (tx) =>
      tx.query(
        "UPDATE tv1_session SET state='EXPIRED',closed_at=clock_timestamp() WHERE id=$1",
        [s.id],
      ),
    ),
  );
  await assert.rejects(
    transaction(db, f.org, (tx) =>
      tx.query("DELETE FROM tv1_event WHERE access_session_id=$1", [s.id]),
    ),
  );
});

// Advance only synthetic TEST facts, in a transaction whose local trigger mode
// is restored at commit. No production time override or application bypass.
async function elapsed(id: string, cabinet = false) {
  const tx = await admin.connect();
  try {
    await tx.query("BEGIN");
    await tx.query("SET LOCAL session_replication_role=replica");
    await tx.query(
      cabinet
        ? "UPDATE hvb.tv1_session SET unlock_until=clock_timestamp()-interval '1 second' WHERE id=$1"
        : "UPDATE hvb.tv1_session SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [id],
    );
    if (!cabinet)
      await tx.query(
        `UPDATE hvb.reserva SET expira_em=clock_timestamp()-interval '1 second' WHERE id IN (
      SELECT a.reservation_id FROM hvb.tv1_attempt a JOIN hvb.tv1_task t ON t.id=a.task_id WHERE t.access_session_id=$1)`,
        [id],
      );
    await tx.query("COMMIT");
  } catch (error) {
    await tx.query("ROLLBACK");
    throw error;
  } finally {
    tx.release();
  }
}
test("timeout pré-entrada falha fechado, libera reservas e permite retomar a mesma OR", async () => {
  const x = await fixture();
  const s = await start(x);
  await elapsed(s.id);
  await signal(x, s.id, "DOOR_OPEN");
  assert.equal((await row("tv1_session", s.id)).state, "EXPIRED");
  assert.equal(
    (await row("posicao_estoque", x.lots[0]?.position ?? "")).reservado_base,
    "0.000000",
  );
  const next = await start(x, "2", s.orders);
  await enter(x, next.id);
  const task = (await snapshot(x, next.id)).picking_tasks[0].id;
  await picked(x, next.id, task);
  await exit(x, next.id);
  assert.equal(
    (await row("tv1_order_status", s.orders[0] ?? "")).state,
    "RETIRADA_CONFIRMADA",
  );
});
test("timeout com presença mantém sala e reservas protegidas; alerta único e conclusão após lease", async () => {
  const x = await fixture();
  const s = await start(x);
  await enter(x, s.id);
  await elapsed(s.id);
  await vcreate(`/access-sessions/${s.id}/recover`, {}, x.devices.CONTROLLER);
  await vcreate(`/access-sessions/${s.id}/recover`, {}, x.devices.CONTROLLER);
  assert.equal((await row("tv1_session", s.id)).state, "ENTRY_CONFIRMED");
  assert.ok((await row("tv1_session", s.id)).timeout_alerted_at);
  const auth = await authenticate(x),
    orderId = await order(x);
  const context = await vcreate(
    "/withdrawal-contexts",
    { auth_session_id: auth, orders: [orderId], adjustments: [] },
    x.devices.ACCESS,
  );
  assert.equal(
    (await vpost("/access-sessions", { context_id: context }, x.devices.ACCESS))
      .statusCode,
    409,
  );
  const task = (await snapshot(x, s.id)).picking_tasks[0].id,
    attempt = (await get(`/attempts?task_id=${task}`)).json().items[0];
  assert.equal(
    (
      await post(`/estoque/reservas/${attempt.reservation_id}/expirar`, {
        motivo: "Tentativa TEST de expirar durante presença",
      })
    ).statusCode,
    409,
  );
  await picked(x, s.id, task);
  await exit(x, s.id);
  assert.equal((await row("tv1_session", s.id)).state, "CLOSED");
  assert.equal(
    (
      await admin.query(
        "SELECT count(*)::int n FROM hvb.tv1_event WHERE access_session_id=$1 AND type='ACCESS_TIMEOUT_ALERTED'",
        [s.id],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (await row("reserva", attempt.reservation_id)).situacao,
    "liberada",
  );
});
test("funcionário sem poder sensível é recusado mesmo com dispositivo autorizado", async () => {
  const user = await create("/usuarios", {
    nome: "Colaborador sem poder sensível",
    login: `c18.${randomBytes(8).toString("hex")}`,
  });
  const role = await create("/papeis", {
    nome: "Acesso comum C18",
    permissoes: ["terminal:acessar"],
  });
  await create("/atribuicoes", {
    usuario_id: user,
    papel_id: role,
    unidade_id: f.unit,
  });
  const x = await fixture(true, ["20"], ["2099-01-01"], user);
  const auth = await authenticate(x),
    orderId = await order(x);
  const context = await vcreate(
    "/withdrawal-contexts",
    { auth_session_id: auth, orders: [orderId], adjustments: [] },
    x.devices.ACCESS,
  );
  assert.equal(
    (await vpost("/access-sessions", { context_id: context }, x.devices.ACCESS))
      .statusCode,
    403,
  );
  assert.equal(
    (await row("posicao_estoque", x.lots[0]?.position ?? "")).reservado_base,
    "0.000000",
  );
});
test("janela sensível vencida não presume trava; fechamento com itens pendentes permite nova abertura", async () => {
  const x = await fixture(true);
  const s = await start(x);
  await enter(x, s.id);
  await vcreate(
    `/access-sessions/${s.id}/sensitive-access`,
    {},
    x.devices.PICKING,
  );
  await elapsed(s.id, true);
  assert.equal(
    (await physical(x, s.id, "SENSITIVE_DOOR_OPENED")).statusCode,
    409,
  );
  await vcreate(`/access-sessions/${s.id}/recover`, {}, x.devices.CONTROLLER);
  assert.equal((await row("tv1_session", s.id)).sensitive_state, "GRANTED");
  await signal(x, s.id, "SENSITIVE_DOOR_CLOSED");
  await signal(x, s.id, "SENSITIVE_LOCK_CONFIRMED");
  assert.equal((await row("tv1_session", s.id)).sensitive_state, "LOCKED");
  await vcreate(
    `/access-sessions/${s.id}/sensitive-access`,
    {},
    x.devices.PICKING,
  );
  await signal(x, s.id, "SENSITIVE_DOOR_OPENED");
  await signal(x, s.id, "SENSITIVE_DOOR_CLOSED");
  await signal(x, s.id, "SENSITIVE_LOCK_CONFIRMED");
  assert.equal((await row("tv1_session", s.id)).sensitive_state, "LOCKED");
  await vcreate(
    `/access-sessions/${s.id}/sensitive-access`,
    {},
    x.devices.PICKING,
  );
  await signal(x, s.id, "SENSITIVE_DOOR_OPENED");
  await picked(x, s.id, (await snapshot(x, s.id)).picking_tasks[0].id);
  await signal(x, s.id, "SENSITIVE_DOOR_CLOSED");
  await signal(x, s.id, "SENSITIVE_LOCK_CONFIRMED");
  await exit(x, s.id);
  assert.equal((await row("tv1_session", s.id)).state, "CLOSED");
});
test("picking comum fica suspenso durante acesso sensível; catálogo é autoridade", async () => {
  const x = await fixture(true),
    y = await clinicalScenario(app, f.adminToken, f.unit);
  await vcreate("/product-policies", {
    product_id: y.product,
    sensitive: false,
  });
  const auth = await authenticate(x),
    o = await order(x);
  const context = await vcreate(
    "/withdrawal-contexts",
    {
      auth_session_id: auth,
      orders: [o],
      adjustments: [{ product_id: y.product, quantity: "1" }],
    },
    x.devices.ACCESS,
  );
  const id = await vcreate(
    "/access-sessions",
    { context_id: context },
    x.devices.ACCESS,
  );
  await enter(x, id);
  const tasks = (await snapshot(x, id)).picking_tasks,
    commonTask = tasks.find((t: { sensitive: boolean }) => !t.sensitive);
  await vcreate(
    `/access-sessions/${id}/sensitive-access`,
    {},
    x.devices.PICKING,
  );
  assert.equal(
    (await pick(x, id, commonTask.id, "UNAVAILABLE")).statusCode,
    409,
  );
  await signal(x, id, "SENSITIVE_DOOR_OPENED");
  assert.equal(
    (await pick(x, id, commonTask.id, "UNAVAILABLE")).statusCode,
    409,
  );
  await picked(
    x,
    id,
    tasks.find((t: { sensitive: boolean }) => t.sensitive).id,
  );
  await signal(x, id, "SENSITIVE_DOOR_CLOSED");
  await signal(x, id, "SENSITIVE_LOCK_CONFIRMED");
  await picked(x, id, commonTask.id, "UNAVAILABLE");
  await exit(x, id);
  assert.equal((await row("tv1_session", id)).state, "CLOSED");
});
test("reservas M2 concorrentes com alocação Terminal nunca excedem o saldo", async () => {
  const x = await fixture(false, ["5"]),
    auth = await authenticate(x),
    o = await order(x, "5");
  const context = await vcreate(
    "/withdrawal-contexts",
    { auth_session_id: auth, orders: [o], adjustments: [] },
    x.devices.ACCESS,
  );
  const [terminal, reserveResult] = await Promise.all([
    vpost("/access-sessions", { context_id: context }, x.devices.ACCESS),
    post("/estoque/reservas", {
      posicao_id: x.lots[0]?.position,
      quantidade_base: "5",
      expira_em: new Date(Date.now() + 3600000).toISOString(),
      motivo: "Reserva concorrente fictícia",
    }),
  ]);
  assert.equal(terminal.statusCode, 200, terminal.body);
  assert.ok([200, 409].includes(reserveResult.statusCode), reserveResult.body);
  const p = await row("posicao_estoque", x.lots[0]?.position ?? "");
  assert.equal(p.reservado_base, "5.000000");
  assert.equal(p.disponivel_base, "0.000000");
  const tasks = (await snapshot(x, terminal.json().id)).picking_tasks;
  assert.equal(
    tasks[0].status,
    reserveResult.statusCode === 200 ? "EXCEPTION" : "PENDING",
  );
});
test("coordenadas livres independem do produto e não aceitam mistura de lotes", async () => {
  const x = await fixture();
  const coordinate = await vcreate("/coordinates", {
    room_id: x.room,
    code: "LIVRE",
    sensitive: false,
  });
  const list = await get(
    `/rooms/${x.room}/free-coordinates?product_id=${x.product}`,
  );
  assert.equal(list.statusCode, 200, list.body);
  assert.deepEqual(
    list.json().items.map((r: { id: string }) => r.id),
    [coordinate],
  );
  const occupied = await row("tv1_coordinate", x.lots[0]?.coordinate ?? "");
  const r = await post("/estoque/posicoes", {
    local_id: occupied.local_id,
    lote_id: x.lot,
    custodia_id: hospital,
  });
  assert.equal(r.statusCode, 409, r.body);
  assert.equal(
    (await vpost(`/occupancies/${x.lots[0]?.occupancy}/release`)).statusCode,
    404,
  );
  const s = await start(x);
  await enter(x, s.id);
  const task = (await snapshot(x, s.id)).picking_tasks[0].id;
  assert.equal(
    (
      await vpost(
        `/access-sessions/${s.id}/picking-events`,
        {
          task_id: task,
          type: "CONFIRM",
          event_id: randomUUID(),
          occurred_at: new Date().toISOString(),
          quantity: "999",
        },
        x.devices.PICKING,
      )
    ).statusCode,
    400,
  );
});
test("revogação da credencial do dispositivo bloqueia novas entregas e replay", async () => {
  const x = await fixture(),
    key = randomUUID(),
    body = { room_id: x.room, tag: x.tag };
  assert.equal(
    (await vpost("/nfc", body, x.devices.ACCESS, key)).statusCode,
    200,
  );
  await create(`/credenciais/${x.devices.ACCESS.credential}/revogar`, {
    motivo: "Revogação sintética C18",
  });
  assert.equal(
    (await vpost("/nfc", body, x.devices.ACCESS, key)).statusCode,
    401,
  );
});
