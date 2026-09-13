import { setTimeout } from "node:timers/promises";
import { pool } from "../persistence/database.ts";
import { runBatch } from "./outbox.ts";
const db = pool(process.env.WORKER_DATABASE_URL ?? "", 3);
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopping = true;
  });
try {
  do {
    const count = await runBatch(db);
    console.log(
      JSON.stringify({
        event: "outbox_batch",
        claimed: count,
        consumer: "local-foundation-v1",
      }),
    );
    if (process.argv.includes("--once")) break;
    if (!stopping) await setTimeout(2000);
  } while (!stopping);
} finally {
  await db.end();
}
