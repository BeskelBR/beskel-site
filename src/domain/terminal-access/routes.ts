import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PoolClient } from "pg";
import { authorize } from "../core.ts";
import type { Actor } from "../core.ts";
import { choice, object, text, time, uuid } from "../schemas.ts";
import { amount } from "../inventory/schemas.ts";
type Auth = <T>(
  req: FastifyRequest,
  work: (tx: PoolClient, a: Actor) => Promise<T>,
) => Promise<T>;
const boolean = { type: "boolean" },
  integer = { type: "integer" };
const common = {
  id: uuid,
  unidade_id: uuid,
  autor_id: uuid,
  comando_id: uuid,
  motivo: text,
  criada_em: time,
};
export function registerTerminalAccess(
  app: FastifyInstance,
  authenticated: Auth,
  errors: Record<string, unknown>,
) {
  const definitions = [
    {
      path: "/retiradas/ordens",
      table: "ordem_retirada_consulta",
      permission: "retiradas:ler",
      owner: false,
      fields: {
        ...common,
        episodio_id: uuid,
        observacao: text,
        estado: choice(
          "RASCUNHO",
          "AGUARDANDO_RETIRADA",
          "EM_SEPARACAO",
          "CANCELADA",
        ),
        versao: integer,
        sensivel: boolean,
      },
    },
    {
      path: "/retiradas/itens",
      table: "item_ordem_retirada",
      permission: "retiradas:ler",
      owner: false,
      fields: {
        ...common,
        ordem_id: uuid,
        produto_id: uuid,
        quantidade_solicitada: amount,
        sensivel: boolean,
        exige_lote: boolean,
        observacao: text,
      },
    },
    {
      path: "/retiradas/eventos",
      table: "evento_ordem_retirada",
      permission: "retiradas:ler",
      owner: false,
      fields: {
        ...common,
        ordem_id: uuid,
        versao: integer,
        estado: text,
        evento_acesso_id: { ...uuid, nullable: true },
      },
    },
    {
      path: "/terminal/acesso/desafios",
      table: "desafio_acesso",
      permission: "terminal:autenticar",
      owner: true,
      fields: { ...common, nonce: uuid, dispositivo_id: uuid, expira_em: time },
    },
    {
      path: "/terminal/acesso/autenticacoes",
      table: "autenticacao_acesso",
      permission: "terminal:autenticar",
      owner: true,
      fields: {
        ...common,
        evidencia_id: uuid,
        dispositivo_id: uuid,
        nivel: text,
        fatores: { type: "array", items: text },
        expira_em: time,
      },
    },
    {
      path: "/terminal/acesso/sessoes",
      table: "sessao_acesso_consulta",
      permission: "terminal:ler",
      owner: true,
      fields: {
        ...common,
        autenticacao_id: uuid,
        dispositivo_id: uuid,
        sensivel: boolean,
        estado: text,
        versao: integer,
        expira_em: time,
        expirada: boolean,
        encerrada_em: { ...time, nullable: true },
      },
    },
    {
      path: "/terminal/acesso/vinculos",
      table: "sessao_ordem_retirada",
      permission: "terminal:ler",
      owner: true,
      fields: { ...common, sessao_id: uuid, ordem_id: uuid },
    },
    {
      path: "/terminal/acesso/eventos",
      table: "evento_acesso",
      permission: "terminal:ler",
      owner: true,
      fields: {
        ...common,
        sessao_id: uuid,
        dispositivo_id: uuid,
        versao: integer,
        tipo: text,
        referencia: uuid,
        ocorrida_em: time,
        origem: text,
      },
    },
  ];
  for (const d of definitions) {
    const fields: Record<string, unknown> = d.fields;
    const filters = [
      "id",
      "ordem_id",
      "sessao_id",
      "episodio_id",
      "dispositivo_id",
      "estado",
    ].filter((k) => k in fields);
    app.get(
      `/v1${d.path}`,
      {
        schema: {
          operationId: `get_${d.table}`,
          security: [{ bearer: [] }],
          querystring: object(
            {
              unidade_id: uuid,
              cursor: uuid,
              limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
              ...Object.fromEntries(filters.map((k) => [k, fields[k]])),
            },
            ["unidade_id"],
          ),
          response: {
            200: object({
              items: { type: "array", items: object(fields) },
              next_cursor: { ...uuid, nullable: true },
            }),
            ...errors,
          },
        },
      },
      (req) =>
        authenticated(req, async (tx, a) => {
          const q = req.query as Record<string, string | number>;
          await authorize(tx, a, d.permission, q.unidade_id as string);
          const values: unknown[] = [a.organizacao_id, q.unidade_id];
          const where = ["organizacao_id=$1", "unidade_id=$2"];
          if (d.owner) {
            values.push(a.usuario_id);
            where.push(`autor_id=$${values.length}`);
          }
          for (const k of filters)
            if (q[k] !== undefined) {
              values.push(q[k]);
              where.push(`${k}=$${values.length}`);
            }
          if (q.cursor) {
            values.push(q.cursor);
            where.push(`id>$${values.length}`);
          }
          values.push(Number(q.limit) + 1);
          const rows = (
            await tx.query(
              `SELECT ${Object.keys(fields).join(",")} FROM ${d.table} WHERE ${where.join(" AND ")} ORDER BY id LIMIT $${values.length}`,
              values,
            )
          ).rows;
          const more = rows.length > Number(q.limit);
          if (more) rows.pop();
          return { items: rows, next_cursor: more ? rows.at(-1)?.id : null };
        }),
    );
  }
}
