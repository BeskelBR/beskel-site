import { choice, object, text, time, uuid } from "../schemas.ts";
import { amount } from "../inventory/schemas.ts";
import { examBoolean } from "../exams/schemas.ts";
export const accessPermissions = [
  "retiradas:solicitar",
  "retiradas:ler",
  "terminal:autenticar",
  "terminal:acessar",
  "terminal:sensivel",
  "terminal:eventos_dev",
];
const common = { unidade_id: uuid, motivo: text };
export const accessEventTypes = [
  "DOOR_AUTHORIZED",
  "DOOR_OPEN",
  "ENTRY_CONFIRMED",
  "DOOR_CLOSED",
  "SENSITIVE_CABINET_AUTHORIZED",
  "SENSITIVE_CABINET_OPEN",
  "SENSITIVE_CABINET_CLOSED",
  "ACCESS_ACTIVE",
  "EXIT",
  "ACCESS_CLOSED",
];
export const accessInputs = {
  withdrawalOrder: object({
    ...common,
    episodio_id: uuid,
    observacao: text,
    itens: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      items: object({
        produto_id: uuid,
        quantidade_solicitada: amount,
        sensivel: examBoolean,
        exige_lote: examBoolean,
        observacao: text,
      }),
    },
  }),
  withdrawalTransition: object(common),
  accessChallenge: object(common),
  accessAuthentication: object({
    ...common,
    desafio_id: uuid,
    evidencia: { type: "string", minLength: 32, maxLength: 4096 },
  }),
  accessSession: object({
    ...common,
    autenticacao_id: uuid,
    sensivel: examBoolean,
    ordens: {
      type: "array",
      items: uuid,
      minItems: 1,
      maxItems: 20,
      uniqueItems: true,
    },
  }),
  accessEvent: object({
    ...common,
    tipo: choice(...accessEventTypes),
    ocorrida_em: time,
    referencia: uuid,
  }),
};
