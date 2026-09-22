import { choice, object, text, time, uuid } from "../schemas.ts";
import { medicalContent } from "../medical-record/schemas.ts";
const common = {
  unidade_id: uuid,
  motivo: text,
  simulacao: { type: "boolean", const: true },
  confirmacao_humana: { type: "boolean", const: true },
};
const code = { type: "string", pattern: "^[a-z][a-z0-9_]{0,31}$" };
export const modelFields = {
  type: "array",
  minItems: 1,
  maxItems: 16,
  items: object({
    codigo: code,
    rotulo: text,
    obrigatorio: { type: "boolean" },
  }),
};
export const modelAnswers = {
  type: "array",
  minItems: 1,
  maxItems: 16,
  items: object({ codigo: code, valor: medicalContent }),
};
const source = {
  evolucao_versao_id: uuid,
  hash_evolucao: { type: "string", pattern: "^[a-f0-9]{64}$" },
};
export const attachmentMime = choice(
  "application/pdf",
  "image/png",
  "image/jpeg",
);
export const attachmentBase64 = {
  type: "string",
  minLength: 4,
  maxLength: 349528,
};
export const medicalComplementInputs = {
  medicalModel: object({
    ...common,
    codigo: code,
    nome: text,
    tipo: choice("anamnese", "evolucao", "observacao"),
    versao_esperada: { type: "integer", minimum: 0, maximum: 2147483646 },
    campos: modelFields,
  }),
  modeledEvolution: object({
    ...common,
    paciente_id: uuid,
    episodio_id: uuid,
    modelo_versao_id: uuid,
    referencia: uuid,
    ocorrida_em: time,
    respostas: modelAnswers,
  }),
  medicalAttachment: object({
    ...common,
    ...source,
    nome: { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}$" },
    mime: attachmentMime,
    conteudo_base64: attachmentBase64,
  }),
  revokeMedicalAttachment: object({ ...common, anexo_id: uuid }),
  medicalCoauthor: object({ ...common, ...source }),
  revokeMedicalCoauthor: object({ ...common, coautoria_id: uuid }),
};
