import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
const admin = randomBytes(32).toString("hex"),
  app = randomBytes(32).toString("hex"),
  worker = randomBytes(32).toString("hex");
const url = (u, p, d) => `postgresql://${u}:${p}@127.0.0.1:55432/${d}`;
await writeFile(
  ".env",
  [
    "NODE_ENV=development",
    "HOST=127.0.0.1",
    "PORT=3100",
    `POSTGRES_PASSWORD=${admin}`,
    `MIGRATION_DATABASE_URL=${url("hvb_dev_admin", admin, "hvb_sistema_dev")}`,
    `DATABASE_URL=${url("hvb_app", app, "hvb_sistema_dev")}`,
    `WORKER_DATABASE_URL=${url("hvb_worker", worker, "hvb_sistema_dev")}`,
    `TEST_MIGRATION_DATABASE_URL=${url("hvb_dev_admin", admin, "hvb_sistema_test")}`,
    `TEST_DATABASE_URL=${url("hvb_app", app, "hvb_sistema_test")}`,
    `TEST_WORKER_DATABASE_URL=${url("hvb_worker", worker, "hvb_sistema_test")}`,
    "",
  ].join("\n"),
  { flag: "wx", mode: 0o600 },
);
console.log(".env gerado para Docker/CI. Nenhum segredo foi impresso.");
