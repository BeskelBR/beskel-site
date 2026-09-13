import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { buildApp } from "../src/api/app.ts";
import { pool } from "../src/persistence/database.ts";
import { runBatch } from "../src/worker/outbox.ts";
const fixture = JSON.parse(
  await readFile(".local/dev-access.json", "utf8"),
) as { adminToken: string };
const db = pool(process.env.DATABASE_URL ?? "", 5),
  worker = pool(process.env.WORKER_DATABASE_URL ?? "", 3);
const app = await buildApp(db);
try {
  const address = await app.listen({ host: "127.0.0.1", port: 0 });
  const health = await fetch(`${address}/health`),
    ready = await fetch(`${address}/ready`);
  assert.equal(health.status, 200);
  assert.equal(ready.status, 200);
  const headers = {
    authorization: `Bearer ${fixture.adminToken}`,
    "content-type": "application/json",
    "idempotency-key": randomUUID(),
  };
  const body = JSON.stringify({
    nome: "Paciente Fictício HTTP",
    especie_codigo: "canina",
    estado_vital: "desconhecido",
  });
  const response = await fetch(`${address}/v1/pacientes`, {
    method: "POST",
    headers,
    body,
  });
  assert.equal(response.status, 200);
  const created = (await response.json()) as { id: string };
  const repeat = await fetch(`${address}/v1/pacientes`, {
    method: "POST",
    headers,
    body,
  });
  assert.equal(repeat.status, 200);
  const replay = (await repeat.json()) as { id: string; repetido: boolean };
  assert.equal(created.id, replay.id);
  assert.equal(replay.repetido, true);
  const malformed = await fetch(`${address}/v1/pacientes`, {
    method: "POST",
    headers,
    body: '{"invalid":',
  });
  assert.equal(malformed.status, 400);
  const denied = await fetch(`${address}/v1/me`);
  assert.equal(denied.status, 401);
  const count = await runBatch(worker);
  const result = {
    executed_at: new Date().toISOString(),
    transport: "HTTP real em loopback, porta efêmera",
    health: health.status,
    ready: ready.status,
    create: response.status,
    replay: repeat.status,
    replay_same_id: true,
    malformed_json: malformed.status,
    unauthenticated: denied.status,
    worker_claimed: count,
  };
  await writeFile(
    "docs/evidencias/http-smoke.json",
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await app.close();
  await db.end();
  await worker.end();
}
