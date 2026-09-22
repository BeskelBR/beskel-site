import { choice, object, text, time, uuid } from "../schemas.ts";
import { amount } from "../inventory/schemas.ts";
import { examBoolean } from "../exams/schemas.ts";
const common = { unidade_id: uuid, motivo: text };
const array = (items: unknown, minItems = 0, maxItems = 50) => ({
  type: "array",
  items,
  minItems,
  maxItems,
});
export const physicalEvents = [
  "DOOR_OPEN",
  "ENTRY_CONFIRMED",
  "PRESENCE_CLEARED",
  "DOOR_CLOSED",
  "SENSITIVE_DOOR_OPENED",
  "SENSITIVE_DOOR_CLOSED",
  "SENSITIVE_LOCK_CONFIRMED",
];
export const pickingEvents = [
  "CONFIRM",
  "PARTIAL",
  "UNAVAILABLE",
  "NOT_FOUND",
  "UNDO",
];
export const terminalV1Inputs = {
  tv1Room: object({
    ...common,
    local_id: uuid,
    transit_local_id: uuid,
    unlock_seconds: { type: "integer", minimum: 1, maximum: 60 },
    session_seconds: { type: "integer", minimum: 60, maximum: 3600 },
  }),
  tv1Device: object({
    ...common,
    room_id: uuid,
    device_id: uuid,
    credential_id: uuid,
    role: choice("ACCESS", "BIOMETRIC", "PICKING", "CONTROLLER"),
    mode: choice("SIMULADO_DEV"),
  }),
  tv1Nfc: object({
    ...common,
    employee_id: uuid,
    tag: { type: "string", minLength: 8, maxLength: 256 },
  }),
  tv1Common: object(common),
  tv1Policy: object({ ...common, product_id: uuid, sensitive: examBoolean }),
  tv1Coordinate: object({
    ...common,
    room_id: uuid,
    code: { ...text, maxLength: 80 },
    sensitive: examBoolean,
  }),
  tv1Occupancy: object({ ...common, coordinate_id: uuid, position_id: uuid }),
  tv1ReadNfc: object({
    ...common,
    room_id: uuid,
    tag: { type: "string", minLength: 8, maxLength: 256 },
  }),
  tv1Biometric: object({
    ...common,
    challenge_id: uuid,
    evidence: { type: "string", minLength: 32, maxLength: 4096 },
  }),
  tv1Order: object({
    ...common,
    episode_id: uuid,
    items: array(
      object(
        {
          product_id: uuid,
          quantity: amount,
          clinical_order_version_id: uuid,
          program_id: uuid,
        },
        ["product_id", "quantity"],
      ),
      1,
    ),
  }),
  tv1Context: object({
    ...common,
    auth_session_id: uuid,
    orders: { ...array(uuid, 0, 20), uniqueItems: true },
    adjustments: array(object({ product_id: uuid, quantity: amount })),
  }),
  tv1Session: object({ ...common, context_id: uuid }),
  tv1Physical: object({
    ...common,
    type: choice(...physicalEvents),
    event_id: uuid,
    occurred_at: time,
  }),
  tv1Picking: object({
    ...common,
    task_id: uuid,
    type: choice(...pickingEvents),
    event_id: uuid,
    occurred_at: time,
  }),
};
