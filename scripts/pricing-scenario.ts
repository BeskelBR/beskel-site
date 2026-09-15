import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { payableScenario } from "./payable-scenario.ts";
export async function pricingScenario(
  app: FastifyInstance,
  token: string,
  unit: string,
  prefix: string = randomUUID(),
) {
  const s = await payableScenario(app, token, unit, prefix);
  const priceBody = {
    ...s.common,
    pedido_id: s.purchaseOrder,
    versao_esperada: 0,
    frete: "10.00",
    acrescimo: "2.50",
    desconto: "7.50",
    itens: [{ item_pedido_id: s.purchaseItem, preco_apresentacao: "20.00" }],
  };
  const r = await app.inject({
    method: "POST",
    url: "/v1/compras/precificacoes",
    headers: {
      authorization: `Bearer ${token}`,
      "idempotency-key": `${prefix}-precificacao`,
    },
    payload: priceBody,
  });
  if (r.statusCode !== 200) throw new Error(r.body);
  return { ...s, priceBody, pricing: r.json().id as string };
}
