import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PoolClient } from "pg";
import { authorize, DomainError, one } from "../core.ts";
import type { Actor } from "../core.ts";
import { object, uuid, text, time } from "../schemas.ts";
type Auth = <T>(
  req: FastifyRequest,
  work: (tx: PoolClient, a: Actor) => Promise<T>,
) => Promise<T>;
export function registerTerminal(
  app: FastifyInstance,
  authenticated: Auth,
  errors: Record<string, unknown>,
) {
  app.get(
    "/v1/terminal/comandos/:chave",
    {
      schema: {
        operationId: "terminal_consultar_comando",
        security: [{ bearer: [] }],
        params: object({
          chave: { type: "string", pattern: "^[A-Za-z0-9._:-]{8,128}$" },
        }),
        querystring: object({ unidade_id: uuid }),
        headers: {
          ...object({ "x-device-id": uuid }),
          additionalProperties: true,
        },
        response: {
          200: object({
            comando_id: uuid,
            entidade_id: { ...uuid, nullable: true },
            operacao: text,
            estado: { type: "string", enum: ["confirmado", "pendente"] },
            recebido_em: time,
            concluido_em: { ...time, nullable: true },
          }),
          ...errors,
        },
      },
    },
    (req) =>
      authenticated(req, async (tx, a) => {
        const unit = (req.query as { unidade_id: string }).unidade_id,
          device = req.headers["x-device-id"] as string;
        await authorize(tx, a, "terminal:ler", unit);
        await authorize(tx, a, "dispositivos:usar", unit);
        const d = await one(
          tx,
          "SELECT ativo FROM dispositivo WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3 FOR SHARE",
          [a.organizacao_id, unit, device],
        );
        if (!d.ativo) throw new DomainError(403, "dispositivo_inativo");
        return one(
          tx,
          "SELECT id AS comando_id,(resultado->>'id')::uuid AS entidade_id,operacao,CASE WHEN concluido_em IS NULL THEN 'pendente' ELSE 'confirmado' END AS estado,recebido_em,concluido_em FROM comando WHERE organizacao_id=$1 AND autor_id=$2 AND dispositivo_id=$3 AND chave=$4",
          [
            a.organizacao_id,
            a.usuario_id,
            device,
            (req.params as { chave: string }).chave,
          ],
        );
      }),
  );
}
