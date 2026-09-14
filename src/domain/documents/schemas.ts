import { choice, integer, object, text, time, uuid } from "../schemas.ts";
import { examBoolean } from "../exams/schemas.ts";
const note = { ...text, maxLength: 2000 };
const code = { type: "string", pattern: "^[a-z][a-z0-9_]{0,39}$" };
const common = {
  unidade_id: uuid,
  motivo: text,
  simulacao: { type: "boolean", const: true },
  confirmacao_humana: { type: "boolean", const: true },
};
export const documentFields = {
  type: "object",
  maxProperties: 50,
  propertyNames: code,
  additionalProperties: { type: "string", maxLength: 2000 },
};
export const documentInputs = {
  documentModel: object({
    ...common,
    codigo: text,
    nome: text,
    tipo: choice("termo", "declaracao", "orientacao", "boletim", "outro"),
  }),
  documentModelVersion: object({
    ...common,
    modelo_id: uuid,
    versao: integer,
    titulo: text,
    texto_base: { ...text, maxLength: 20000 },
    publico: choice("interno", "responsavel"),
    campos: {
      type: "array",
      maxItems: 50,
      items: object({ codigo: code, obrigatorio: examBoolean }),
    },
  }),
  documentModelApprove: object({ ...common, modelo_versao_id: uuid }),
  documentRequest: object(
    {
      ...common,
      paciente_id: uuid,
      episodio_id: uuid,
      modelo_id: uuid,
      solicitante_responsavel_id: uuid,
      solicitante_usuario_id: uuid,
      escopo: note,
      protocolo: uuid,
      recebida_em: time,
      prazo_em: time,
      evidencia_autorizacao: note,
    },
    [
      ...Object.keys(common),
      "paciente_id",
      "modelo_id",
      "escopo",
      "protocolo",
      "recebida_em",
      "prazo_em",
      "evidencia_autorizacao",
    ],
  ),
  documentAuthorization: object({
    ...common,
    solicitacao_id: uuid,
    decisao: choice("permitida", "negada"),
    valida_ate: time,
    evidencia: note,
  }),
  documentRevoke: object({ ...common, autorizacao_id: uuid }),
  documentVersion: object({
    ...common,
    solicitacao_id: uuid,
    modelo_versao_id: uuid,
    versao_esperada: { type: "integer", minimum: 0, maximum: 2147483646 },
    campos: documentFields,
  }),
  documentApprove: object({ ...common, documento_versao_id: uuid }),
  documentSignature: object(
    {
      ...common,
      documento_versao_id: uuid,
      signatario_usuario_id: uuid,
      signatario_responsavel_id: uuid,
      mecanismo: choice("declaracao_dev"),
      hash_conteudo: { type: "string", pattern: "^[a-f0-9]{64}$" },
      declarada_em: time,
      evidencia: note,
      referencia: uuid,
    },
    [
      ...Object.keys(common),
      "documento_versao_id",
      "mecanismo",
      "hash_conteudo",
      "declarada_em",
      "evidencia",
      "referencia",
    ],
  ),
  documentDelivery: object({
    ...common,
    documento_versao_id: uuid,
    destinatario_id: uuid,
    entregue_em: time,
    canal: choice("registro_manual_dev"),
    evidencia: note,
    referencia: uuid,
  }),
};
export const documentPermissions = [
  "documentos:ler",
  "documentos:conteudo",
  "documentos:configurar",
  "documentos:aprovar_modelo",
  "documentos:solicitar",
  "documentos:autorizar",
  "documentos:redigir",
  "documentos:aprovar",
  "documentos:registrar_assinatura",
  "documentos:registrar_entrega",
];
