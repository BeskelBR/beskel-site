import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PoolClient } from "pg";
import { authorize, DomainError, one } from "../core.ts";
import type { Actor } from "../core.ts";
import { object, text, time, uuid } from "../schemas.ts";
import { timelineSources } from "./timeline.ts";
type Auth = <T>(
  req: FastifyRequest,
  work: (tx: PoolClient, a: Actor) => Promise<T>,
) => Promise<T>;
const kinds = [
  "evolucao",
  "episodio",
  "prescricao",
  "ordem",
  "programacao",
  "execucao",
  "consumo",
  "estorno_consumo",
  "resultado_exame",
  "documento",
  "agendamento",
  "aplicacao_externa",
];
const cursor = {
  registrado_em: time,
  tipo: { type: "string", enum: kinds },
  id: uuid,
};
export function registerMedicalRecord(
  app: FastifyInstance,
  authenticated: Auth,
  errors: Record<string, unknown>,
) {
  app.get(
    "/v1/prontuario/versoes/:id",
    {
      schema: {
        operationId: "prontuario_conteudo",
        security: [{ bearer: [] }],
        params: object({ id: uuid }),
        querystring: object({ unidade_id: uuid }),
        response: {
          200: object({
            id: uuid,
            evolucao_id: uuid,
            paciente_id: uuid,
            episodio_id: uuid,
            versao: { type: "integer" },
            estado: text,
            conteudo: { type: "string" },
            hash_conteudo: text,
            autor_id: uuid,
            ocorrida_em: time,
            criada_em: time,
            atual: { type: "boolean" },
            revisao_temporal: { type: "boolean" },
          }),
          ...errors,
        },
      },
    },
    (req) =>
      authenticated(req, async (tx, a) => {
        const q = req.query as { unidade_id: string };
        await authorize(tx, a, "prontuario:conteudo", q.unidade_id);
        return one(
          tx,
          "SELECT v.id,v.evolucao_id,v.paciente_id,v.episodio_id,v.versao,v.estado,d.conteudo,v.hash_conteudo,v.autor_id,v.ocorrida_em,v.criada_em,v.atual,v.revisao_temporal FROM evolucao_clinica_versao_consulta v JOIN evolucao_clinica_versao d ON d.organizacao_id=v.organizacao_id AND d.id=v.id WHERE v.organizacao_id=$1 AND v.unidade_id=$2 AND v.id=$3",
          [a.organizacao_id, q.unidade_id, (req.params as { id: string }).id],
        );
      }),
  );
  app.get(
    "/v1/prontuario/linha-do-tempo",
    {
      schema: {
        operationId: "prontuario_timeline",
        security: [{ bearer: [] }],
        querystring: object(
          {
            unidade_id: uuid,
            paciente_id: uuid,
            episodio_id: uuid,
            inicio_registro: time,
            fim_registro: time,
            fontes: {
              type: "string",
              maxLength: 100,
              default: "evolucoes,clinica",
            },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
            apos_registro: time,
            apos_tipo: cursor.tipo,
            apos_id: uuid,
          },
          ["unidade_id", "paciente_id", "inicio_registro", "fim_registro"],
        ),
        response: {
          200: object({
            items: {
              type: "array",
              items: object({
                id: uuid,
                paciente_id: uuid,
                episodio_id: { ...uuid, nullable: true },
                autor_id: uuid,
                tipo: cursor.tipo,
                natureza: text,
                situacao: text,
                ocorrido_em: { ...time, nullable: true },
                registrado_em: time,
                atual: { type: "boolean" },
              }),
            },
            next_cursor: { ...object(cursor), nullable: true },
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
          inicio_registro: string;
          fim_registro: string;
          fontes: string;
          limit: number;
          apos_registro?: string;
          apos_tipo?: string;
          apos_id?: string;
        };
        await authorize(tx, a, "prontuario:ler", q.unidade_id);
        const start = Date.parse(q.inicio_registro),
          end = Date.parse(q.fim_registro),
          names = q.fontes.split(","),
          parts = [q.apos_registro, q.apos_tipo, q.apos_id].filter(
            (x) => x !== undefined,
          ).length;
        if (
          !Number.isFinite(start) ||
          !Number.isFinite(end) ||
          end <= start ||
          end - start > 366 * 86400000 ||
          names.length > 6 ||
          new Set(names).size !== names.length ||
          names.some((n) => !Object.hasOwn(timelineSources, n)) ||
          (parts !== 0 && parts !== 3)
        )
          throw new DomainError(400, "filtros_do_prontuario_invalidos");
        const selected = names.map((n) => timelineSources[n]);
        for (const p of new Set(selected.flatMap((s) => s?.permissions ?? [])))
          await authorize(tx, a, p, q.unidade_id);
        const sql = selected.flatMap((s) => s?.sql ?? []).join(" UNION ALL ");
        const r = await tx.query(
          `SELECT id,paciente_id,episodio_id,autor_id,tipo,natureza,situacao,ocorrido_em,to_char(registrado_em AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS registrado_em,atual FROM (${sql}) timeline WHERE organizacao_id=$1 AND unidade_id=$2 AND paciente_id=$3 AND ($4::uuid IS NULL OR episodio_id=$4) AND registrado_em>=$5::timestamptz AND registrado_em<$6::timestamptz AND ($7::timestamptz IS NULL OR (registrado_em,tipo,id)>($7::timestamptz,$8::text,$9::uuid)) ORDER BY timeline.registrado_em,tipo,id LIMIT $10`,
          [
            a.organizacao_id,
            q.unidade_id,
            q.paciente_id,
            q.episodio_id ?? null,
            q.inicio_registro,
            q.fim_registro,
            q.apos_registro ?? null,
            q.apos_tipo ?? null,
            q.apos_id ?? null,
            q.limit + 1,
          ],
        );
        const items = r.rows.slice(0, q.limit),
          last = items.at(-1);
        return {
          items,
          next_cursor:
            r.rows.length > q.limit && last
              ? {
                  registrado_em: last.registrado_em,
                  tipo: last.tipo,
                  id: last.id,
                }
              : null,
        };
      }),
  );
}
