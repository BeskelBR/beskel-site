import { object, text, uuid } from "../schemas.ts";
import { money } from "../financial/schemas.ts";
const common = {
  unidade_id: uuid,
  motivo: text,
  simulacao: { type: "boolean", const: true },
  confirmacao_humana: { type: "boolean", const: true },
};
export const pricingInputs = {
  purchasePricing: object({
    ...common,
    pedido_id: uuid,
    versao_esperada: { type: "integer", minimum: 0, maximum: 2147483646 },
    frete: money,
    acrescimo: money,
    desconto: money,
    itens: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      items: object({ item_pedido_id: uuid, preco_apresentacao: money }),
    },
  }),
  purchaseValueLink: object({
    ...common,
    precificacao_id: uuid,
    obrigacao_id: uuid,
    valor: money,
  }),
  purchaseValueReverse: object({ ...common, vinculo_id: uuid }),
};
export const pricingPermissions = [
  "compras:precificar",
  "compras:conciliar_valores",
];
