import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { pricingScenario } from "./pricing-scenario.ts";
export async function acquisitionScenario(
  app: FastifyInstance,
  token: string,
  unit: string,
  prefix: string = randomUUID(),
) {
  const s = await pricingScenario(app, token, unit, prefix);
  const allocationBody = {
    pedido_id: s.purchaseOrder,
    precificacao_id: s.pricing,
    versao_esperada: 0,
    criterio: "Distribuição explícita fictícia dos componentes",
    itens: [
      {
        item_pedido_id: s.purchaseItem,
        frete: "10.00",
        acrescimo: "2.50",
        desconto: "7.50",
      },
    ],
  };
  const allocation = await s.purchase(
    "rateio",
    "rateios-custo",
    allocationBody,
  );
  const r = await app.inject({
    url: `/v1/compras/rateios-custo-itens?unidade_id=${unit}&rateio_id=${allocation}`,
    headers: { authorization: `Bearer ${token}` },
  });
  if (r.statusCode !== 200 || r.json().items.length !== 1)
    throw new Error("Item de rateio fictício ausente");
  const allocationItem = r.json().items[0].id as string;
  await s.purchase("aprovar-custo", "decisoes", {
    pedido_id: s.purchaseOrder,
    estado_esperado: "rascunho",
    estado: "aprovado",
  });
  async function receipt(name: string, quantity: string) {
    const id = await s.purchase(name, "recebimentos", {
      pedido_id: s.purchaseOrder,
      referencia: s.ref(name),
      documento_fornecedor: "Comprovante fictício C7",
      ocorrido_em: "2026-09-01T12:00:00Z",
      itens: [
        {
          item_pedido_id: s.purchaseItem,
          posicao_id: s.purchasePosition,
          quantidade_apresentacoes: quantity,
        },
      ],
    });
    const r = await app.inject({
      url: `/v1/compras/recebimentos-itens?unidade_id=${unit}&recebimento_id=${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    if (r.statusCode !== 200 || r.json().items.length !== 1)
      throw new Error("Entrada fictícia ausente");
    return r.json().items[0].id as string;
  }
  return { ...s, allocationBody, allocation, allocationItem, receipt };
}
