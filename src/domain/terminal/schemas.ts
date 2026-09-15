import { object, text, time, uuid } from "../schemas.ts";
import { amount } from "../inventory/schemas.ts";
const common = {
  unidade_id: uuid,
  motivo: text,
  simulacao: { type: "boolean", const: true },
  confirmacao_humana: { type: "boolean", const: true },
};
export const terminalInputs = {
  terminalLabel: object(
    { ...common, codigo: uuid, paciente_id: uuid, posicao_id: uuid },
    [...Object.keys(common), "codigo"],
  ),
  terminalRevoke: object({ ...common, etiqueta_id: uuid }),
  terminalScan: object(
    {
      ...common,
      codigo: uuid,
      referencia: uuid,
      ocorrida_em: time,
      episodio_id: uuid,
    },
    [...Object.keys(common), "codigo", "referencia", "ocorrida_em"],
  ),
  terminalWithdrawal: object({
    ...common,
    leitura_id: uuid,
    origem_id: uuid,
    destino_id: uuid,
    quantidade_base: amount,
    ocorrido_em: time,
  }),
};
export const terminalPermissions = [
  "terminal:ler",
  "terminal:configurar",
  "terminal:usar",
];
