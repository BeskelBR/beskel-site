import { choice, integer, object, text, time, uuid } from "../schemas.ts";
import { amount } from "../inventory/schemas.ts";
const confirmation = { type: "boolean", const: true };
const version = {
  item_clinico_id: uuid,
  quantidade_prescrita: amount,
  unidade_medida_id: uuid,
  via: text,
  orientacao: text,
  vigencia_inicio: time,
  vigencia_fim: time,
  motivo: text,
};
const requiredVersion = Object.keys(version).filter(
  (k) => k !== "vigencia_fim",
);
const execution = {
  evento_referencia: uuid,
  executada_em: time,
  quantidade_aplicada: amount,
  unidade_medida_id: uuid,
  resultado: choice("integral", "parcial"),
  situacao_material: choice("pendente", "nao_utilizado"),
  confirmacao_humana: confirmation,
  motivo: text,
};
export const clinicalInputs = {
  clinicalItem: object({
    nome: text,
    tipo: choice("medicamento", "procedimento", "cuidado", "outro"),
  }),
  prescription: object({
    episodio_id: uuid,
    assinada_em: time,
    motivo: text,
    confirmacao_humana: confirmation,
  }),
  clinicalOrder: object({ prescricao_id: uuid, ...version }, [
    "prescricao_id",
    ...requiredVersion,
  ]),
  clinicalVersion: object({ versao_esperada: integer, ...version }, [
    "versao_esperada",
    ...requiredVersion,
  ]),
  clinicalSchedule: object({ ordem_versao_id: uuid, prevista_em: time }),
  clinicalExecution: object(
    { ordem_versao_id: uuid, programacao_id: uuid, ...execution },
    ["ordem_versao_id", ...Object.keys(execution)],
  ),
  clinicalCorrection: object(execution),
  plannedMaterial: object({
    item_clinico_id: uuid,
    produto_id: uuid,
    versao: integer,
    quantidade_base: amount,
    criterio: text,
    confirmacao_humana: confirmation,
  }),
  clinicalConsumption: object(
    {
      episodio_id: uuid,
      execucao_id: uuid,
      evento_referencia: uuid,
      ocorrido_em: time,
      finalidade: text,
      motivo: text,
      itens_confirmados: confirmation,
      itens: {
        type: "array",
        minItems: 1,
        maxItems: 20,
        items: object({ posicao_id: uuid, quantidade_base: amount }),
      },
    },
    [
      "episodio_id",
      "evento_referencia",
      "ocorrido_em",
      "finalidade",
      "motivo",
      "itens_confirmados",
      "itens",
    ],
  ),
  clinicalReversal: object({ ocorrido_em: time, motivo: text }),
};
export const clinicalPermissions = [
  "clinica:ler",
  "clinica:catalogar",
  "clinica:prescrever",
  "clinica:programar",
  "clinica:executar",
  "clinica:retificar",
  "clinica:consumir",
  "clinica:reverter_consumo",
  "clinica:revisar",
];
