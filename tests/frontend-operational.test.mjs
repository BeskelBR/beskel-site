import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createPilotClient } from "../assets/pilot-api.js";
import {
  assignmentPayload,
  buildPatientSearchPath,
  canUseGlobal,
  canUseUnit,
  operationalFlows,
  resolveUnit,
} from "../assets/system-v10-contract.js";

test("MVP 11 integrado: respeita escopos global e de unidade", () => {
  const context = {
    permissoes_globais: ["estoque:ler", "estoque:catalogar"],
    unidades: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        nome: "HVB fictício",
        permissoes: ["estoque:movimentar", "locais:ler", "compras:receber"],
      },
    ],
  };
  const unit = resolveUnit(context, "00000000-0000-4000-8000-000000000000");
  assert.equal(unit, context.unidades[0].id);
  assert.equal(
    canUseGlobal(context, operationalFlows.stockEntry.globalPermissions),
    true,
  );
  assert.equal(
    canUseUnit(context, unit, operationalFlows.stockEntry.uiUnitPermissions),
    true,
  );
  assert.equal(
    canUseUnit(
      context,
      unit,
      operationalFlows.stockEntry.purchaseUnitPermissions,
    ),
    true,
  );
  assert.equal(
    canUseGlobal(context, operationalFlows.employee.globalPermissions),
    false,
  );
});

test("MVP 11 integrado: atribuição global omite unidade e busca preserva q/cursor", () => {
  assert.deepEqual(
    assignmentPayload(
      "22222222-2222-4222-8222-222222222222",
      "global",
      "",
    ),
    { papel_id: "22222222-2222-4222-8222-222222222222" },
  );
  assert.deepEqual(
    assignmentPayload(
      "22222222-2222-4222-8222-222222222222",
      "unidade",
      "33333333-3333-4333-8333-333333333333",
    ),
    {
      papel_id: "22222222-2222-4222-8222-222222222222",
      unidade_id: "33333333-3333-4333-8333-333333333333",
    },
  );
  const path = buildPatientSearchPath(
    "  Luna  ",
    "44444444-4444-4444-8444-444444444444",
    25,
  );
  assert.match(path, /^\/v1\/pacientes\?/);
  assert.match(path, /q=Luna/);
  assert.match(path, /limit=25/);
  assert.match(path, /cursor=44444444-4444-4444-8444-444444444444/);
});

test("MVP 11 integrado: chave e corpo permanecem idênticos no retry", async () => {
  const seen = [];
  let attempt = 0;
  const client = createPilotClient({
    base: "http://127.0.0.1:3200",
    fetcher: async (_url, options) => {
      seen.push({
        key: options.headers["Idempotency-Key"],
        body: options.body,
      });
      attempt += 1;
      if (attempt === 1)
        return new Response(
          JSON.stringify({ erro: "temporariamente_indisponivel" }),
          { status: 503, headers: { "content-type": "application/json" } },
        );
      return new Response(
        JSON.stringify({
          id: "55555555-5555-4555-8555-555555555555",
          estado: "confirmado",
          repetido: true,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  const body = {
    unidade_id: "11111111-1111-4111-8111-111111111111",
    lote: {
      apresentacao_id: "66666666-6666-4666-8666-666666666666",
      fabricante: "Fictício",
      codigo: "L-DEV-001",
      situacao_validade: "isenta",
    },
    quantidade_apresentacoes: "2",
    ocorrido_em: "2026-09-23T12:00:00.000Z",
    motivo: "Teste",
    compra: {
      pedido_id: "77777777-7777-4777-8777-777777777777",
      item_pedido_id: "88888888-8888-4888-8888-888888888888",
      referencia: "99999999-9999-4999-8999-999999999999",
      documento_fornecedor: "Fictício",
      simulacao: true,
      confirmacao_humana: true,
    },
  };
  const intent = client.prepare("/v1/estoque/entradas-completas", body);
  await assert.rejects(client.send(intent), { status: 503, uncertain: true });
  const result = await client.send(intent);
  assert.equal(result.estado, "confirmado");
  assert.equal(seen.length, 2);
  assert.equal(seen[0].key, seen[1].key);
  assert.equal(seen[0].body, seen[1].body);
});

test("MVP 11 integrado: interface usa apenas os contratos publicados", async () => {
  const [source, searchSource, html] = await Promise.all([
    readFile(new URL("../assets/system-v10.js", import.meta.url), "utf8"),
    readFile(new URL("../assets/system-v3.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
  ]);

  assert.match(source, /\/v1\/papeis\/\$\{encodeURIComponent\(roleId\)\}\/permissoes/);
  assert.match(source, /\/v1\/usuarios\/onboarding/);
  assert.match(source, /readAllPages\(\(path\) => client\.read\(path\), "\/v1\/papeis", 100\)/);\n  assert.match(source, /option\(scope, "", "Selecione o escopo\.\.\."\)/);
  assert.match(source, /scope\.required = true/);
  assert.match(source, /if \(!scope\.value\)/);
  assert.match(source, /scope\.value = ""/);
  assert.doesNotMatch(source, /client\.read\("\/v1\/papeis\?limit=100"\)/);
  assert.match(source, /\/v1\/estoque\/entradas-completas/);
  assert.match(source, /locais:ler/);
  assert.match(source, /motivo:/);
  assert.match(source, /lote:\s*lot/);
  assert.match(source, /compra:/);
  assert.doesNotMatch(source, /\/v1\/compras\/recebimentos/);
  assert.doesNotMatch(source, /Authorization/);
  assert.doesNotMatch(source, /\/terminal\//i);
  assert.doesNotMatch(source, /supabase|postgres|SELECT |INSERT |UPDATE /i);

  assert.match(searchSource, /params\.set\("q", query\)/);
  assert.match(searchSource, /params\.set\("cursor", patientCursor\)/);
  assert.match(searchSource, /limit: "25"/);
  assert.match(searchSource, /setTimeout\(\(\) => loadPatients\(true, false\), 250\)/);
  assert.doesNotMatch(searchSource, /haystack/);

  assert.match(html, /assets\/system-v10\.js/);
  assert.doesNotMatch(html, /src="assets\/system-v9\.js"/);
  assert.match(html, /Nome ou UUID completo/);
});
