import { randomUUID } from "node:crypto";
import { DomainError, one } from "../core.ts";
import type { Action } from "../foundation.ts";
import { choice, object, text, uuid } from "../schemas.ts";
import { examBoolean } from "../exams/schemas.ts";
export const registryDefinitions = [
  {
    path: "pacientes",
    type: "paciente",
    table: "paciente",
    permission: "cadastros:retificar",
    read: "cadastros:ler",
    unit: false,
    fields: {
      nome: text,
      especie_codigo: choice("canina", "felina", "outra", "desconhecida"),
      estado_vital: choice("vivo", "obito", "desconhecido"),
    },
  },
  {
    path: "responsaveis",
    type: "responsavel",
    table: "responsavel",
    permission: "cadastros:retificar",
    read: "cadastros:ler",
    unit: false,
    fields: { nome: text },
  },
  {
    path: "usuarios",
    type: "usuario",
    table: "usuario",
    permission: "acesso:administrar",
    read: "acesso:administrar",
    unit: false,
    fields: { nome: text, login: { ...text, pattern: "^[a-z0-9._-]{3,80}$" } },
  },
  {
    path: "unidades",
    type: "unidade",
    table: "unidade_hospitalar",
    permission: "acesso:administrar",
    read: "acesso:administrar",
    unit: false,
    fields: { nome: text },
  },
  {
    path: "dispositivos",
    type: "dispositivo",
    table: "dispositivo",
    permission: "acesso:administrar",
    read: "acesso:administrar",
    unit: false,
    fields: { nome: text },
  },
  {
    path: "locais",
    type: "local",
    table: "local",
    permission: "locais:retificar",
    read: "locais:ler",
    unit: true,
    fields: {
      nome: text,
      capacidade: { type: "integer", minimum: 0, maximum: 1000 },
    },
  },
];
// Revision zero denotes the existing record before its first correction.
const common = {
  motivo: text,
  versao_esperada: { type: "integer", minimum: 0, maximum: 2147483646 },
  simulacao: { type: "boolean", const: true },
  confirmacao_humana: { type: "boolean", const: true },
};
export const registryInputs: Record<string, unknown> = Object.fromEntries(
  registryDefinitions.map((d) => [
    `revise_${d.type}`,
    object({
      ...common,
      ...(d.unit ? { unidade_id: uuid } : {}),
      dados: object(d.fields),
    }),
  ]),
);
registryInputs.revise_assignment = object({ ...common, ativo: examBoolean });
export const registryActions: Action[] = registryDefinitions.map((d) => ({
  path: `/${d.path}/:id/revisoes`,
  input: `revise_${d.type}`,
  permission: d.permission,
  ...(d.unit ? { scope: async (_tx, _a, b) => b.unidade_id as string } : {}),
  async run(tx, a, b, id, cmd) {
    await tx.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('cadastro:'||$1::text||':'||$2::text||':'||$3::text,0))",
      [a.organizacao_id, d.type, id],
    );
    const target = await one(
      tx,
      `SELECT id,${["dispositivo", "local"].includes(d.type) ? "unidade_id" : d.type === "unidade" ? "id AS unidade_id" : "NULL::uuid AS unidade_id"} FROM ${d.table} WHERE organizacao_id=$1 AND id=$2`,
      [a.organizacao_id, id],
    );
    if (d.unit && b.unidade_id !== target.unidade_id)
      throw new DomainError(404, "registro_nao_encontrado");
    const last = (
      await tx.query(
        "SELECT id,versao FROM revisao_cadastro WHERE organizacao_id=$1 AND tipo=$2 AND alvo_id=$3 ORDER BY versao DESC LIMIT 1",
        [a.organizacao_id, d.type, id],
      )
    ).rows[0];
    if ((last?.versao ?? 0) !== b.versao_esperada)
      throw new DomainError(409, "cadastro_alterado_recarregue");
    const revision = randomUUID();
    await tx.query(
      `INSERT INTO revisao_cadastro(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,tipo,alvo_id,${d.type === "unidade" ? "cadastro_unidade_id" : `${d.type}_id`},versao,anterior_id,depois) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11)`,
      [
        revision,
        a.organizacao_id,
        target.unidade_id,
        a.usuario_id,
        cmd,
        b.motivo,
        d.type,
        id,
        (last?.versao ?? 0) + 1,
        last?.id ?? null,
        JSON.stringify(b.dados),
      ],
    );
    return { id: revision, versao: (last?.versao ?? 0) + 1 };
  },
}));
registryActions.push({
  path: "/atribuicoes/:id/revisoes",
  input: "revise_assignment",
  permission: "acesso:administrar",
  async run(tx, a, b, id, cmd) {
    const target = await one(
      tx,
      "SELECT usuario_id FROM usuario_papel WHERE organizacao_id=$1 AND id=$2",
      [a.organizacao_id, id],
    );
    await tx.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('acesso:'||$1::text||':'||$2::text,0))",
      [a.organizacao_id, target.usuario_id],
    );
    const last = (
      await tx.query(
        "SELECT id,versao FROM revisao_atribuicao WHERE organizacao_id=$1 AND atribuicao_id=$2 ORDER BY versao DESC LIMIT 1",
        [a.organizacao_id, id],
      )
    ).rows[0];
    if ((last?.versao ?? 0) !== b.versao_esperada)
      throw new DomainError(409, "atribuicao_alterada_recarregue");
    const revision = randomUUID();
    await tx.query(
      "INSERT INTO revisao_atribuicao(id,organizacao_id,autor_id,comando_id,motivo,atribuicao_id,versao,anterior_id,ativo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        revision,
        a.organizacao_id,
        a.usuario_id,
        cmd,
        b.motivo,
        id,
        (last?.versao ?? 0) + 1,
        last?.id ?? null,
        b.ativo,
      ],
    );
    return { id: revision, versao: (last?.versao ?? 0) + 1 };
  },
});
