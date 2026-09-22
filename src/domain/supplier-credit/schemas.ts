import { object, text, time, uuid, choice } from "../schemas.ts";
import { money } from "../financial/schemas.ts";
const common = {
  unidade_id: uuid,
  motivo: text,
  simulacao: { type: "boolean", const: true },
  confirmacao_humana: { type: "boolean", const: true },
};
export const supplierCreditInputs = {
  supplierCredit: object(
    {
      ...common,
      fornecedor_id: uuid,
      origem_obrigacao_id: uuid,
      correcao_de_id: uuid,
      origem: choice("devolucao", "abatimento", "outro"),
      referencia: uuid,
      documento_referencia: text,
      descricao: text,
      ocorrido_em: time,
      valor: money,
    },
    [
      ...Object.keys(common),
      "fornecedor_id",
      "origem",
      "referencia",
      "documento_referencia",
      "descricao",
      "ocorrido_em",
      "valor",
    ],
  ),
  supplierCreditApplication: object({
    ...common,
    obrigacao_id: uuid,
    credito_id: uuid,
    liquidada_em: time,
    valor: money,
  }),
  supplierCreditReverse: object({ ...common, credito_id: uuid }),
};
