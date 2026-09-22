import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PoolClient } from "pg";
import { authorize, one } from "../core.ts";
import type { Actor } from "../core.ts";
import { object, text, time, uuid } from "../schemas.ts";
import { amount } from "../inventory/schemas.ts";
import { bind, fail } from "./shared.ts";
type Auth = <T>(
  req: FastifyRequest,
  work: (tx: PoolClient, a: Actor) => Promise<T>,
) => Promise<T>;
const nullable = (schema: object) => ({ ...schema, nullable: true });
const boolean = { type: "boolean" },
  integer = { type: "integer" };
const sessionFields = {
  access_session_id: uuid,
  organization_id: uuid,
  unit_id: uuid,
  employee_id: uuid,
  user_id: uuid,
  auth_session_id: uuid,
  room_id: uuid,
  access_terminal_device_id: uuid,
  picking_display_device_id: uuid,
  created_at: time,
  expires_at: time,
  state: text,
  sensitive_access_eligible: boolean,
  sensitive_state: text,
  unlock_until: nullable(time),
  timeout_alerted_at: nullable(time),
  entered_at: nullable(time),
  presence_cleared_at: nullable(time),
  door_closed_at: nullable(time),
  closed_at: nullable(time),
};
const sourceFields = {
  demand_id: uuid,
  order_id: nullable(uuid),
  order_item_id: nullable(uuid),
  source_type: text,
  quantity: amount,
};
const taskFields = {
  id: uuid,
  picking_task_id: uuid,
  product_id: uuid,
  quantity: amount,
  confirmed_quantity: amount,
  status: text,
  sensitive: boolean,
  allocation_rank: integer,
  allocation_strategy: text,
  stock_lot_id: nullable(uuid),
  lot_code: nullable(text),
  expiry_date: nullable({ type: "string", format: "date" }),
  expires_at: nullable({ type: "string", format: "date" }),
  received_at: nullable(time),
  location_id: nullable(uuid),
  location_code: nullable(text),
  offered_quantity: nullable(amount),
  sources: { type: "array", items: object(sourceFields) },
};
const snapshotSchema = object({
  session: nullable(object(sessionFields)),
  picking_tasks: { type: "array", items: object(taskFields) },
});
async function snapshot(tx: PoolClient, a: Actor, id: string | null) {
  if (!id) return { session: null, picking_tasks: [] };
  const session = await one(
    tx,
    `SELECT id access_session_id,organizacao_id organization_id,unidade_id unit_id,employee_id,employee_id user_id,auth_session_id,room_id,access_terminal_device_id,picking_display_device_id,criada_em created_at,expires_at,state,sensitive_access_eligible,sensitive_state,unlock_until,timeout_alerted_at,entered_at,presence_cleared_at,door_closed_at,closed_at FROM tv1_session WHERE organizacao_id=$1 AND id=$2`,
    [a.organizacao_id, id],
  );
  const tasks = (
    await tx.query(
      `SELECT t.id,t.product_id,t.quantity,t.confirmed_quantity,t.status,t.sensitive,t.allocation_rank,t.allocation_strategy,
    p.lote_id stock_lot_id,l.codigo lot_code,l.validade::text expiry_date,o.received_at,c.id location_id,c.code location_code,attempt.quantity offered_quantity
    FROM tv1_task t LEFT JOIN LATERAL(SELECT a.* FROM tv1_attempt a WHERE a.organizacao_id=t.organizacao_id AND a.task_id=t.id
      AND NOT EXISTS(SELECT 1 FROM tv1_discrepancy d WHERE d.organizacao_id=a.organizacao_id AND d.attempt_id=a.id) ORDER BY attempt_rank DESC LIMIT 1) attempt ON true
    LEFT JOIN tv1_occupancy o ON (o.organizacao_id,o.id)=(attempt.organizacao_id,attempt.occupancy_id)
    LEFT JOIN posicao_estoque p ON (p.organizacao_id,p.id)=(o.organizacao_id,o.position_id)
    LEFT JOIN lote l ON (l.organizacao_id,l.id)=(p.organizacao_id,p.lote_id)
    LEFT JOIN tv1_coordinate c ON (c.organizacao_id,c.id)=(o.organizacao_id,o.coordinate_id)
    WHERE t.organizacao_id=$1 AND t.access_session_id=$2 ORDER BY t.allocation_rank`,
      [a.organizacao_id, id],
    )
  ).rows;
  const sources = (
    await tx.query(
      `SELECT s.task_id,s.demand_id,i.order_id,d.order_item_id,CASE WHEN d.order_item_id IS NULL THEN 'LIVE_ADJUSTMENT' ELSE 'WITHDRAWAL_ORDER' END source_type,s.quantity
    FROM tv1_source s JOIN tv1_task t ON (t.organizacao_id,t.id)=(s.organizacao_id,s.task_id) JOIN tv1_demand d ON (d.organizacao_id,d.id)=(s.organizacao_id,s.demand_id)
    LEFT JOIN tv1_order_item i ON (i.organizacao_id,i.id)=(d.organizacao_id,d.order_item_id) WHERE t.organizacao_id=$1 AND t.access_session_id=$2 ORDER BY s.source_rank,s.id`,
      [a.organizacao_id, id],
    )
  ).rows;
  return {
    session,
    picking_tasks: tasks.map((t) => ({
      ...t,
      picking_task_id: t.id,
      expires_at: t.expiry_date,
      sources: sources
        .filter((s) => s.task_id === t.id)
        .map(({ task_id: _task, ...s }) => s),
    })),
  };
}
async function readerDevice(
  tx: PoolClient,
  a: Actor,
  req: FastifyRequest,
  unit: string,
  room: string,
  roles: string[],
) {
  const row = (
    await tx.query(
      "SELECT role FROM tv1_device WHERE organizacao_id=$1 AND room_id=$2 AND device_id=$3 AND credential_id=$4 AND role=ANY($5::text[])",
      [
        a.organizacao_id,
        room,
        req.headers["x-device-id"],
        a.credencial_id,
        roles,
      ],
    )
  ).rows[0];
  if (!row) fail("consulta_exige_dispositivo_provisionado", 403);
  await authorize(tx, a, "dispositivos:usar", unit);
  await bind(tx, a, unit, room, row.role, req.headers["x-device-id"] as string);
}
export function registerTerminalV1(
  app: FastifyInstance,
  authenticated: Auth,
  errors: Record<string, unknown>,
) {
  const security = [{ bearer: [] }];
  for (const active of [false, true])
    app.get(
      active
        ? "/v1/terminal/v1/rooms/:id/active-session"
        : "/v1/terminal/v1/access-sessions/:id",
      {
        schema: {
          operationId: active
            ? "tv1_active_room_session"
            : "tv1_session_snapshot",
          security,
          params: object({ id: uuid }),
          querystring: object({ unidade_id: uuid }),
          headers: {
            ...object({ "x-device-id": uuid }),
            additionalProperties: true,
          },
          response: { 200: snapshotSchema, ...errors },
        },
      },
      (req) =>
        authenticated(req, async (tx, a) => {
          const { id } = req.params as { id: string },
            { unidade_id: unit } = req.query as { unidade_id: string };
          const row = await one(
            tx,
            active
              ? "SELECT id room_id FROM tv1_room WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3"
              : "SELECT id,room_id FROM tv1_session WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
            [a.organizacao_id, unit, id],
          );
          await readerDevice(
            tx,
            a,
            req,
            unit,
            row.room_id,
            active ? ["PICKING"] : ["ACCESS", "PICKING", "CONTROLLER"],
          );
          const target = active
            ? ((
                await tx.query(
                  "SELECT id FROM tv1_session WHERE organizacao_id=$1 AND room_id=$2 AND closed_at IS NULL",
                  [a.organizacao_id, id],
                )
              ).rows[0]?.id ?? null)
            : id;
          return snapshot(tx, a, target);
        }),
    );
  for (const auth of [false, true]) {
    const fields = auth
      ? {
          id: uuid,
          employee_id: uuid,
          room_id: uuid,
          access_terminal_device_id: uuid,
          expires_at: time,
        }
      : {
          id: uuid,
          nonce: uuid,
          employee_id: uuid,
          room_id: uuid,
          access_terminal_device_id: uuid,
          expires_at: time,
        };
    app.get(
      `/v1/terminal/v1/${auth ? "auth-sessions" : "challenges"}/:id`,
      {
        schema: {
          operationId: auth ? "tv1_auth_session" : "tv1_biometric_challenge",
          security,
          params: object({ id: uuid }),
          querystring: object({ unidade_id: uuid }),
          headers: {
            ...object({ "x-device-id": uuid }),
            additionalProperties: true,
          },
          response: { 200: object(fields), ...errors },
        },
      },
      (req) =>
        authenticated(req, async (tx, a) => {
          const { id } = req.params as { id: string },
            { unidade_id: unit } = req.query as { unidade_id: string };
          const row = await one(
            tx,
            `SELECT ${Object.keys(fields).join(",")} FROM ${auth ? "tv1_auth" : "tv1_challenge"} WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3`,
            [a.organizacao_id, unit, id],
          );
          await readerDevice(tx, a, req, unit, row.room_id, [
            "ACCESS",
            "BIOMETRIC",
          ]);
          return row;
        }),
    );
  }
  const definitions = [
    {
      path: "rooms",
      table: "tv1_room",
      permission: "acesso:administrar",
      fields: {
        id: uuid,
        local_id: uuid,
        transit_local_id: uuid,
        unlock_seconds: integer,
        session_seconds: integer,
      },
    },
    {
      path: "devices",
      table: "tv1_device",
      permission: "acesso:administrar",
      fields: {
        id: uuid,
        room_id: uuid,
        device_id: uuid,
        role: text,
        mode: text,
      },
    },
    {
      path: "coordinates",
      table: "tv1_coordinate",
      permission: "estoque:ler",
      fields: {
        id: uuid,
        room_id: uuid,
        local_id: uuid,
        code: text,
        sensitive: boolean,
      },
    },
    {
      path: "occupancies",
      table: "tv1_occupancy",
      permission: "estoque:ler",
      fields: {
        id: uuid,
        coordinate_id: uuid,
        position_id: uuid,
        received_at: time,
        released_at: nullable(time),
      },
    },
    {
      path: "withdrawal-orders",
      table: "tv1_order_fulfillment",
      permission: "retiradas:ler",
      fields: {
        id: uuid,
        episode_id: uuid,
        state: text,
        fulfillment_status: nullable(text),
      },
    },
    {
      path: "withdrawal-order-items",
      table: "tv1_order_item",
      permission: "retiradas:ler",
      fields: {
        id: uuid,
        order_id: uuid,
        product_id: uuid,
        quantity: amount,
        clinical_order_version_id: nullable(uuid),
        program_id: nullable(uuid),
      },
    },
    {
      path: "withdrawal-contexts",
      table: "tv1_context",
      permission: "retiradas:ler",
      fields: {
        id: uuid,
        auth_session_id: uuid,
        room_id: uuid,
        employee_id: uuid,
      },
    },
    {
      path: "demands",
      table: "tv1_demand",
      permission: "retiradas:ler",
      fields: {
        id: uuid,
        context_id: uuid,
        order_item_id: nullable(uuid),
        product_id: uuid,
        quantity: amount,
        source_rank: integer,
      },
    },
    {
      path: "fulfillments",
      table: "tv1_fulfillment",
      permission: "retiradas:ler",
      fields: {
        id: uuid,
        access_session_id: uuid,
        demand_id: uuid,
        requested_quantity: amount,
        confirmed_quantity: amount,
        status: text,
      },
    },
    {
      path: "events",
      table: "tv1_event",
      permission: "auditoria:ler",
      fields: {
        id: uuid,
        access_session_id: nullable(uuid),
        challenge_id: nullable(uuid),
        auth_session_id: nullable(uuid),
        context_id: nullable(uuid),
        task_id: nullable(uuid),
        type: text,
        source_device_id: nullable(uuid),
        event_id: uuid,
        idempotency_key: text,
        occurred_at: time,
        criada_em: time,
        automatic: boolean,
        error_code: nullable(text),
      },
    },
    {
      path: "discrepancies",
      table: "tv1_discrepancy",
      permission: "estoque:ler",
      fields: { id: uuid, task_id: uuid, attempt_id: uuid, criada_em: time },
    },
    {
      path: "attempts",
      table: "tv1_attempt",
      permission: "estoque:ler",
      fields: {
        id: uuid,
        task_id: uuid,
        occupancy_id: uuid,
        reservation_id: uuid,
        quantity: amount,
        attempt_rank: integer,
      },
    },
    {
      path: "movements",
      table: "tv1_movement",
      permission: "estoque:ler",
      fields: {
        id: uuid,
        task_id: uuid,
        attempt_id: uuid,
        transaction_id: uuid,
      },
    },
  ];
  for (const d of definitions) {
    const fields: Record<string, unknown> = d.fields;
    const filters = Object.keys(fields).filter(
      (f) => f === "id" || f.endsWith("_id"),
    );
    app.get(
      `/v1/terminal/v1/${d.path}`,
      {
        schema: {
          operationId: `tv1_list_${d.path.replaceAll("-", "_")}`,
          security,
          querystring: object(
            {
              unidade_id: uuid,
              cursor: uuid,
              limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
              ...Object.fromEntries(filters.map((f) => [f, uuid])),
            },
            ["unidade_id"],
          ),
          response: {
            200: object({
              items: { type: "array", items: object(fields) },
              next_cursor: nullable(uuid),
            }),
            ...errors,
          },
        },
      },
      (req) =>
        authenticated(req, async (tx, a) => {
          const q = req.query as Record<string, string>;
          await authorize(tx, a, d.permission, q.unidade_id);
          const values: unknown[] = [a.organizacao_id, q.unidade_id],
            where = ["organizacao_id=$1", "unidade_id=$2"];
          for (const f of filters)
            if (q[f]) {
              values.push(q[f]);
              where.push(`${f}=$${values.length}`);
            }
          if (q.cursor) {
            values.push(q.cursor);
            where.push(`id>$${values.length}`);
          }
          const limit = Number(q.limit ?? 25);
          values.push(limit + 1);
          const rows = (
            await tx.query(
              `SELECT ${Object.keys(fields).join(",")} FROM ${d.table} WHERE ${where.join(" AND ")} ORDER BY id LIMIT $${values.length}`,
              values,
            )
          ).rows;
          return {
            items: rows.slice(0, limit),
            next_cursor: rows.length > limit ? rows[limit - 1]?.id : null,
          };
        }),
    );
  }
  app.get(
    "/v1/terminal/v1/rooms/:id/free-coordinates",
    {
      schema: {
        operationId: "tv1_free_compatible_coordinates",
        security,
        params: object({ id: uuid }),
        querystring: object({ unidade_id: uuid, product_id: uuid }),
        response: {
          200: object({
            items: {
              type: "array",
              items: object({
                id: uuid,
                local_id: uuid,
                code: text,
                sensitive: boolean,
              }),
            },
          }),
          ...errors,
        },
      },
    },
    (req) =>
      authenticated(req, async (tx, a) => {
        const { id } = req.params as { id: string },
          q = req.query as { unidade_id: string; product_id: string };
        await authorize(tx, a, "estoque:ler", q.unidade_id);
        return {
          items: (
            await tx.query(
              `SELECT c.id,c.local_id,c.code,c.sensitive FROM tv1_coordinate c JOIN tv1_product_policy p ON p.organizacao_id=c.organizacao_id AND p.product_id=$4 AND p.sensitive=c.sensitive
      WHERE c.organizacao_id=$1 AND c.unidade_id=$2 AND c.room_id=$3 AND NOT EXISTS(SELECT 1 FROM tv1_occupancy o WHERE o.organizacao_id=c.organizacao_id AND o.coordinate_id=c.id AND o.released_at IS NULL)
      AND NOT EXISTS(SELECT 1 FROM posicao_estoque s WHERE s.organizacao_id=c.organizacao_id AND s.local_id=c.local_id AND (s.saldo_base>0 OR s.reservado_base>0)) ORDER BY c.code,c.id LIMIT 100`,
              [a.organizacao_id, q.unidade_id, id, q.product_id],
            )
          ).rows,
        };
      }),
  );
}
