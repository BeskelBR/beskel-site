import pg from "pg";
import type { PoolClient } from "pg";
import { setTimeout } from "node:timers/promises";

function databaseUrl(value: string | undefined): URL {
  // Never propagate URL parser errors: they include the input (credentials).
  let url: URL;
  try {
    url = new URL(value ?? "");
    decodeURIComponent(url.username);
    decodeURIComponent(url.password);
    decodeURIComponent(url.pathname);
  } catch {
    throw new Error("URL PostgreSQL inválida; confira a configuração privada.");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    url.pathname.length < 2 ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Use URL PostgreSQL com host e banco, sem query ou fragmento.",
    );
  return url;
}

export function localUrl(value: string | undefined): string {
  if (!value) throw new Error("Configure uma URL de banco DEV local.");
  const url = databaseUrl(value);
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !/^\/hvb_sistema_(dev|test)$/.test(url.pathname)
  ) {
    throw new Error("M0/M1 permite somente hvb_sistema_dev/test em loopback.");
  }
  return value;
}
export function databaseConfig(
  value: string,
  max = 5,
  env: NodeJS.ProcessEnv = {},
): pg.PoolConfig {
  const mode = env.HVB_DATABASE_MODE ?? "local";
  if (!["local", "remote-dev"].includes(mode))
    throw new Error("HVB_DATABASE_MODE deve ser local ou remote-dev.");
  const remote = mode === "remote-dev";
  const connectionString = remote ? value : localUrl(value);
  if (remote) {
    if (env.NODE_ENV === "production")
      throw new Error("Conexão remota autorizada somente para DEV.");
    if (env.HVB_DATABASE_TLS !== "verify-full")
      throw new Error("Banco remoto exige HVB_DATABASE_TLS=verify-full.");
    if (
      !["direct", "session", "transaction"].includes(
        env.HVB_DATABASE_CONNECTION ?? "",
      )
    )
      throw new Error(
        "Declare HVB_DATABASE_CONNECTION: direct, session ou transaction.",
      );
    if (env.NODE_TLS_REJECT_UNAUTHORIZED === "0" || env.PGOPTIONS)
      throw new Error(
        "Remova overrides inseguros de TLS ou de sessão PostgreSQL.",
      );
    const url = databaseUrl(value);
    if (!url.username)
      throw new Error(
        "Declare a identidade PostgreSQL de runtime na URL privada.",
      );
  }
  return {
    connectionString,
    max,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000,
    ...(remote
      ? {
          // No session GUCs in startup: compatible with transaction pooling.
          query_timeout: 5000,
          ssl: {
            rejectUnauthorized: true,
            minVersion: "TLSv1.2" as const,
            ...(env.HVB_DATABASE_CA_PEM ? { ca: env.HVB_DATABASE_CA_PEM } : {}),
          },
        }
      : {
          statement_timeout: 5000,
          lock_timeout: 2000,
          idle_in_transaction_session_timeout: 5000,
          options: "-c search_path=hvb,public",
        }),
    application_name: "hvb-sistema-dev",
  };
}

// Defaults intentionally stay local, including migration/seed callers.
export function pool(
  url: string,
  max = 5,
  env: NodeJS.ProcessEnv = {},
): pg.Pool {
  return new pg.Pool(databaseConfig(url, max, env));
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
      await tx.query(
        `SELECT set_config('search_path','hvb,public',true),
          set_config('statement_timeout','5000',true),
          set_config('lock_timeout','2000',true),
          set_config('idle_in_transaction_session_timeout','5000',true)`,
      );
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
