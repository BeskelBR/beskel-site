import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PoolClient } from "pg";
import { authorize, DomainError, one } from "../core.ts";
import type { Actor } from "../core.ts";
import { object, text, time, uuid } from "../schemas.ts";
import { registryDefinitions } from "./service.ts";
type Auth = <T>(
  req: FastifyRequest,
  work: (tx: PoolClient, a: Actor) => Promise<T>,
) => Promise<T>;
const pagination = {
  cursor: uuid,
  limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
};
const revision = {
  id: uuid,
  versao: { type: "integer" },
  anterior_id: { ...uuid, nullable: true },
  autor_id: uuid,
  comando_id: uuid,
  motivo: text,
  criada_em: time,
};
export function registerRegistryCorrections(
  app: FastifyInstance,
  authenticated: Auth,
  errors: Record<string, unknown>,
) {
  for (const d of registryDefinitions) {
    const required = Object.keys(d.fields).filter(
      (k) =>
        ![
          "cpf",
          "telefone_whatsapp",
          "email",
          "data_nascimento",
          "cep",
          "logradouro",
          "numero",
          "complemento",
          "bairro",
          "cidade",
          "uf",
          "sexo",
          "raca",
          "microchip",
          "pelagem",
          "castrado",
          "observacoes",
          "contato_emergencia_nome",
          "contato_emergencia_telefone",
          "contato_emergencia_vinculo",
        ].includes(k),
    );
    app.get(
      `/v1/${d.path}/:id/revisoes`,
      {
        schema: {
          operationId: `cadastro_revisoes_${d.type}`,
          security: [{ bearer: [] }],
          params: object({ id: uuid }),
          querystring: object(
            { ...pagination, ...(d.unit ? { unidade_id: uuid } : {}) },
            d.unit ? ["unidade_id"] : [],
          ),
          response: {
            200: object({
              id: uuid,
              versao: { type: "integer" },
              atual: object(d.fields, required),
              items: {
                type: "array",
                items: object({
                  ...revision,
                  antes: object(d.fields, required),
                  depois: object(d.fields, required),
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
          const id = (req.params as { id: string }).id,
            q = req.query as {
              unidade_id?: string;
              cursor?: string;
              limit: number;
            };
          await authorize(tx, a, d.read, q.unidade_id);
          await tx.query(
            "SELECT pg_advisory_xact_lock_shared(hashtextextended('cadastro:'||$1::text||':'||$2::text||':'||$3::text,0))",
            [a.organizacao_id, d.type, id],
          );
          const current = await one(
            tx,
            `SELECT ${Object.keys(d.fields)
              .map((c) =>
                c === "data_nascimento"
                  ? "data_nascimento::text AS data_nascimento"
                  : c,
              )
              .join(
                ",",
              )}${d.unit ? ",unidade_id" : ""} FROM ${d.table} WHERE organizacao_id=$1 AND id=$2`,
            [a.organizacao_id, id],
          );
          if (d.unit && current.unidade_id !== q.unidade_id)
            throw new DomainError(404, "registro_nao_encontrado");
          const version = (
            await tx.query(
              "SELECT coalesce(max(versao),0)::int versao FROM revisao_cadastro WHERE organizacao_id=$1 AND tipo=$2 AND alvo_id=$3",
              [a.organizacao_id, d.type, id],
            )
          ).rows[0].versao;
          const rows = (
            await tx.query(
              "SELECT id,versao,anterior_id,autor_id,comando_id,motivo,criada_em,antes,depois FROM revisao_cadastro WHERE organizacao_id=$1 AND tipo=$2 AND alvo_id=$3 AND ($4::uuid IS NULL OR id>$4) ORDER BY id LIMIT $5",
              [a.organizacao_id, d.type, id, q.cursor ?? null, q.limit + 1],
            )
          ).rows;
          const items = rows.slice(0, q.limit);
          return {
            id,
            versao: version,
            atual: current,
            items,
            next_cursor: rows.length > q.limit ? items.at(-1)?.id : null,
          };
        }),
    );
  }
  app.get(
    "/v1/atribuicoes/:id/revisoes",
    {
      schema: {
        operationId: "atribuicao_revisoes",
        security: [{ bearer: [] }],
        params: object({ id: uuid }),
        querystring: object(pagination, []),
        response: {
          200: object({
            id: uuid,
            usuario_id: uuid,
            papel_id: uuid,
            unidade_id: { ...uuid, nullable: true },
            ativo: { type: "boolean" },
            versao: { type: "integer" },
            usuario_nome: text,
            papel_nome: text,
            escopo: { type: "string", enum: ["global", "unidade"] },
            unidade_nome: { ...text, nullable: true },
            items: {
              type: "array",
              items: object({ ...revision, ativo: { type: "boolean" } }),
            },
            next_cursor: { ...uuid, nullable: true },
          }),
          ...errors,
        },
      },
    },
    (req) =>
      authenticated(req, async (tx, a) => {
        await authorize(tx, a, "acesso:administrar");
        const id = (req.params as { id: string }).id,
          q = req.query as { cursor?: string; limit: number };
        const target = await one(
          tx,
          "SELECT usuario_id FROM usuario_papel WHERE organizacao_id=$1 AND id=$2",
          [a.organizacao_id, id],
        );
        await tx.query(
          "SELECT pg_advisory_xact_lock_shared(hashtextextended('acesso:'||$1::text||':'||$2::text,0))",
          [a.organizacao_id, target.usuario_id],
        );
        const current = await one(
          tx,
          "SELECT id,usuario_id,papel_id,unidade_id,ativo,versao,usuario_nome,papel_nome,escopo,unidade_nome FROM atribuicao_consulta WHERE organizacao_id=$1 AND id=$2",
          [a.organizacao_id, id],
        );
        const rows = (
          await tx.query(
            "SELECT id,versao,anterior_id,autor_id,comando_id,motivo,criada_em,ativo FROM revisao_atribuicao WHERE organizacao_id=$1 AND atribuicao_id=$2 AND ($3::uuid IS NULL OR id>$3) ORDER BY id LIMIT $4",
            [a.organizacao_id, id, q.cursor ?? null, q.limit + 1],
          )
        ).rows;
        const items = rows.slice(0, q.limit);
        return {
          ...current,
          items,
          next_cursor: rows.length > q.limit ? items.at(-1)?.id : null,
        };
      }),
  );
}
