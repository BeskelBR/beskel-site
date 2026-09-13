import pg from "pg";
import type { PoolClient } from "pg";
import { setTimeout } from "node:timers/promises";

export function localUrl(value: string | undefined): string {
  if (!value) throw new Error("Configure uma URL de banco DEV local.");
  const url = new URL(value);
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !/^\/hvb_sistema_(dev|test)$/.test(url.pathname)
  ) {
    throw new Error("M0/M1 permite somente hvb_sistema_dev/test em loopback.");
  }
  return value;
}
export function pool(url: string, max = 5): pg.Pool {
  return new pg.Pool({
    connectionString: localUrl(url),
    max,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000,
    statement_timeout: 5000,
    lock_timeout: 2000,
    idle_in_transaction_session_timeout: 5000,
    options: "-c search_path=hvb,public",
    application_name: "hvb-sistema-dev",
  });
}
export async function transaction<T>(
  db: pg.Pool,
  org: string,
  work: (tx: PoolClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const tx = await db.connect();
    try {
      await tx.query("BEGIN");
      await tx.query("SELECT set_config('hvb.org',$1,true)", [org]);
      const result = await work(tx);
      await tx.query("COMMIT");
      return result;
    } catch (error) {
      await tx.query("ROLLBACK");
      if (
        attempt >= 2 ||
        !["40P01", "40001"].includes((error as { code?: string }).code ?? "")
      )
        throw error;
    } finally {
      tx.release();
    }
    await setTimeout(20 * (attempt + 1));
  }
}
