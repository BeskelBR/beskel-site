import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PoolClient } from "pg";
import type { Actor } from "./core.ts";
import { object, text, uuid } from "./schemas.ts";

export function registerWebContext(
  app: FastifyInstance,
  authenticated: <T>(
    req: FastifyRequest,
    work: (tx: PoolClient, a: Actor) => Promise<T>,
  ) => Promise<T>,
  errors: Record<string, unknown>,
) {
  app.get(
    "/v1/me/contexto",
    {
      schema: {
        operationId: "contexto_do_proprio_usuario",
        security: [{ bearer: [] }],
        response: {
          200: object({
            organizacao_id: uuid,
            usuario_id: uuid,
            nome_usuario: text,
            permissoes_globais: { type: "array", items: text },
            unidades: {
              type: "array",
              items: object({
                id: uuid,
                nome: text,
                fuso: text,
                permissoes: { type: "array", items: text },
              }),
            },
          }),
          ...errors,
        },
      },
    },
    (req) =>
      authenticated(req, async (tx, actor) => {
        await tx.query(
          "SELECT pg_advisory_xact_lock_shared(hashtextextended('acesso:'||$1::text||':'||$2::text,0))",
          [actor.organizacao_id, actor.usuario_id],
        );
        const permissions = await tx.query(
          `SELECT DISTINCT up.unidade_id, pp.permissao
      FROM atribuicao_consulta up JOIN papel_permissao pp ON (pp.organizacao_id,pp.papel_id)=(up.organizacao_id,up.papel_id)
      WHERE up.organizacao_id=$1 AND up.usuario_id=$2 AND up.ativo ORDER BY up.unidade_id,pp.permissao`,
          [actor.organizacao_id, actor.usuario_id],
        );
        const global = permissions.rows
          .filter((p) => !p.unidade_id)
          .map((p) => p.permissao as string);
        const unitIds = [
          ...new Set(permissions.rows.map((p) => p.unidade_id).filter(Boolean)),
        ];
        const units = await tx.query(
          "SELECT id,nome,fuso FROM unidade_hospitalar WHERE organizacao_id=$1 AND ($2::boolean OR id=ANY($3::uuid[])) ORDER BY nome,id",
          [actor.organizacao_id, global.length > 0, unitIds],
        );
        const user = await tx.query(
          "SELECT nome FROM usuario WHERE organizacao_id=$1 AND id=$2",
          [actor.organizacao_id, actor.usuario_id],
        );
        return {
          organizacao_id: actor.organizacao_id,
          usuario_id: actor.usuario_id,
          nome_usuario: user.rows[0].nome,
          permissoes_globais: global,
          unidades: units.rows.map((u) => ({
            ...u,
            permissoes: [
              ...new Set([
                ...global,
                ...permissions.rows
                  .filter((p) => p.unidade_id === u.id)
                  .map((p) => p.permissao),
              ]),
            ].sort(),
          })),
        };
      }),
  );
}
