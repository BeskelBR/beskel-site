import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

if (process.platform !== "win32")
  throw new Error("Use Docker Compose em Linux/macOS; consulte README.");
const { initdb, pg_ctl } = await import("@embedded-postgres/windows-x64");
const verification = process.argv.includes("--verification");
const port = verification ? 55433 : 55432;
const envFile = verification ? ".local/verification.env" : ".env";
const root = path.resolve(
  verification ? ".local/verification-postgres" : ".local/postgres",
);
const data = path.join(root, "data");
await mkdir(root, { recursive: true });
function run(binary, args) {
  const r = spawnSync(binary, args, {
    windowsHide: true,
    encoding: "utf8",
    timeout: 60000,
  });
  if (r.status !== 0)
    throw new Error(
      `${path.basename(binary)}: ${r.stderr || r.stdout || r.error}`,
    );
}
if (process.argv[2] === "stop") {
  run(pg_ctl, ["-D", data, "-m", "fast", "-w", "stop"]);
  console.log("PostgreSQL DEV parado; dados preservados.");
} else {
  const exists = await access(path.join(data, "PG_VERSION")).then(
    () => true,
    () => false,
  );
  const envExists = await access(envFile).then(
    () => true,
    () => false,
  );
  if (exists && !envExists)
    throw new Error(
      "Cluster existente sem .env. Recupere a configuração; não reinicialize.",
    );
  if (!exists) {
    if (envExists)
      throw new Error(
        ".env já existe. Use a configuração existente ou preserve-a antes de inicializar.",
      );
    const admin = randomBytes(32).toString("hex");
    const app = randomBytes(32).toString("hex");
    const worker = randomBytes(32).toString("hex");
    const pwfile = path.join(root, "init-password");
    await writeFile(pwfile, admin, { mode: 0o600 });
    run(initdb, [
      "-D",
      data,
      "-U",
      "hvb_dev_admin",
      "--auth=scram-sha-256",
      "--pwfile",
      pwfile,
      "-E",
      "UTF8",
      "--locale=C",
    ]);
    const makeUrl = (user, password, db) =>
      `postgresql://${user}:${password}@127.0.0.1:${port}/${db}`;
    await writeFile(
      envFile,
      [
        "NODE_ENV=development",
        "HOST=127.0.0.1",
        "PORT=3100",
        `MIGRATION_DATABASE_URL=${makeUrl("hvb_dev_admin", admin, "hvb_sistema_dev")}`,
        `DATABASE_URL=${makeUrl("hvb_app", app, "hvb_sistema_dev")}`,
        `WORKER_DATABASE_URL=${makeUrl("hvb_worker", worker, "hvb_sistema_dev")}`,
        `TEST_MIGRATION_DATABASE_URL=${makeUrl("hvb_dev_admin", admin, "hvb_sistema_test")}`,
        `TEST_DATABASE_URL=${makeUrl("hvb_app", app, "hvb_sistema_test")}`,
        `TEST_WORKER_DATABASE_URL=${makeUrl("hvb_worker", worker, "hvb_sistema_test")}`,
        "",
      ].join("\n"),
      { mode: 0o600, flag: "wx" },
    );
  }
  const status = spawnSync(pg_ctl, ["-D", data, "status"], {
    windowsHide: true,
  });
  if (status.status !== 0)
    run(pg_ctl, [
      "-D",
      data,
      "-l",
      path.join(root, "server.log"),
      "-o",
      `-h 127.0.0.1 -p ${port} -c max_connections=30`,
      "-w",
      "start",
    ]);
  const env = Object.fromEntries(
    (await readFile(envFile, "utf8"))
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => [
        line.slice(0, line.indexOf("=")),
        line.slice(line.indexOf("=") + 1),
      ]),
  );
  const adminUrl = new URL(env.MIGRATION_DATABASE_URL);
  adminUrl.pathname = "/postgres";
  const client = new pg.Client({ connectionString: adminUrl.href });
  await client.connect();
  try {
    for (const [role, key] of [
      ["hvb_app", "DATABASE_URL"],
      ["hvb_worker", "WORKER_DATABASE_URL"],
    ]) {
      const password = new URL(env[key]).password;
      if (!/^[a-f0-9]{64}$/.test(password))
        throw new Error("Senha local não gerada por este bootstrap.");
      const found = await client.query(
        "SELECT 1 FROM pg_roles WHERE rolname=$1",
        [role],
      );
      if (!found.rowCount)
        await client.query(
          `CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`,
        );
    }
    for (const name of ["hvb_sistema_dev", "hvb_sistema_test"]) {
      const found = await client.query(
        "SELECT 1 FROM pg_database WHERE datname=$1",
        [name],
      );
      if (!found.rowCount) await client.query(`CREATE DATABASE ${name}`);
      await client.query(`REVOKE ALL ON DATABASE ${name} FROM PUBLIC`);
      await client.query(
        `GRANT CONNECT ON DATABASE ${name} TO hvb_app,hvb_worker`,
      );
    }
  } finally {
    await client.end();
  }
  console.log(
    `PostgreSQL DEV em 127.0.0.1:${port}. Segredos salvos somente em ${envFile} ignorado pelo Git.`,
  );
}
