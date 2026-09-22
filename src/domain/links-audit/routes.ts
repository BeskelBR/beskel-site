import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PoolClient } from "pg";
import { authorize, DomainError } from "../core.ts";
import type { Actor } from "../core.ts";
import { object, text, time, uuid } from "../schemas.ts";
type Auth = <T>(
  req: FastifyRequest,
  work: (tx: PoolClient, a: Actor) => Promise<T>,
) => Promise<T>;
export function registerReadAudit(
  app: FastifyInstance,
  authenticated: Auth,
  errors: Record<string, unknown>,
) {
  app.get(
    "/v1/auditoria/leituras",
    {
      schema: {
        operationId: "auditoria_leituras",
        security: [{ bearer: [] }],
        querystring: object(
          {
            inicio: time,
            fim: time,
            unidade_id: uuid,
            usuario_id: uuid,
            conta_portal_id: uuid,
            correlation_id: uuid,
            cursor: uuid,
            limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
          },
          ["inicio", "fim"],
        ),
        response: {
          200: object({
            items: {
              type: "array",
              items: object({
                id: uuid,
                unidade_id: { ...uuid, nullable: true },
                usuario_id: { ...uuid, nullable: true },
                conta_portal_id: { ...uuid, nullable: true },
                correlation_id: uuid,
                rota: text,
                metodo: text,
                status_consulta: { type: "integer" },
                parametros: { type: "object", additionalProperties: uuid },
                criada_em: time,
              }),
            },
            next_cursor: { ...uuid, nullable: true },
          }),
          ...errors,
        },
      },
    },
    (req) =>
      authenticated(req, async (tx, a) => {
        // Cross-unit support requires an organization-wide assignment, not a unit role.
        await authorize(tx, a, "auditoria:leituras");
        const q = req.query as {
          inicio: string;
          fim: string;
          unidade_id?: string;
          usuario_id?: string;
          conta_portal_id?: string;
          correlation_id?: string;
          cursor?: string;
          limit: number;
        };
        const span = Date.parse(q.fim) - Date.parse(q.inicio);
        if (span <= 0 || span > 31 * 86400000)
          throw new DomainError(400, "periodo_auditoria_maximo_31_dias");
        const rows = (
          await tx.query(
            "SELECT id,unidade_id,usuario_id,conta_portal_id,correlation_id,rota,metodo,status_consulta,parametros,criada_em FROM leitura_auditada WHERE organizacao_id=$1 AND criada_em>=$2 AND criada_em<$3 AND ($4::uuid IS NULL OR unidade_id=$4) AND ($5::uuid IS NULL OR usuario_id=$5) AND ($6::uuid IS NULL OR conta_portal_id=$6) AND ($7::uuid IS NULL OR correlation_id=$7) AND ($8::uuid IS NULL OR id>$8) ORDER BY id LIMIT $9",
            [
              a.organizacao_id,
              q.inicio,
              q.fim,
              q.unidade_id ?? null,
              q.usuario_id ?? null,
              q.conta_portal_id ?? null,
              q.correlation_id ?? null,
              q.cursor ?? null,
              q.limit + 1,
            ],
          )
        ).rows;
        const items = rows.slice(0, q.limit);
        return {
          items,
          next_cursor: rows.length > q.limit ? items.at(-1)?.id : null,
        };
      }),
  );
}
