import { choice, object, text, time, uuid } from "../schemas.ts";
const common = {
  unidade_id: uuid,
  motivo: text,
  simulacao: { type: "boolean", const: true },
  confirmacao_humana: { type: "boolean", const: true },
};
const version = {
  inicio: time,
  fim: time,
  observacao: { ...text, maxLength: 2000 },
  recursos: {
    type: "array",
    minItems: 1,
    maxItems: 10,
    uniqueItems: true,
    items: uuid,
  },
};
export const scheduleInputs = {
  scheduleTeam: object({ ...common, nome: text }),
  scheduleResource: object(
    {
      ...common,
      nome: text,
      tipo: choice("profissional", "equipe", "sala", "institucional"),
      usuario_id: uuid,
      equipe_id: uuid,
      local_id: uuid,
    },
    [...Object.keys(common), "nome", "tipo"],
  ),
  scheduleAvailability: object({
    ...common,
    recurso_id: uuid,
    tipo: choice("disponivel", "bloqueio"),
    inicio: time,
    fim: time,
  }),
  scheduleRevoke: object({ ...common, disponibilidade_id: uuid }),
  scheduleCreate: object({
    ...common,
    paciente_id: uuid,
    responsavel_id: uuid,
    tipo: choice("consulta", "exame", "procedimento", "retorno", "outro"),
    referencia: uuid,
    ...version,
  }),
  scheduleVersion: object({
    ...common,
    agendamento_id: uuid,
    versao_esperada: { type: "integer", minimum: 1, maximum: 2147483646 },
    ...version,
  }),
  scheduleTransition: object({
    ...common,
    agendamento_versao_id: uuid,
    estado_esperado: choice("planejado", "confirmado", "chegou"),
    estado: choice(
      "confirmado",
      "chegou",
      "cancelado",
      "nao_compareceu",
      "concluido",
    ),
    ocorrida_em: time,
  }),
};
export const schedulePermissions = [
  "agenda:ler",
  "agenda:configurar",
  "agenda:disponibilidade",
  "agenda:agendar",
  "agenda:reprogramar",
  "agenda:transicionar",
];
