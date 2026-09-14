import { choice, integer, object, text, time, uuid } from "../schemas.ts";
const day = {
  type: "string",
  format: "date",
  pattern: "^(20[2-9][0-9]|2100)-[0-9]{2}-[0-9]{2}$",
};
const zero = { type: "integer", minimum: 0, maximum: 36600 };
const note = { ...text, maxLength: 2000 };
const common = {
  unidade_id: uuid,
  motivo: text,
  simulacao: { type: "boolean", const: true },
  confirmacao_humana: { type: "boolean", const: true },
};
export const preventiveInputs = {
  preventiveCatalog: object({ ...common, codigo: text, nome: text }),
  preventiveVersion: object({
    ...common,
    protocolo_id: uuid,
    versao: integer,
    descricao: note,
    especie_codigo: choice("canina", "felina", "outra", "desconhecida"),
    etapas: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      items: object({
        codigo: text,
        item_clinico_id: uuid,
        ordem: integer,
        deslocamento_dias: zero,
        recorrencia: choice("unica", "dias", "meses_calendario"),
        intervalo: zero,
        orientacao: note,
      }),
    },
  }),
  preventiveApprove: object({ ...common, protocolo_versao_id: uuid }),
  preventiveEnroll: object({
    ...common,
    paciente_id: uuid,
    protocolo_versao_id: uuid,
    inicio_data: day,
    referencia: uuid,
  }),
  preventiveEnd: object(
    {
      ...common,
      protocolo_paciente_id: uuid,
      sucessor_id: uuid,
      encerrado_em: time,
    },
    [...Object.keys(common), "protocolo_paciente_id", "encerrado_em"],
  ),
  preventiveOccurrence: object({
    ...common,
    protocolo_paciente_id: uuid,
    etapa_id: uuid,
    sequencia: { ...integer, maximum: 1000 },
    prevista_data: day,
  }),
  preventiveApplication: object(
    {
      ...common,
      ocorrencia_id: uuid,
      origem: choice("interna", "externa"),
      execucao_id: uuid,
      profissional_informado: text,
      ocorrida_em: time,
      referencia: uuid,
      lote_declarado: text,
      fabricante_declarado: text,
      evidencia: note,
      correcao_de_id: uuid,
    },
    [
      ...Object.keys(common),
      "ocorrencia_id",
      "origem",
      "ocorrida_em",
      "referencia",
      "lote_declarado",
      "fabricante_declarado",
      "evidencia",
    ],
  ),
  preventiveConsumption: object({
    ...common,
    aplicacao_id: uuid,
    consumo_item_id: uuid,
  }),
  preventiveReview: object({
    ...common,
    ocorrencia_id: uuid,
    observada_em: time,
    descricao: note,
  }),
  preventiveResolution: object({
    ...common,
    revisao_id: uuid,
    orientacao: note,
  }),
};
export const preventivePermissions = [
  "protocolos:ler",
  "protocolos:configurar",
  "protocolos:aprovar_simulacao",
  "protocolos:aderir",
  "protocolos:programar",
  "protocolos:registrar_aplicacao",
  "protocolos:conciliar",
  "protocolos:revisar",
  "protocolos:encerrar",
];
