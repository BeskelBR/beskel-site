import { writeFile, mkdir } from "node:fs/promises";
import { pool } from "../src/persistence/database.ts";
import { buildApp } from "../src/api/app.ts";
const db = pool(
  "postgresql://unused:unused@127.0.0.1:55432/hvb_sistema_dev",
  1,
);
const app = await buildApp(db);
await mkdir("openapi", { recursive: true });
await writeFile(
  "openapi/hvb-sistema.json",
  `${JSON.stringify(app.swagger(), null, 2)}\n`,
);
await app.close();
await db.end();
console.log("OpenAPI gerado dos schemas executados pela API.");
