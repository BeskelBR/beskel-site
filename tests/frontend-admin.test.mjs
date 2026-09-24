import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("ADM: interface usa contratos publicados e BFF same-origin", async () => {
  const source = await readFile(
    new URL("../assets/system-v11-admin.js", import.meta.url),
    "utf8",
  );
  for (const contract of [
    "/v1/usuarios",
    "/v1/papeis",
    "/v1/unidades",
    "/v1/atribuicoes",
    "/v1/me/contexto",
  ])
    assert.match(source, new RegExp(contract.replaceAll("/", "\\/")));

  assert.match(source, /\/v1\/usuarios\/\$\{encodeURIComponent\(user\.id\)\}\/revisoes/);
  assert.match(source, /\/v1\/papeis\/\$\{encodeURIComponent\(roleId\)\}\/permissoes/);
  assert.match(source, /\/v1\/atribuicoes\/\$\{encodeURIComponent\(assignment\.id\)\}\/revisoes/);
  assert.match(source, /window\.HVBSession\.fetch/);
  assert.doesNotMatch(source, /Authorization/);
  assert.doesNotMatch(source, /supabase|postgres|SELECT |INSERT |UPDATE /i);
  assert.doesNotMatch(source, /placeholder[^\n]*UUID/i);
});

test("ADM: interface oferece operacoes manuais completas sem simular sucesso", async () => {
  const source = await readFile(
    new URL("../assets/system-v11-admin.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /Buscar por nome ou login/);
  assert.match(source, /Salvar alteração/);
  assert.match(source, /Adicionar autorização/);
  assert.match(source, /Revogar autorização/);
  assert.match(source, /Restaurar autorização/);
  assert.match(source, /Histórico de alterações/);
  assert.match(source, /Escolha explicitamente o escopo/);
  assert.match(source, /versao_esperada/);
  assert.match(source, /motivo/);
  assert.match(source, /client\.prepare/);
  assert.match(source, /client\.send/);
  assert.match(source, /pendingMutation/);
  assert.match(source, /O contrato atual de criação da atribuição não aceita motivo/);
});

test("ADM: documento principal carrega a camada depois do MVP 11 integrado", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const operational = html.indexOf('assets/system-v10.js');
  const admin = html.indexOf('assets/system-v11-admin.js');
  assert.ok(operational >= 0);
  assert.ok(admin > operational);
});
