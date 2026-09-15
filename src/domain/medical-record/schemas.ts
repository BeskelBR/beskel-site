import { choice, object, text, time, uuid } from "../schemas.ts";
const common = {
  unidade_id: uuid,
  motivo: text,
  simulacao: { type: "boolean", const: true },
  confirmacao_humana: { type: "boolean", const: true },
};
export const medicalContent = { ...text, maxLength: 8000 };
export const medicalInputs = {
  medicalCreate: object({
    ...common,
    paciente_id: uuid,
    episodio_id: uuid,
    tipo: choice("anamnese", "evolucao", "observacao"),
    referencia: uuid,
    ocorrida_em: time,
    conteudo: medicalContent,
  }),
  medicalVersion: object({
    ...common,
    evolucao_id: uuid,
    versao_esperada: { type: "integer", minimum: 1, maximum: 2147483646 },
    estado: choice("registrada", "invalidada"),
    ocorrida_em: time,
    conteudo: medicalContent,
  }),
};
export const medicalPermissions = [
  "prontuario:ler",
  "prontuario:conteudo",
  "prontuario:escrever",
  "prontuario:retificar",
];
