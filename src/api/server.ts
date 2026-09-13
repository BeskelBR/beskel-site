import { buildApp } from "./app.ts";
import { pool } from "../persistence/database.ts";
if (process.env.NODE_ENV === "production")
  throw new Error("Produção não autorizada neste lote.");
const host = process.env.HOST ?? "127.0.0.1";
if (!["127.0.0.1", "::1", "localhost"].includes(host))
  throw new Error("API DEV restrita a loopback.");
const db = pool(process.env.DATABASE_URL ?? "");
const app = await buildApp(db, true);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await app.close();
    await db.end();
  });
await app.listen({ host, port: Number(process.env.PORT ?? 3100) });
