import test from "node:test";
import assert from "node:assert/strict";
import { createPilotClient } from "../assets/pilot-api.js";
import {
  assignmentPayload,
  buildPatientSearchPath,
  canUseGlobal,
  canUseUnit,
  operationalFlows,
  resolveUnit,
} from "../assets/system-v10-contract.js";

test("MVP 11 contrato: escopos e atribuição global", () => {
  assert.throws(() => assignmentPayload("papel", "", ""), /escopo_obrigatorio/);
  const context = {
    permissoes_globais: ["estoque:ler", "estoque:catalogar"],
    unidades: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        permissoes: ["estoque:movimentar", "locais:ler", "compras:receber"],
      },
    ],
  };
  const unit = resolveUnit(context, "");
  assert.equal(
    canUseGlobal(context, operationalFlows.stockEntry.globalPermissions),
    true,
  );
  assert.equal(
    canUseUnit(context, unit, operationalFlows.stockEntry.uiUnitPermissions),
    true,
  );
  assert.deepEqual(
    assignmentPayload(
      "22222222-2222-4222-8222-222222222222",
      "global",
      "11111111-1111-4111-8111-111111111111",
    ),
    { papel_id: "22222222-2222-4222-8222-222222222222" },
  );
});

test("MVP 11 contrato: busca mantém q e cursor", () => {
  const path = buildPatientSearchPath(
    "  Luna  ",
    "33333333-3333-4333-8333-333333333333",
    25,
  );
  assert.match(path, /limit=25/);
  assert.match(path, /q=Luna/);
  assert.match(path, /cursor=33333333-3333-4333-8333-333333333333/);
});

test("MVP 11 contrato: retry reutiliza chave e corpo", async () => {
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
          id: "44444444-4444-4444-8444-444444444444",
          estado: "confirmado",
          repetido: true,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });
  const intent = client.prepare("/v1/estoque/entradas-completas", {
    unidade_id: "11111111-1111-4111-8111-111111111111",
    local_id: "55555555-5555-4555-8555-555555555555",
    lote: {
      apresentacao_id: "66666666-6666-4666-8666-666666666666",
      fabricante: "Fictício",
      codigo: "L-DEV-001",
      situacao_validade: "isenta",
    },
    quantidade_apresentacoes: "2",
    ocorrido_em: "2026-09-23T12:00:00.000Z",
    motivo: "Teste",
  });
  await assert.rejects(client.send(intent), { status: 503, uncertain: true });
  const result = await client.send(intent);
  assert.equal(result.estado, "confirmado");
  assert.equal(seen.length, 2);
  assert.equal(seen[0].key, seen[1].key);
  assert.equal(seen[0].body, seen[1].body);
});
