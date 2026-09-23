import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  canUse,
  operationalFlows,
  permissionsFor,
  resolveUnit,
} from "../assets/system-v9-contract.js";

test("MVP 11: contexto próprio resolve unidade e permissões sem ampliar escopo", () => {
  const context = {
    permissoes_globais: ["cadastros:ler"],
    unidades: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        nome: "HVB fictício",
        permissoes: [
          "estoque:ler",
          "estoque:catalogar",
          "estoque:movimentar",
        ],
      },
    ],
  };
  const unit = resolveUnit(context, "00000000-0000-4000-8000-000000000000");
  assert.equal(unit, context.unidades[0].id);
  assert.deepEqual(
    [...permissionsFor(context, unit)].sort(),
    [
      "cadastros:ler",
      "estoque:catalogar",
      "estoque:ler",
      "estoque:movimentar",
    ].sort(),
  );
  assert.equal(
    canUse(context, unit, operationalFlows.stockEntry.requiredPermissions),
    true,
  );
  assert.equal(
    canUse(context, unit, operationalFlows.employee.requiredPermissions),
    false,
  );
});

test("MVP 11: contratos da interface não misturam Terminal nem banco direto", () => {
  for (const flow of Object.values(operationalFlows)) {
    const contracts = [
      ...flow.existingEndpoints,
      ...flow.missingContracts,
    ].join(" ");
    assert.doesNotMatch(contracts, /terminal/i);
    assert.doesNotMatch(contracts, /postgres|supabase|sql/i);
  }
  assert.ok(
    operationalFlows.employee.missingContracts.some((item) =>
      item.includes("onboarding transacional"),
    ),
  );
  assert.ok(
    operationalFlows.stockEntry.missingContracts.some((item) =>
      item.includes("entrada completa transacional"),
    ),
  );
});

test("MVP 11: camada visual usa sessão same-origin e não envia escrita provisória", async () => {
  const source = await readFile(
    new URL("../assets/system-v9.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /\/v1\/me\/contexto/);
  assert.match(source, /window\.HVBSession\.fetch/);
  assert.doesNotMatch(source, /Authorization/);
  assert.doesNotMatch(source, /method\s*:\s*["']POST["']/);
  assert.doesNotMatch(source, /\/terminal\//);
  assert.doesNotMatch(source, /supabase|postgres|SELECT |INSERT |UPDATE /i);
  assert.match(source, /Aguardando contrato de cadastro completo/);
  assert.match(source, /Aguardando entrada transacional do backend/);
});

test("MVP 11: documento principal carrega a camada depois da sessão existente", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const session = html.indexOf('assets/web-session.js');
  const operational = html.indexOf('assets/system-v9.js');
  assert.ok(session >= 0);
  assert.ok(operational > session);
  assert.match(html, /assets\/system-v6\.css/);
});
