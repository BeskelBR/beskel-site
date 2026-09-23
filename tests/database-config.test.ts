import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { databaseConfig, localUrl, pool } from "../src/persistence/database.ts";

const local = "postgresql://synthetic:fixture@127.0.0.1/hvb_sistema_test";
const remote = "postgresql://runtime:fixture@database.example/postgres";
const env = {
  HVB_DATABASE_MODE: "remote-dev",
  HVB_DATABASE_TLS: "verify-full",
  HVB_DATABASE_CONNECTION: "transaction",
  NODE_ENV: "development",
};

test("local é padrão; scripts sem opt-in continuam recusando remoto", () => {
  const config = databaseConfig(local);
  assert.equal(config.connectionString, local);
  assert.equal(config.options, "-c search_path=hvb,public");
  assert.equal(config.statement_timeout, 5000);
  assert.equal(config.ssl, undefined);
  assert.throws(() => databaseConfig(remote));
  assert.throws(() => pool(remote));
  assert.throws(() => localUrl(remote));
  assert.throws(() =>
    databaseConfig(local.replace("hvb_sistema_test", "postgres")),
  );
  assert.throws(() =>
    databaseConfig(remote, 5, { ...env, HVB_DATABASE_MODE: "remote" }),
  );
});

test("remoto exige TLS verificado, modo explícito e não libera produção", () => {
  for (const tls of [undefined, "disable", "require", "no-verify"])
    assert.throws(() =>
      databaseConfig(remote, 5, { ...env, HVB_DATABASE_TLS: tls }),
    );
  for (const mode of [undefined, "automatic"])
    assert.throws(() =>
      databaseConfig(remote, 5, { ...env, HVB_DATABASE_CONNECTION: mode }),
    );
  assert.throws(() =>
    databaseConfig(remote, 5, { ...env, NODE_ENV: "production" }),
  );
  assert.throws(() =>
    databaseConfig(remote, 5, { ...env, NODE_TLS_REJECT_UNAUTHORIZED: "0" }),
  );
  assert.throws(() =>
    databaseConfig(remote, 5, { ...env, PGOPTIONS: "-c role=postgres" }),
  );
  assert.throws(() =>
    databaseConfig("postgresql://database.example/postgres", 5, env),
  );
});

test("direct/session/transaction usam TLS e não dependem de GUC de startup", () => {
  for (const mode of ["direct", "session", "transaction"]) {
    const config = databaseConfig(remote, 2, {
      ...env,
      HVB_DATABASE_CONNECTION: mode,
    });
    assert.equal(config.max, 2);
    assert.equal(config.options, undefined);
    assert.equal(config.statement_timeout, undefined);
    assert.deepEqual(config.ssl, {
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
    });
    const client = new pg.Client(config);
    assert.deepEqual(client.ssl, config.ssl);
  }
});

test("CA configurável é preservada até pg.Client sem desativar verificação", () => {
  const ca = "CA-SINTETICA-SOMENTE-PARSING";
  const config = databaseConfig(remote, 5, { ...env, HVB_DATABASE_CA_PEM: ca });
  const client = new pg.Client(config);
  assert.deepEqual(client.ssl, {
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
    ca,
  });
});

test("URL não pode sobrepor host, TLS, opções ou arquivos por query string", () => {
  for (const parameter of [
    "sslmode=no-verify",
    "sslmode=disable",
    "sslmode=verify-full",
    "sslcert=secret.pem",
    "sslrootcert=secret.pem",
    "host=other.example",
    "options=-c%20role=postgres",
    "user=postgres",
    "uselibpqcompat=true",
  ]) {
    assert.throws(() => databaseConfig(`${remote}?${parameter}`, 5, env));
    assert.throws(() => localUrl(`${local}?${parameter}`));
  }
});

test("erro de configuração nunca incorpora URL, segredo ou CA", () => {
  const sentinel = "SEGREDO-SINTETICO-NAO-EXIBIR";
  for (const value of [
    `invalid:${sentinel}`,
    `postgresql://u:${sentinel}@[/postgres`,
    `https://u:${sentinel}@database.example/postgres`,
    `postgresql://u:%xx${sentinel}@database.example/postgres`,
    `${remote}#${sentinel}`,
    "",
  ]) {
    assert.throws(
      () => databaseConfig(value, 5, { ...env, HVB_DATABASE_CA_PEM: sentinel }),
      (error: unknown) =>
        error instanceof Error && !String(error.stack).includes(sentinel),
    );
  }
});
