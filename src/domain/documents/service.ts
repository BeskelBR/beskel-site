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
const definitions: [string, string, string, string, string[]][] = [
  [
    "modelos",
    "documentModel",
    "modelo_documento",
    "configurar",
    ["codigo", "nome", "tipo"],
  ],
  [
    "modelos-aprovacoes",
    "documentModelApprove",
    "aprovacao_modelo_documento",
    "aprovar_modelo",
    ["modelo_versao_id"],
  ],
  [
    "solicitacoes",
    "documentRequest",
    "solicitacao_documento",
    "solicitar",
    [
      "paciente_id",
      "episodio_id",
      "modelo_id",
      "solicitante_responsavel_id",
      "solicitante_usuario_id",
      "escopo",
      "protocolo",
      "recebida_em",
      "prazo_em",
      "evidencia_autorizacao",
    ],
  ],
  [
    "autorizacoes",
    "documentAuthorization",
    "autorizacao_documento",
    "autorizar",
    ["solicitacao_id", "decisao", "valida_ate", "evidencia"],
  ],
  [
    "revogacoes",
    "documentRevoke",
    "revogacao_autorizacao_documento",
    "autorizar",
    ["autorizacao_id"],
  ],
  [
    "aprovacoes",
    "documentApprove",
    "aprovacao_documento",
    "aprovar",
    ["documento_versao_id"],
  ],
  [
    "assinaturas",
    "documentSignature",
    "assinatura_documento",
    "registrar_assinatura",
    [
      "documento_versao_id",
      "signatario_usuario_id",
      "signatario_responsavel_id",
      "mecanismo",
      "hash_conteudo",
      "declarada_em",
      "evidencia",
      "referencia",
    ],
  ],
  [
    "entregas",
    "documentDelivery",
    "entrega_documento",
    "registrar_entrega",
    [
      "documento_versao_id",
      "destinatario_id",
      "entregue_em",
      "canal",
      "evidencia",
      "referencia",
    ],
  ],
];
export const documentActions: Action[] = definitions.map(
  ([path, input, table, permission, fields]) => ({
    path: `/documentos/${path}`,
    input,
    permission: `documentos:${permission}`,
    scope,
    async run(tx, a, b, _id, cmd) {
      return {
        id: await insert(
          tx,
          a,
          b,
          cmd,
          table,
          fields,
          table === "assinatura_documento"
            ? { estado: "declarada_nao_verificada" }
            : {},
        ),
      };
    },
  }),
);
documentActions.push({
  path: "/documentos/modelos-versoes",
  input: "documentModelVersion",
  permission: "documentos:configurar",
  scope,
  async run(tx, a, b, _id, cmd) {
    const id = await insert(tx, a, b, cmd, "modelo_documento_versao", [
      "modelo_id",
      "versao",
      "titulo",
      "texto_base",
      "publico",
    ]);
    for (const c of b.campos as Body[])
      await insert(
        tx,
        a,
        { ...b, ...c },
        cmd,
        "campo_modelo_documento",
        ["codigo", "obrigatorio"],
        { modelo_versao_id: id },
      );
    return { id };
  },
});
documentActions.push({
  path: "/documentos/versoes",
  input: "documentVersion",
  permission: "documentos:redigir",
  scope,
  async run(tx, a, b, _id, cmd) {
    await one(
      tx,
      "SELECT id FROM solicitacao_documento WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
      [a.organizacao_id, b.unidade_id, b.solicitacao_id],
    );
    await tx.query("SELECT travar_solicitacao_documento($1,$2)", [
      a.organizacao_id,
      b.solicitacao_id,
    ]);
    const last = (
      await tx.query(
        "SELECT id,versao FROM documento_versao WHERE organizacao_id=$1 AND solicitacao_id=$2 ORDER BY versao DESC LIMIT 1",
        [a.organizacao_id, b.solicitacao_id],
      )
    ).rows[0];
    if ((last?.versao ?? 0) !== b.versao_esperada)
      throw new DomainError(409, "documento_alterado_recarregue");
    const versao = (last?.versao ?? 0) + 1;
    return {
      id: await insert(
        tx,
        a,
        b,
        cmd,
        "documento_versao",
        ["solicitacao_id", "modelo_versao_id", "campos"],
        { versao, anterior_id: last?.id ?? null },
      ),
      versao,
    };
  },
});
const definitionsList: [string, string, string][] = [
  ["modelos", "modelo_documento", "codigo,nome,tipo"],
  [
    "modelos-versoes",
    "modelo_documento_versao",
    "modelo_id,versao,titulo,texto_base,publico",
  ],
  [
    "modelos-campos",
    "campo_modelo_documento",
    "modelo_versao_id,codigo,obrigatorio",
  ],
  ["modelos-aprovacoes", "aprovacao_modelo_documento", "modelo_versao_id"],
  [
    "solicitacoes",
    "solicitacao_documento_consulta",
    "paciente_id,episodio_id,modelo_id,solicitante_responsavel_id,solicitante_usuario_id,escopo,protocolo,recebida_em,prazo_em,evidencia_autorizacao,decisao_acesso,acesso_vigente,prazo_vencido",
  ],
  [
    "autorizacoes",
    "autorizacao_documento",
    "solicitacao_id,decisao,valida_ate,evidencia",
  ],
  ["revogacoes", "revogacao_autorizacao_documento", "autorizacao_id"],
  [
    "versoes",
    "documento_versao_consulta",
    "solicitacao_id,modelo_versao_id,versao,anterior_id,hash_conteudo,paciente_id,publico,aprovado,substituido,ha_versao_posterior",
  ],
  ["aprovacoes", "aprovacao_documento", "documento_versao_id"],
  [
    "assinaturas",
    "assinatura_documento",
    "documento_versao_id,signatario_usuario_id,signatario_responsavel_id,mecanismo,estado,hash_conteudo,declarada_em,evidencia,referencia",
  ],
  [
    "entregas",
    "entrega_documento",
    "documento_versao_id,destinatario_id,entregue_em,canal,evidencia,referencia",
  ],
];
export const documentLists = definitionsList.map(([path, table, columns]) => ({
  path: `/documentos/${path}`,
  table,
  columns: `id,unidade_id,${columns},autor_id,motivo,criada_em`,
  unit: true,
  permission: "documentos:ler",
}));
documentLists.push({
  path: "/documentos/conteudos",
  table: "documento_conteudo_consulta",
  columns: "id,unidade_id,documento_versao_id,conteudo,hash_conteudo",
  unit: true,
  permission: "documentos:conteudo",
});
