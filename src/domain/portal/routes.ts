import type { FastifyInstance, FastifyRequest } from "fastify";
import type pg from "pg";
import { digest, DomainError } from "../core.ts";
import { object, uuid, text } from "../schemas.ts";
import { auditedTransaction } from "../links-audit/read-audit.ts";
export function registerPortal(
  app: FastifyInstance,
  db: pg.Pool,
  errors: Record<string, unknown>,
) {
  async function authenticated<T>(
    req: FastifyRequest,
    work: (tx: pg.PoolClient, account: string) => Promise<T>,
  ) {
    const token = req.headers.authorization?.match(
      /^Bearer ([a-f0-9]{64})$/,
    )?.[1];
    if (!token) throw new DomainError(401, "credencial_portal_invalida");
    const identity = (
      await db.query("SELECT * FROM hvb.autenticar_portal($1)", [digest(token)])
    ).rows[0];
    if (!identity) throw new DomainError(401, "credencial_portal_invalida");
    return auditedTransaction(db, req, identity, async (tx) => {
      await tx.query("SELECT travar_conta_portal($1,$2)", [
        identity.organizacao_id,
        identity.conta_portal_id,
      ]);
      const valid = await tx.query(
        "SELECT id FROM credencial_portal WHERE id=$1 AND expira_em>now() AND conta_portal_ativa(organizacao_id,conta_portal_id)",
        [identity.credencial_id],
      );
      if (!valid.rowCount)
        throw new DomainError(401, "credencial_portal_invalida");
      return work(tx, identity.conta_portal_id);
    });
  }
  const meta = {
    id: uuid,
    paciente_id: uuid,
    finalidade: text,
    titulo: text,
    situacao: text,
    criada_em: { type: "string" },
  };
  const accessible =
    "conta_portal_id=$1 AND acesso_vigente AND situacao IN ('entregue','lido')";
  app.get(
    "/v1/portal/caixa",
    {
      schema: {
        operationId: "portal_caixa",
        security: [{ portalBearer: [] }],
        querystring: object(
          {
            limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
            cursor: uuid,
          },
          [],
        ),
        response: {
          200: object({
            items: { type: "array", items: object(meta) },
            next_cursor: { ...uuid, nullable: true },
          }),
          ...errors,
        },
      },
    },
    (req) =>
      authenticated(req, async (tx, account) => {
        const q = req.query as { limit: number; cursor?: string };
        const r = await tx.query(
          `SELECT id,paciente_id,finalidade,titulo,situacao,criada_em FROM mensagem_portal_consulta WHERE ${accessible} AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3`,
          [account, q.cursor ?? null, q.limit + 1],
        );
        const items = r.rows.slice(0, q.limit);
        return {
          items,
          next_cursor: r.rows.length > q.limit ? items.at(-1)?.id : null,
        };
      }),
  );
  app.get(
    "/v1/portal/mensagens/:id",
    {
      schema: {
        operationId: "portal_mensagem",
        security: [{ portalBearer: [] }],
        params: object({ id: uuid }),
        response: {
          200: object({
            ...meta,
            texto: { type: "string" },
            documentos: {
              type: "array",
              items: object({
                id: uuid,
                conteudo: { type: "string" },
                hash_conteudo: { type: "string" },
              }),
            },
          }),
          ...errors,
        },
      },
    },
    (req) =>
      authenticated(req, async (tx, account) => {
        const id = (req.params as { id: string }).id;
        // One statement checks current grants, source authorization and exact document versions.
        const r = await tx.query(
          `SELECT v.id,v.paciente_id,v.finalidade,v.titulo,v.situacao,v.criada_em,m.texto,coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'conteudo',d.conteudo,'hash_conteudo',d.hash_conteudo) ORDER BY d.id) FROM mensagem_documento md JOIN documento_versao d ON d.organizacao_id=md.organizacao_id AND d.id=md.documento_versao_id WHERE md.organizacao_id=v.organizacao_id AND md.mensagem_id=v.id),'[]'::jsonb) documentos FROM mensagem_portal_consulta v JOIN mensagem_portal m ON m.organizacao_id=v.organizacao_id AND m.id=v.id WHERE ${accessible} AND v.id=$2`,
          [account, id],
        );
        if (!r.rowCount) throw new DomainError(404, "mensagem_indisponivel");
        return r.rows[0];
      }),
  );
}
