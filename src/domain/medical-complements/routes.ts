import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PoolClient } from "pg";
import { authorize, DomainError, one } from "../core.ts";
import type { Actor } from "../core.ts";
import { object, text, time, uuid } from "../schemas.ts";
import {
  attachmentBase64,
  attachmentMime,
  modelAnswers,
  modelFields,
} from "./schemas.ts";
type Auth = <T>(
  req: FastifyRequest,
  work: (tx: PoolClient, a: Actor) => Promise<T>,
) => Promise<T>;
export function registerMedicalComplements(
  app: FastifyInstance,
  authenticated: Auth,
  errors: Record<string, unknown>,
) {
  for (const spec of [
    {
      path: "modelos",
      table: "modelo_evolucao_versao",
      permission: "prontuario:ler",
      columns: "id,codigo,nome,tipo,versao,campos",
      properties: {
        id: uuid,
        codigo: text,
        nome: text,
        tipo: text,
        versao: { type: "integer" },
        campos: modelFields,
      },
    },
    {
      path: "preenchimentos",
      table: "preenchimento_modelo_evolucao",
      permission: "prontuario:conteudo",
      columns: "id,evolucao_versao_id,modelo_versao_id,respostas",
      properties: {
        id: uuid,
        evolucao_versao_id: uuid,
        modelo_versao_id: uuid,
        respostas: modelAnswers,
      },
    },
  ]) {
    app.get(
      `/v1/prontuario/${spec.path}/:id`,
      {
        schema: {
          operationId: `prontuario_${spec.path}_detalhe`,
          security: [{ bearer: [] }],
          params: object({ id: uuid }),
          querystring: object({ unidade_id: uuid }),
          response: { 200: object(spec.properties), ...errors },
        },
      },
      (req) =>
        authenticated(req, async (tx, a) => {
          const unit = (req.query as { unidade_id: string }).unidade_id;
          await authorize(tx, a, spec.permission, unit);
          return one(
            tx,
            `SELECT ${spec.columns} FROM ${spec.table} WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3`,
            [a.organizacao_id, unit, (req.params as { id: string }).id],
          );
        }),
    );
  }
  app.get(
    "/v1/prontuario/anexos/:id/conteudo",
    {
      schema: {
        operationId: "prontuario_anexo_conteudo",
        security: [{ bearer: [] }],
        params: object({ id: uuid }),
        querystring: object({ unidade_id: uuid }),
        response: {
          200: object({
            id: uuid,
            nome: text,
            mime: attachmentMime,
            tamanho: { type: "integer" },
            hash_conteudo: text,
            conteudo_base64: attachmentBase64,
          }),
          ...errors,
        },
      },
    },
    (req) =>
      authenticated(req, async (tx, a) => {
        const unit = (req.query as { unidade_id: string }).unidade_id;
        await authorize(tx, a, "prontuario:conteudo", unit);
        const r = await one(
          tx,
          "SELECT x.id,x.nome,x.mime,x.tamanho,x.hash_conteudo,x.conteudo,v.revogada FROM anexo_evolucao x JOIN anexo_evolucao_consulta v ON v.organizacao_id=x.organizacao_id AND v.id=x.id WHERE x.organizacao_id=$1 AND x.unidade_id=$2 AND x.id=$3",
          [a.organizacao_id, unit, (req.params as { id: string }).id],
        );
        if (r.revogada) throw new DomainError(409, "anexo_revogado");
        return {
          ...r,
          conteudo_base64: (r.conteudo as Buffer).toString("base64"),
        };
      }),
  );
  app.get(
    "/v1/prontuario/busca",
    {
      schema: {
        operationId: "prontuario_busca_textual",
        security: [{ bearer: [] }],
        querystring: object(
          {
            unidade_id: uuid,
            paciente_id: uuid,
            episodio_id: uuid,
            q: { ...text, minLength: 3 },
            historico: { type: "boolean", default: false },
            limit: { type: "integer", minimum: 1, maximum: 50, default: 25 },
            cursor: uuid,
          },
          ["unidade_id", "paciente_id", "q"],
        ),
        response: {
          200: object({
            items: {
              type: "array",
              items: object({
                id: uuid,
                evolucao_id: uuid,
                paciente_id: uuid,
                episodio_id: uuid,
                versao: { type: "integer" },
                estado: text,
                atual: { type: "boolean" },
                hash_conteudo: text,
                ocorrida_em: time,
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
        const q = req.query as {
          unidade_id: string;
          paciente_id: string;
          episodio_id?: string;
          q: string;
          historico: boolean;
          limit: number;
          cursor?: string;
        };
        await authorize(tx, a, "prontuario:conteudo", q.unidade_id);
        const rows = (
          await tx.query(
            `SELECT v.id,v.evolucao_id,v.paciente_id,v.episodio_id,v.versao,v.estado,v.atual,v.hash_conteudo,v.ocorrida_em FROM evolucao_clinica_versao_consulta v JOIN evolucao_clinica_versao d ON d.organizacao_id=v.organizacao_id AND d.id=v.id WHERE v.organizacao_id=$1 AND v.unidade_id=$2 AND v.paciente_id=$3 AND ($4::uuid IS NULL OR v.episodio_id=$4) AND ($5::boolean OR (v.atual AND v.estado='registrada')) AND ($6::uuid IS NULL OR v.id>$6) AND to_tsvector('portuguese',d.conteudo) @@ websearch_to_tsquery('portuguese',$7) ORDER BY v.id LIMIT $8`,
            [
              a.organizacao_id,
              q.unidade_id,
              q.paciente_id,
              q.episodio_id ?? null,
              q.historico,
              q.cursor ?? null,
              q.q,
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
