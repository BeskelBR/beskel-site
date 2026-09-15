import { object, text, uuid } from "../schemas.ts";
import { money } from "../financial/schemas.ts";
const common = {
  unidade_id: uuid,
  motivo: text,
  simulacao: { type: "boolean", const: true },
  confirmacao_humana: { type: "boolean", const: true },
};
export const acquisitionInputs = {
  acquisitionAllocation: object({
    ...common,
    pedido_id: uuid,
    precificacao_id: uuid,
    versao_esperada: { type: "integer", minimum: 0, maximum: 2147483646 },
    criterio: text,
    itens: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      items: object({
        item_pedido_id: uuid,
        frete: money,
        acrescimo: money,
        desconto: money,
      }),
    },
  }),
  acquisitionReceiptCost: object({
    ...common,
    item_rateio_id: uuid,
    recebimento_item_id: uuid,
    valor: money,
  }),
  acquisitionCostReverse: object({ ...common, custo_recebimento_id: uuid }),
};
