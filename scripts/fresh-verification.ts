import assert from "node:assert/strict";
import path from "node:path";
import { pool } from "../src/persistence/database.ts";
// Only the additional verification cluster. Preserve the previous synthetic database by renaming it.
const url = process.env.MIGRATION_DATABASE_URL ?? "";
assert.equal(new URL(url).port, "55433");
const db = pool(url, 1);
try {
  const directory = (await db.query("SHOW data_directory")).rows[0]
    .data_directory as string;
  assert.equal(
    path.resolve(directory).toLowerCase(),
    path.resolve(".local/verification-postgres/data").toLowerCase(),
  );
  const previous = `hvb_sistema_test_previous_${Date.now()}`;
  const exists = await db.query(
    "SELECT 1 FROM pg_database WHERE datname='hvb_sistema_test'",
  );
  if (exists.rowCount)
    await db.query(`ALTER DATABASE hvb_sistema_test RENAME TO ${previous}`);
  await db.query("CREATE DATABASE hvb_sistema_test");
  await db.query("REVOKE ALL ON DATABASE hvb_sistema_test FROM PUBLIC");
  await db.query(
    "GRANT CONNECT ON DATABASE hvb_sistema_test TO hvb_app,hvb_worker",
  );
  console.log(
    `TEST vazio criado no cluster de verificação; anterior preservado como ${previous}.`,
  );
} finally {
  await db.end();
}
