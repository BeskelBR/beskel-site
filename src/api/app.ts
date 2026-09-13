import { randomUUID } from "node:crypto";
import Fastify, { LogController } from "fastify";
import swagger from "@fastify/swagger";
import type { FastifyRequest } from "fastify";
import type pg from "pg";
import { authorize, command, digest, DomainError } from "../domain/core.ts";
import type { Actor } from "../domain/core.ts";
import { actions, lists } from "../domain/foundation.ts";
import type { Body } from "../domain/foundation.ts";
import { inputs, object, uuid, text } from "../domain/schemas.ts";
import { transaction } from "../persistence/database.ts";
import {
  inventoryActions,
  inventoryLists,
} from "../domain/inventory/service.ts";
import { inventoryInputs, amount } from "../domain/inventory/schemas.ts";
import { clinicalActions, clinicalLists } from "../domain/clinical/service.ts";
import { clinicalInputs } from "../domain/clinical/schemas.ts";

function strictValues(schema: unknown, value: unknown): void {
  if (value === undefined) return;
  const field = schema as {
    properties?: Record<string, unknown>;
    items?: unknown;
    const?: unknown;
  };
  if (schema === amount && typeof value !== "string")
    throw new DomainError(400, "decimais_devem_ser_strings");
  if (field.const === true && value !== true)
    throw new DomainError(400, "confirmacao_humana_explicita_obrigatoria");
  if (field.items && Array.isArray(value))
    for (const item of value) strictValues(field.items, item);
  if (
    field.properties &&
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  )
    for (const [key, child] of Object.entries(field.properties))
      strictValues(child, (value as Record<string, unknown>)[key]);
}

