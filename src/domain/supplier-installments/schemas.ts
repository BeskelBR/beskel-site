import { object, text, uuid } from "../schemas.ts";
import { money } from "../financial/schemas.ts";
const common = {
  unidade_id: uuid,
  motivo: text,
  simulacao: { type: "boolean", const: true },
  confirmacao_humana: { type: "boolean", const: true },
};
export const installmentInputs = {
  supplierInstallmentPlan: object({
    ...common,
    obrigacao_id: uuid,
    versao_esperada: { type: "integer", minimum: 0, maximum: 2147483646 },
    parcelas: {
      type: "array",
      minItems: 1,
      maxItems: 120,
      items: object({
        vencimento: { type: "string", format: "date" },
        valor: money,
      }),
    },
  }),
  supplierInstallmentAllocation: object({
    ...common,
    parcela_id: uuid,
    liquidacao_id: uuid,
    valor: money,
  }),
  supplierInstallmentReverse: object({ ...common, alocacao_id: uuid }),
};
