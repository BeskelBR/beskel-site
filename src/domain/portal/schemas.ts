import { choice, object, text, time, uuid } from "../schemas.ts";
const common = {
  unidade_id: uuid,
  motivo: text,
  simulacao: { type: "boolean", const: true },
  confirmacao_humana: { type: "boolean", const: true },
};
const purpose = choice("aviso", "documento", "agenda");
export const portalInputs = {
  portalAccount: object({ ...common, responsavel_id: uuid }),
  portalRevoke: object({ ...common, conta_portal_id: uuid }),
  portalGrant: object({
    ...common,
    conta_portal_id: uuid,
    paciente_id: uuid,
    vinculo_id: uuid,
    valida_ate: time,
    evidencia: text,
  }),
  portalGrantRevoke: object({ ...common, concessao_id: uuid }),
  portalPreference: object({
    ...common,
    conta_portal_id: uuid,
    finalidade: purpose,
    versao_esperada: { type: "integer", minimum: 0, maximum: 2147483646 },
    permitida: { type: "boolean" },
    evidencia: text,
  }),
  portalMessage: object(
    {
      ...common,
      concessao_id: uuid,
      finalidade: purpose,
      canal: choice("portal_dev"),
      origem: choice("registro_manual_dev"),
      referencia: uuid,
      titulo: text,
      texto: { ...text, maxLength: 4000 },
      agendamento_versao_id: uuid,
      documentos: {
        type: "array",
        maxItems: 5,
        uniqueItems: true,
        items: uuid,
      },
    },
    [
      ...Object.keys(common),
      "concessao_id",
      "finalidade",
      "canal",
      "origem",
      "referencia",
      "titulo",
      "texto",
      "documentos",
    ],
  ),
  portalAttempt: object({
    ...common,
    mensagem_id: uuid,
    sequencia_esperada: { type: "integer", minimum: 0, maximum: 4 },
  }),
  portalResult: object({
    ...common,
    tentativa_id: uuid,
    sequencia_esperada: { type: "integer", minimum: 0, maximum: 2147483646 },
    estado: choice("incerto", "falha", "enviado", "entregue", "lido"),
    ocorrido_em: time,
    evidencia: text,
    referencia: uuid,
  }),
};
export const portalPermissions = [
  "portal:administrar",
  "portal:ler",
  "portal:autorizar",
  "comunicacao:preferencias",
  "comunicacao:preparar",
  "comunicacao:simular",
  "comunicacao:ler",
];
