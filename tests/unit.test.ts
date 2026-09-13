import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { canonical, digest, occurred } from "../src/domain/core.ts";
import { localUrl } from "../src/persistence/database.ts";
import { LocalPrivateStorage } from "../src/storage/private.ts";
import { exact, decimal, multiply } from "../src/domain/inventory/decimal.ts";

test("quantidades de estoque usam aritmética inteira e conversão sem arredondamento", () => {
  assert.equal(decimal(exact("0.1") + exact("0.2")), "0.300000");
  assert.equal(multiply("0.1", "0.1"), "0.010000");
  assert.throws(() => multiply("0.000001", "0.1"));
  assert.throws(() => exact("NaN"));
  assert.throws(() => exact("1e3"));
});

test("hash canônico ignora ordem das chaves e distingue operação/conteúdo", () => {
  assert.equal(
    digest(canonical({ b: 2, a: { z: 3, y: 4 } })),
    digest(canonical({ a: { y: 4, z: 3 }, b: 2 })),
  );
  assert.notEqual(
    digest(canonical({ a: [1, 2] })),
    digest(canonical({ a: [2, 1] })),
  );
  assert.notEqual(digest(canonical({ x: "1" })), digest(canonical({ x: 1 })));
});
test("tempo ocorrido aceita fuso explícito e rejeita futuro/inválido", () => {
  assert.equal(
    occurred("2026-01-01T09:00:00-03:00"),
    "2026-01-01T12:00:00.000Z",
  );
  assert.throws(() => occurred("invalid"));
  assert.throws(() => occurred(new Date(Date.now() + 3600000).toISOString()));
});
test("ambiente recusa banco remoto, produção e nome genérico", () => {
  assert.throws(() =>
    localUrl("postgresql://u:p@remote.example/hvb_sistema_dev"),
  );
  assert.throws(() => localUrl("postgresql://u:p@localhost/production"));
  assert.throws(() => localUrl(undefined));
  assert.ok(localUrl("postgresql://u:p@127.0.0.1/hvb_sistema_test"));
});
test("storage privado confina caminho e organização; calcula hash do conteúdo", async () => {
  const store = new LocalPrivateStorage();
  const org = randomUUID(),
    bytes = Buffer.from("FICTICIO-TESTE");
  const meta = await store.put(org, bytes, "application/pdf");
  assert.equal(meta.sha256, digest(bytes.toString()));
  assert.deepEqual(await store.get(org, meta.key), bytes);
  await assert.rejects(() => store.get(randomUUID(), meta.key));
  await assert.rejects(() => store.get(org, "../../.env"));
  await assert.rejects(() => store.put(org, bytes, "text/html"));
  assert.throws(() => new LocalPrivateStorage("../outside"));
});
