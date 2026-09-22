import { object, text, time, uuid } from "../schemas.ts";
import { money } from "../financial/schemas.ts";
const common = {
  unidade_id: uuid,
  motivo: text,
  simulacao: { type: "boolean", const: true },
  confirmacao_humana: { type: "boolean", const: true },
};
export const supplierOutflowInputs = {
  supplierOutflow: object(
    {
      ...common,
      conta_financeira_id: uuid,
      referencia: uuid,
      referencia_externa: text,
      correcao_de_id: uuid,
      ocorrido_em: time,
      valor: money,
      evidencia: text,
    },
    [
      ...Object.keys(common),
      "conta_financeira_id",
      "referencia",
      "referencia_externa",
      "ocorrido_em",
      "valor",
      "evidencia",
    ],
  ),
  supplierOutflowReconciliation: object({
    ...common,
    pagamento_id: uuid,
    saida_id: uuid,
    valor: money,
    evidencia: text,
  }),
  supplierOutflowReverse: object(
    { ...common, saida_id: uuid, conciliacao_id: uuid },
    Object.keys(common),
  ),
};
