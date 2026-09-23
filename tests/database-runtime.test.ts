import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { pool, localUrl, transaction } from "../src/persistence/database.ts";
import { buildApp } from "../src/api/app.ts";
import { seedFixture } from "../scripts/seed.ts";

let db: pg.Pool, admin: pg.Pool, app: FastifyInstance;
let fixture: Awaited<ReturnType<typeof seedFixture>>;
let foreign: typeof fixture;

before(async () => {
  const url = localUrl(process.env.TEST_MIGRATION_DATABASE_URL);
  assert.equal(new URL(url).pathname, "/hvb_sistema_test");
  const runtimeUrl = localUrl(process.env.TEST_DATABASE_URL);
  assert.equal(new URL(runtimeUrl).pathname, "/hvb_sistema_test");
  admin = pool(url, 1);
  db = pool(runtimeUrl, 1);
  // Existing TEST schema only: no migrate/DDL bootstrap in this suite.
  fixture = await seedFixture(url);
  foreign = await seedFixture(url);
  app = await buildApp(db);
});
after(async () => {
  await app?.close();
  await Promise.all([db?.end(), admin?.end()]);
});

test("local: health/ready, Bearer opaco, contexto e recusa de JWT", async () => {
  assert.equal((await app.inject("/health")).statusCode, 200);
  assert.equal((await app.inject("/ready")).statusCode, 200);
  assert.equal((await app.inject("/v1/me")).statusCode, 401);
  assert.equal(
    (
      await app.inject({
        url: "/v1/me",
        headers: { authorization: "Bearer fake.jwt.token" },
      })
    ).statusCode,
    401,
  );
  const response = await app.inject({
    url: "/v1/me/contexto",
    headers: { authorization: `Bearer ${fixture.adminToken}` },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().organizacao_id, fixture.org);
  assert.equal(response.json().usuario_id, fixture.admin);
});

test("search_path e tenant locais à transação, RLS e reutilização da conexão", async () => {
  await db.query("SET search_path=pg_catalog");
  await db.query("SELECT set_config('hvb.org','',false)");
  for (const org of [fixture.org, foreign.org]) {
    await transaction(db, org, async (tx) => {
      const context = await tx.query(
        "SELECT current_setting('search_path') AS path, current_setting('hvb.org') AS org",
      );
      assert.deepEqual(context.rows[0], { path: "hvb,public", org });
      const visible = await tx.query(
        "SELECT DISTINCT organizacao_id FROM usuario",
      );
      assert.deepEqual(
        visible.rows.map((r) => r.organizacao_id),
        [org],
      );
      const denied = await tx.query(
        "SELECT id FROM usuario WHERE organizacao_id=$1",
        [org === fixture.org ? foreign.org : fixture.org],
      );
      assert.equal(denied.rowCount, 0);
    });
    const outside = await db.query(
      "SELECT current_setting('search_path') AS path, current_setting('hvb.org',true) AS org",
    );
    assert.deepEqual(outside.rows[0], { path: "pg_catalog", org: "" });
  }
});

test("rollback desfaz escrita e contexto; próxima transação continua íntegra", async () => {
  const id = randomUUID();
  await assert.rejects(
    transaction(db, fixture.org, async (tx) => {
      await tx.query(
        "INSERT INTO responsavel(id,organizacao_id,nome) VALUES($1,$2,'Sintético rollback')",
        [id, fixture.org],
      );
      throw new Error("falha sintética");
    }),
    /falha sintética/,
  );
  const outside = await db.query(
    "SELECT current_setting('search_path') AS path, current_setting('hvb.org',true) AS org",
  );
  assert.deepEqual(outside.rows[0], { path: "pg_catalog", org: "" });
  await transaction(db, fixture.org, async (tx) => {
    assert.equal(
      (await tx.query("SELECT id FROM responsavel WHERE id=$1", [id])).rowCount,
      0,
    );
  });
});

test("ready aceita herança efetiva; recusa NOINHERIT, sem acesso e privilégios elevados", async () => {
  const tx = await admin.connect();
  const role = `hvb_test_${randomUUID().replaceAll("-", "")}`;
  // Role and grants are synthetic, NOLOGIN, and rolled back even on failure.
  const scopedApp = await buildApp({
    query: tx.query.bind(tx),
  } as unknown as pg.Pool);
  try {
    await tx.query("BEGIN");
    await tx.query(
      `CREATE ROLE ${role} NOLOGIN INHERIT NOSUPERUSER NOBYPASSRLS`,
    );
    await tx.query(`GRANT hvb_app TO ${role}`);
    await tx.query(`SET LOCAL ROLE ${role}`);
    assert.equal((await scopedApp.inject("/ready")).statusCode, 200);
    await tx.query("RESET ROLE");
    await tx.query(`REVOKE hvb_app FROM ${role}`);
    await tx.query(`ALTER ROLE ${role} NOINHERIT`);
    await tx.query(`GRANT hvb_app TO ${role} WITH INHERIT FALSE`);
    await tx.query(`SET LOCAL ROLE ${role}`);
    await tx.query("SAVEPOINT missing_access");
    assert.equal((await scopedApp.inject("/ready")).statusCode, 503);
    await tx.query("ROLLBACK TO SAVEPOINT missing_access");
    await tx.query("RESET ROLE");
    await tx.query(`REVOKE hvb_app FROM ${role}`);
    await tx.query(`ALTER ROLE ${role} INHERIT BYPASSRLS`);
    await tx.query(`GRANT hvb_app TO ${role}`);
    await tx.query(`SET LOCAL ROLE ${role}`);
    assert.equal((await scopedApp.inject("/ready")).statusCode, 503);
    await tx.query("RESET ROLE");
    assert.equal((await scopedApp.inject("/ready")).statusCode, 503);
  } finally {
    await tx.query("ROLLBACK");
    tx.release();
    await scopedApp.close();
  }
  assert.equal(
    (await admin.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role]))
      .rowCount,
    0,
  );
});
