import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { authorize, DomainError, one } from "../core.ts";
import type { Actor } from "../core.ts";
import type { Action, Body } from "../foundation.ts";
import { medicalActions } from "../medical-record/service.ts";
const scope: Action["scope"] = async (_tx, _a, b) => b.unidade_id as string;
const contentScope: Action["scope"] = async (tx, a, b) => {
  await authorize(tx, a, "prontuario:conteudo", b.unidade_id as string);
  return b.unidade_id as string;
};
async function insert(
  tx: PoolClient,
  a: Actor,
  b: Body,
  cmd: string,
  table: string,
  extra: Body,
) {
  const record = {
    id: randomUUID(),
    organizacao_id: a.organizacao_id,
    unidade_id: b.unidade_id,
    autor_id: a.usuario_id,
    comando_id: cmd,
    motivo: b.motivo,
    ...extra,
  };
  const keys = Object.keys(record);
  await tx.query(
    `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(",")})`,
    Object.values(record),
  );
  return record.id;
}
export const medicalComplementActions: Action[] = [
  {
    path: "/prontuario/modelos",
    input: "medicalModel",
    permission: "prontuario:modelar",
    scope,
    async run(tx, a, b, _id, cmd) {
      await tx.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('modelo-evolucao:'||$1::text||':'||$2::text||':'||$3::text,0))",
        [a.organizacao_id, b.unidade_id, b.codigo],
      );
      const last = (
        await tx.query(
          "SELECT id,versao FROM modelo_evolucao_versao WHERE organizacao_id=$1 AND unidade_id=$2 AND codigo=$3 ORDER BY versao DESC LIMIT 1",
          [a.organizacao_id, b.unidade_id, b.codigo],
        )
      ).rows[0];
      if ((last?.versao ?? 0) !== b.versao_esperada)
        throw new DomainError(409, "modelo_alterado_recarregue");
      return {
        id: await insert(tx, a, b, cmd, "modelo_evolucao_versao", {
          codigo: b.codigo,
          nome: b.nome,
          tipo: b.tipo,
          versao: (last?.versao ?? 0) + 1,
          anterior_id: last?.id ?? null,
          campos: JSON.stringify(b.campos),
        }),
        versao: (last?.versao ?? 0) + 1,
      };
    },
  },
  {
    path: "/prontuario/evolucoes-modeladas",
    input: "modeledEvolution",
    permission: "prontuario:escrever",
    scope,
    async run(tx, a, b, id, cmd) {
      const model = await one(
        tx,
        "SELECT tipo,renderizar_evolucao(campos,$4::jsonb) AS conteudo FROM modelo_evolucao_versao WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
        [
          a.organizacao_id,
          b.unidade_id,
          b.modelo_versao_id,
          JSON.stringify(b.respostas),
        ],
      );
      const create = medicalActions.find((x) => x.input === "medicalCreate");
      if (!create) throw new Error("medicalCreate ausente");
      const result = await create.run(
        tx,
        a,
        { ...b, tipo: model.tipo, conteudo: model.conteudo },
        id,
        cmd,
      );
      await insert(tx, a, b, cmd, "preenchimento_modelo_evolucao", {
        evolucao_versao_id: result.evolucao_versao_id,
        modelo_versao_id: b.modelo_versao_id,
        respostas: JSON.stringify(b.respostas),
      });
      return result;
    },
  },
  {
    path: "/prontuario/anexos",
    input: "medicalAttachment",
    permission: "prontuario:anexar",
    scope: contentScope,
    async run(tx, a, b, _id, cmd) {
      if (typeof b.conteudo_base64 !== "string")
        throw new DomainError(400, "base64_exige_texto");
      const bytes = Buffer.from(b.conteudo_base64, "base64");
      if (
        !bytes.length ||
        bytes.length > 262144 ||
        bytes.toString("base64") !== b.conteudo_base64
      )
        throw new DomainError(400, "base64_ou_tamanho_invalido");
      return {
        id: await insert(tx, a, b, cmd, "anexo_evolucao", {
          evolucao_versao_id: b.evolucao_versao_id,
          hash_evolucao: b.hash_evolucao,
          nome: b.nome,
          mime: b.mime,
          conteudo: bytes,
        }),
      };
    },
  },
  {
    path: "/prontuario/coautorias",
    input: "medicalCoauthor",
    permission: "prontuario:coautoria",
    scope: contentScope,
    async run(tx, a, b, _id, cmd) {
      return {
        id: await insert(tx, a, b, cmd, "coautoria_evolucao", {
          evolucao_versao_id: b.evolucao_versao_id,
          hash_evolucao: b.hash_evolucao,
        }),
      };
    },
  },
  ...[
    {
      path: "/prontuario/revogacoes-anexos",
      input: "revokeMedicalAttachment",
      permission: "prontuario:anexar",
      table: "revogacao_anexo_evolucao",
      field: "anexo_id",
    },
    {
      path: "/prontuario/revogacoes-coautorias",
      input: "revokeMedicalCoauthor",
      permission: "prontuario:coautoria",
      table: "revogacao_coautoria_evolucao",
      field: "coautoria_id",
    },
  ].map(
    ({ table, field, ...action }): Action => ({
      ...action,
      scope: contentScope,
      async run(tx, a, b, _id, cmd) {
        return {
          id: await insert(tx, a, b, cmd, table, { [field]: b[field] }),
        };
      },
    }),
  ),
];
const common = "id,unidade_id,autor_id,motivo,criada_em";
const context = "evolucao_versao_id,evolucao_id,paciente_id,episodio_id,atual";
export const medicalComplementLists = [
  {
    path: "/prontuario/modelos",
    table: "modelo_evolucao_consulta",
    columns: `${common},codigo,nome,tipo,versao,anterior_id,atual`,
  },
  {
    path: "/prontuario/preenchimentos",
    table: "preenchimento_evolucao_consulta",
    columns: `${common},${context},modelo_versao_id`,
  },
  {
    path: "/prontuario/anexos",
    table: "anexo_evolucao_consulta",
    columns: `${common},${context},nome,mime,tamanho,hash_conteudo,hash_evolucao,revogada`,
  },
  {
    path: "/prontuario/coautorias",
    table: "coautoria_evolucao_consulta",
    columns: `${common},${context},hash_evolucao,revogada,vigente`,
  },
  {
    path: "/prontuario/revogacoes-anexos",
    table: "revogacao_anexo_evolucao",
    columns: `${common},anexo_id`,
  },
  {
    path: "/prontuario/revogacoes-coautorias",
    table: "revogacao_coautoria_evolucao",
    columns: `${common},coautoria_id`,
  },
].map((x) => ({ ...x, unit: true, permission: "prontuario:ler" }));