const errorSchema = object({ erro: text, correlation_id: uuid });
const errors = Object.fromEntries(
  [400, 401, 403, 404, 409, 413, 415, 503, 500].map((code) => [
    code,
    errorSchema,
  ]),
);
const headers = object(
  {
    authorization: { type: "string", pattern: "^Bearer [a-f0-9]{64}$" },
    "idempotency-key": { type: "string", pattern: "^[A-Za-z0-9._:-]{8,128}$" },
    "x-device-id": uuid,
  },
  ["authorization", "idempotency-key"],
);
headers.additionalProperties = true;
export async function buildApp(db: pg.Pool, logging = false) {
  const app = Fastify({
    bodyLimit: 32768,
    logger: logging,
    logController: new LogController({ disableRequestLogging: true }),
    genReqId: () => randomUUID(),
    requestTimeout: 10000,
    connectionTimeout: 10000,
    ajv: { customOptions: { removeAdditional: false } },
    forceCloseConnections: true,
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "HVB Sistema — Fundação, Estoque e Clínica",
        version: "0.3.0",
      },
      servers: [{ url: "http://127.0.0.1:3100" }],
      components: {
        securitySchemes: {
          bearer: { type: "http", scheme: "bearer", bearerFormat: "opaque" },
        },
      },
    },
  });
  app.addHook("onRequest", async (req, reply) => {
    reply.header("x-correlation-id", req.id);
    reply.header("cache-control", "no-store");
    reply.header("x-content-type-options", "nosniff");
  });
  app.addHook("onResponse", async (req, reply) => {
    app.log.info(
      {
        correlation_id: req.id,
        route: req.routeOptions.url,
        method: req.method,
        status: reply.statusCode,
        duration_ms: reply.elapsedTime,
      },
      "http",
    );
  });
  app.setErrorHandler((error, req, reply) => {
    const e = error as {
      code?: string;
      statusCode?: number;
      validation?: unknown;
    };
    let status = 500;
    let code = "erro_interno";
    if (error instanceof DomainError) {
      status = error.statusCode;
      code = error.code;
    } else if (
      e.validation ||
      ["FST_ERR_CTP_INVALID_JSON_BODY", "FST_ERR_CTP_EMPTY_JSON_BODY"].includes(
        e.code ?? "",
      )
    ) {
      status = 400;
      code = "requisicao_invalida";
    } else if (
      ["23503", "23505", "23514", "23P01", "P0002"].includes(e.code ?? "")
    ) {
      status = 409;
      code = "conflito_de_integridade";
    } else if (e.code === "22003") {
      status = 400;
      code = "quantidade_fora_do_limite";
    } else if (
      ["55P03", "57014", "40P01", "40001", "ECONNREFUSED", "57P01"].includes(
        e.code ?? "",
      )
    ) {
      status = 503;
      code = "temporariamente_indisponivel_repita_mesma_chave";
    } else if (e.statusCode === 413 || e.statusCode === 415) {
      status = e.statusCode;
      code = "corpo_invalido";
    }
    if (status === 500)
      app.log.error(
        { correlation_id: req.id, code: e.code ?? "unknown" },
        "request_failed",
      );
    reply.code(status).send({ erro: code, correlation_id: req.id });
  });
  app.setNotFoundHandler((req, reply) =>
    reply
      .code(404)
      .send({ erro: "rota_nao_encontrada", correlation_id: req.id }),
  );
  async function authenticated<T>(
    req: FastifyRequest,
    work: (tx: pg.PoolClient, a: Actor) => Promise<T>,
  ) {
    const token = req.headers.authorization?.match(
      /^Bearer ([a-f0-9]{64})$/,
    )?.[1];
    if (!token) throw new DomainError(401, "credencial_invalida");
    const identity = await db.query("SELECT * FROM hvb.autenticar($1)", [
      digest(token),
    ]);
    const actor = identity.rows[0] as Actor | undefined;
    if (!actor) throw new DomainError(401, "credencial_invalida");
    return transaction(db, actor.organizacao_id, async (tx) => {
      // Serialize revocation/deactivation against already authorized mutations.
      const valid = await tx.query(
        `SELECT c.id FROM credencial c JOIN usuario u
        ON (u.organizacao_id,u.id)=(c.organizacao_id,c.usuario_id)
        WHERE c.id=$1 AND c.revogada_em IS NULL AND c.expira_em>now() AND u.ativo FOR SHARE OF c,u`,
        [actor.credencial_id],
      );
      if (!valid.rowCount) throw new DomainError(401, "credencial_invalida");
      return work(tx, actor);
    });
  }
  app.get(
    "/health",
    {
      schema: {
        response: { 200: object({ status: { const: "ok", type: "string" } }) },
      },
    },
    async () => ({ status: "ok" }),
  );
  app.get(
    "/ready",
    {
      schema: {
        response: {
          200: object({ status: { const: "ready", type: "string" } }),
          ...errors,
        },
      },
    },
    async () => {
      try {
        const r = await db.query(
          "SELECT EXISTS(SELECT 1 FROM public.schema_migration WHERE nome='013_clinical_traceability.sql') AS ready, current_user AS role",
        );
        if (!r.rows[0].ready || r.rows[0].role !== "hvb_app")
          throw new Error("not ready");
        return { status: "ready" };
      } catch {
        throw new DomainError(503, "banco_ou_schema_indisponivel");
      }
    },
  );
  app.get(
    "/v1/me",
    {
      schema: {
        security: [{ bearer: [] }],
        response: {
          200: object({
            organizacao_id: uuid,
            usuario_id: uuid,
            credencial_id: uuid,
          }),
          ...errors,
        },
      },
    },
    (req) => authenticated(req, async (_tx, a) => a),
  );
  app.get(
    "/v1/organizacao",
    {
      schema: {
        security: [{ bearer: [] }],
        response: { 200: object({ id: uuid, nome: text }), ...errors },
      },
    },
    (req) =>
      authenticated(req, async (tx, a) => {
        await authorize(tx, a, "cadastros:ler");
        return (
          await tx.query("SELECT id,nome FROM organizacao WHERE id=$1", [
            a.organizacao_id,
          ])
        ).rows[0];
      }),
  );
  const allInputs: Record<string, unknown> = {
    ...inputs,
    ...inventoryInputs,
    ...clinicalInputs,
  };
  for (const action of [...actions, ...inventoryActions, ...clinicalActions]) {
    app.post(
      `/v1${action.path}`,
      {
        preValidation: async (req) => {
          strictValues(allInputs[action.input], req.body);
        },
        schema: {
          operationId: `post_${action.path.replace(/[^a-z]/g, "_")}`,
          security: [{ bearer: [] }],
          headers,
          body: allInputs[action.input],
          ...(action.path.includes(":id")
            ? { params: object({ id: uuid }) }
            : {}),
          response: {
            200: object(
              {
                id: uuid,
                comando_id: uuid,
                estado: { type: "string", const: "confirmado" },
                repetido: { type: "boolean" },
                versao: { type: "integer" },
                ordem_id: uuid,
                ordem_versao_id: uuid,
              },
              ["id", "comando_id", "estado", "repetido"],
            ),
            ...errors,
          },
        },
      },
      (req) =>
        authenticated(req, async (tx, a) => {
          const body = req.body as Body;
          const id = (req.params as { id?: string }).id ?? "";
          const unit = action.scope
            ? await action.scope(tx, a, body, id)
            : undefined;
          await authorize(tx, a, action.permission, unit);
          const device = req.headers["x-device-id"] as string | undefined;
          if (device && unit) {
            const d = await tx.query(
              "SELECT 1 FROM dispositivo WHERE organizacao_id=$1 AND id=$2 AND unidade_id=$3",
              [a.organizacao_id, device, unit],
            );
            if (!d.rowCount)
              throw new DomainError(403, "dispositivo_fora_da_unidade");
          }
          return command(
            tx,
            a,
            req.headers["idempotency-key"] as string,
            action.path,
            { id, body },
            device,
            req.id,
            (commandId) => action.run(tx, a, body, id, commandId),
          );
        }),
    );
  }
  for (const list of [...lists, ...inventoryLists, ...clinicalLists]) {
    const stockPosition = list.table === "posicao_estoque";
    const stockLedger = list.table === "lancamento_estoque_consulta";
    const clinical = list.path.startsWith("/clinica/");
    const schedule = list.table === "programacao_consulta";
    const clinicalFilters = clinical
      ? [
          "episodio_id",
          "ordem_id",
          "ordem_versao_id",
          "programacao_id",
          "execucao_id",
          "consumo_id",
          "produto_id",
          "item_clinico_id",
        ].filter((f) => list.columns.split(",").includes(f))
      : [];
    const query = object(
      {
        limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
        cursor: uuid,
        ...(list.unit ? { unidade_id: uuid } : {}),
        ...(stockPosition
          ? {
              produto_id: uuid,
              lote_id: uuid,
              local_id: uuid,
              custodia_id: uuid,
              disponiveis: { type: "boolean" },
            }
          : {}),
        ...(stockLedger ? { transacao_id: uuid } : {}),
        ...Object.fromEntries(clinicalFilters.map((f) => [f, uuid])),
        ...(schedule
          ? {
              inicio: { type: "string", format: "date-time" },
              fim: { type: "string", format: "date-time" },
            }
          : {}),
        ...(list.table === "pendencia_clinica_consulta"
          ? { situacao: { type: "string", enum: ["aberta", "resolvida"] } }
          : {}),
        ...(list.table === "episodio"
          ? { paciente_id: uuid, ativos: { type: "boolean" } }
          : {}),
      },
      list.unit ? ["unidade_id", ...(schedule ? ["inicio", "fim"] : [])] : [],
    );
    const properties = Object.fromEntries(
      list.columns.split(",").map((column) => [
        column,
        column === "id" || column.endsWith("_id")
          ? {
              ...uuid,
              nullable: column !== "id",
            }
          : ["ativo"].includes(column)
            ? { type: "boolean" }
            : [
                  "capacidade",
                  "vaga",
                  "versao",
                  "tentativas",
                  "versao_snapshot",
                ].includes(column)
              ? { type: "integer" }
              : { type: "string", nullable: true },
      ]),
    );
    app.get(
      `/v1${list.path}`,
      {
        schema: {
          security: [{ bearer: [] }],
          querystring: query,
          response: {
            200: object({
              items: { type: "array", items: object(properties) },
              next_cursor: { ...uuid, nullable: true },
            }),
            ...errors,
          },
        },
      },
      (req) =>
        authenticated(req, async (tx, a) => {
          const q = req.query as {
            [key: string]: unknown;
            limit: number;
            cursor?: string;
            unidade_id?: string;
            paciente_id?: string;
            ativos?: boolean;
            produto_id?: string;
            lote_id?: string;
            local_id?: string;
            custodia_id?: string;
            transacao_id?: string;
            disponiveis?: boolean;
          };
          await authorize(tx, a, list.permission, q.unidade_id);
          const values: unknown[] = [
            a.organizacao_id,
            q.cursor ?? null,
            q.limit + 1,
          ];
          const where = ["organizacao_id=$1", "($2::uuid IS NULL OR id>$2)"];
          if (list.unit) {
            values.push(q.unidade_id);
            where.push(`unidade_id=$${values.length}`);
          }
          if (q.paciente_id) {
            values.push(q.paciente_id);
            where.push(`paciente_id=$${values.length}`);
          }
          if (q.ativos !== undefined)
            where.push(`encerrado_em IS ${q.ativos ? "" : "NOT "}NULL`);
          for (const field of [
            "lote_id",
            "local_id",
            "custodia_id",
            "transacao_id",
          ] as const) {
            if (q[field]) {
              values.push(q[field]);
              where.push(`${field}=$${values.length}`);
            }
          }
          if (stockPosition && q.produto_id) {
            values.push(q.produto_id);
            where.push(
              `lote_id IN (SELECT id FROM lote WHERE organizacao_id=$1 AND produto_id=$${values.length})`,
            );
          }
          if (stockPosition && q.disponiveis !== undefined)
            where.push(`disponivel_base ${q.disponiveis ? ">" : "="} 0`);
          for (const field of clinicalFilters)
            if (q[field]) {
              values.push(q[field]);
              where.push(`${field}=$${values.length}`);
            }
          if (schedule) {
            const start = Date.parse(q.inicio as string),
              end = Date.parse(q.fim as string);
            if (
              !Number.isFinite(start) ||
              !Number.isFinite(end) ||
              end <= start ||
              end - start > 7 * 86400000
            )
              throw new DomainError(400, "mapa_exige_periodo_de_ate_sete_dias");
            values.push(q.inicio, q.fim);
            where.push(
              `prevista_em>=$${values.length - 1} AND prevista_em<$${values.length}`,
            );
          }
          if (list.table === "pendencia_clinica_consulta" && q.situacao) {
            values.push(q.situacao);
            where.push(`situacao=$${values.length}`);
          }
          const r = await tx.query(
            `SELECT ${list.columns} FROM ${list.table} WHERE ${where.join(" AND ")} ORDER BY id LIMIT $3`,
            values,
          );
          const items = r.rows.slice(0, q.limit);
          return {
            items,
            next_cursor: r.rows.length > q.limit ? items.at(-1)?.id : null,
          };
        }),
    );
  }
  await app.ready();
  return app;
}
