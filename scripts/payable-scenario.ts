import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { purchaseScenario } from "./purchase-scenario.ts";
export async function payableScenario(
  app: FastifyInstance,
  token: string,
  unit: string,
  prefix: string = randomUUID(),
) {
  const s = await purchaseScenario(app, token, unit, prefix);
  async function payable(
    name: string,
    path: string,
    body: Record<string, unknown>,
  ) {
    const r = await app.inject({
      method: "POST",
      url: `/v1/a-pagar/${path}`,
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": `${prefix}-pagar-${name}`,
      },
      payload: { ...s.common, ...body },
    });
    if (r.statusCode !== 200) throw new Error(`${name}: ${r.body}`);
    return r.json().id as string;
  }
  const r = await app.inject({
    method: "POST",
    url: "/v1/financeiro/contas-financeiras",
    headers: {
      authorization: `Bearer ${token}`,
      "idempotency-key": `${prefix}-conta-financeira`,
    },
    payload: { ...s.common, descricao: "Conta fictícia C4, sem banco externo" },
  });
  if (r.statusCode !== 200) throw new Error(r.body);
  const account = r.json().id as string;
  const obligationBody = {
    fornecedor_id: s.supplier,
    pedido_id: s.purchaseOrder,
    origem: "compra",
    referencia: s.ref("obrigacao"),
    documento_referencia: `FICTICIO-${prefix}`,
    descricao: "Obrigação fictícia, valor explicitamente informado",
    ocorrida_em: "2026-09-01T12:00:00Z",
    vencimento: "2026-09-30",
    valor: "100.00",
  };
  const obligation = await payable("obrigacao", "obrigacoes", obligationBody);
  return { ...s, account, obligation, obligationBody, payable };
}
