import { choice, object, text, time, uuid } from "../schemas.ts";
import { money } from "../financial/schemas.ts";
const common = {
  unidade_id: uuid,
  motivo: text,
  simulacao: { type: "boolean", const: true },
  confirmacao_humana: { type: "boolean", const: true },
};
export const payableInputs = {
  payableObligation: object(
    {
      ...common,
      fornecedor_id: uuid,
      pedido_id: uuid,
      correcao_de_id: uuid,
      origem: choice("compra", "despesa"),
      referencia: uuid,
      documento_referencia: text,
      descricao: text,
      ocorrida_em: time,
      vencimento: { type: "string", format: "date" },
      valor: money,
    },
    [
      ...Object.keys(common),
      "fornecedor_id",
      "origem",
      "referencia",
      "documento_referencia",
      "descricao",
      "ocorrida_em",
      "vencimento",
      "valor",
    ],
  ),
  payablePayment: object({
    ...common,
    fornecedor_id: uuid,
    conta_financeira_id: uuid,
    referencia: uuid,
    pago_em: time,
    valor: money,
    evidencia: text,
  }),
  payableSettlement: object({
    ...common,
    obrigacao_id: uuid,
    pagamento_id: uuid,
    liquidada_em: time,
    valor: money,
  }),
  payableReversal: object(
    { ...common, obrigacao_id: uuid, pagamento_id: uuid, liquidacao_id: uuid },
    Object.keys(common),
  ),
};
export const payablePermissions = [
  "pagar:ler",
  "pagar:registrar",
  "pagar:pagar",
  "pagar:liquidar",
  "pagar:reverter",
];
