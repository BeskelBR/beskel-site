import { pool, localUrl } from "../src/persistence/database.ts";
const url = localUrl(process.env.MIGRATION_DATABASE_URL);
const db = pool(url, 1);
try {
  for (const [role, key] of [
    ["hvb_app", "DATABASE_URL"],
    ["hvb_worker", "WORKER_DATABASE_URL"],
  ] as const) {
    const password = new URL(localUrl(process.env[key])).password;
    if (!/^[a-f0-9]{64}$/.test(password))
      throw new Error("Gere .env com scripts/configure-env.mjs.");
    const r = await db.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role]);
    if (!r.rowCount)
      await db.query(
        `CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`,
      );
  }
  const r = await db.query(
    "SELECT 1 FROM pg_database WHERE datname='hvb_sistema_test'",
  );
  if (!r.rowCount) await db.query("CREATE DATABASE hvb_sistema_test");
  for (const name of ["hvb_sistema_dev", "hvb_sistema_test"]) {
    await db.query(`REVOKE ALL ON DATABASE ${name} FROM PUBLIC`);
    await db.query(`GRANT CONNECT ON DATABASE ${name} TO hvb_app,hvb_worker`);
  }
} finally {
  await db.end();
}
console.log("Papéis limitados e banco TEST criados/verificados.");
