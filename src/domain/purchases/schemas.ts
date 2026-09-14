import { choice, object, text, time, uuid } from "../schemas.ts";
import { amount } from "../inventory/schemas.ts";
const common = {
  unidade_id: uuid,
  motivo: text,
  simulacao: { type: "boolean", const: true },
  confirmacao_humana: { type: "boolean", const: true },
};
export const purchaseInputs = {
  purchaseSupplier: object({ ...common, nome: text, referencia: uuid }),
  purchaseOrder: object({
    ...common,
    fornecedor_id: uuid,
    referencia: uuid,
    observacao: { ...text, maxLength: 2000 },
    itens: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      items: object({
        apresentacao_id: uuid,
        quantidade_apresentacoes: amount,
      }),
    },
  }),
  purchaseDecision: object({
    ...common,
    pedido_id: uuid,
    estado_esperado: choice("rascunho", "aprovado"),
    estado: choice("aprovado", "cancelado"),
  }),
  purchaseReceipt: object({
    ...common,
    pedido_id: uuid,
    referencia: uuid,
    documento_fornecedor: text,
    ocorrido_em: time,
    itens: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: object({
        item_pedido_id: uuid,
        posicao_id: uuid,
        quantidade_apresentacoes: amount,
      }),
    },
  }),
};
export const purchasePermissions = [
  "compras:ler",
  "compras:configurar",
  "compras:solicitar",
  "compras:decidir",
  "compras:receber",
];
