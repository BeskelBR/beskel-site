import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { DomainError, one } from "../core.ts";
import type { Actor } from "../core.ts";
import type { Action, Body } from "../foundation.ts";
const scope: Action["scope"] = async (_t, _a, b) => b.unidade_id as string;
async function insert(
  tx: PoolClient,
  a: Actor,
  b: Body,
  cmd: string,
  table: string,
  fields: string[],
  extra: Body = {},
) {
  const id = randomUUID(),
    record = {
      id,
      organizacao_id: a.organizacao_id,
      unidade_id: b.unidade_id,
      autor_id: a.usuario_id,
      comando_id: cmd,
      motivo: b.motivo,
      ...Object.fromEntries(fields.map((f) => [f, b[f] ?? null])),
      ...extra,
    },
    keys = Object.keys(record);
  await tx.query(
    `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(",")})`,
    Object.values(record),
  );
  return id;
}
export const medicalActions: Action[] = [
  {
    path: "/prontuario/evolucoes",
    input: "medicalCreate",
    permission: "prontuario:escrever",
    scope,
    async run(tx, a, b, _id, cmd) {
      const id = await insert(tx, a, b, cmd, "evolucao_clinica", [
        "paciente_id",
        "episodio_id",
        "tipo",
        "referencia",
      ]);
      const version = await insert(
        tx,
        a,
        b,
        cmd,
        "evolucao_clinica_versao",
        ["ocorrida_em", "conteudo"],
        { evolucao_id: id, versao: 1, estado: "registrada" },
      );
      return { id, evolucao_versao_id: version };
    },
  },
  {
    path: "/prontuario/versoes",
    input: "medicalVersion",
    permission: "prontuario:retificar",
    scope,
    async run(tx, a, b, _id, cmd) {
      const e = await one(
        tx,
        "SELECT episodio_id FROM evolucao_clinica WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
        [a.organizacao_id, b.unidade_id, b.evolucao_id],
      );
      await one(
        tx,
        "SELECT id FROM episodio WHERE organizacao_id=$1 AND id=$2 FOR SHARE",
        [a.organizacao_id, e.episodio_id],
      );
      await tx.query("SELECT travar_evolucao($1,$2)", [
        a.organizacao_id,
        b.evolucao_id,
      ]);
      const last = await one(
        tx,
        "SELECT id,versao FROM evolucao_clinica_versao WHERE organizacao_id=$1 AND evolucao_id=$2 ORDER BY versao DESC LIMIT 1",
        [a.organizacao_id, b.evolucao_id],
      );
      if (last.versao !== b.versao_esperada)
        throw new DomainError(409, "evolucao_alterada_recarregue");
      return {
        id: await insert(
          tx,
          a,
          b,
          cmd,
          "evolucao_clinica_versao",
          ["evolucao_id", "ocorrida_em", "conteudo", "estado"],
          { versao: last.versao + 1, anterior_id: last.id },
        ),
        versao: last.versao + 1,
      };
    },
  },
];
export const medicalLists = [
  {
    path: "/prontuario/evolucoes",
    table: "evolucao_clinica",
    columns:
      "id,unidade_id,paciente_id,episodio_id,tipo,referencia,autor_id,motivo,criada_em",
  },
  {
    path: "/prontuario/versoes",
    table: "evolucao_clinica_versao_consulta",
    columns:
      "id,unidade_id,paciente_id,episodio_id,tipo,evolucao_id,versao,anterior_id,estado,ocorrida_em,hash_conteudo,atual,revisao_temporal,autor_id,motivo,criada_em",
  },
].map((x) => ({ ...x, unit: true, permission: "prontuario:ler" }));
