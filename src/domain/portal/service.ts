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
async function account(tx: PoolClient, a: Actor, b: Body) {
  let id = b.conta_portal_id;
  if (b.concessao_id)
    id = (
      await one(
        tx,
        "SELECT conta_portal_id FROM concessao_portal WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
        [a.organizacao_id, b.unidade_id, b.concessao_id],
      )
    ).conta_portal_id;
  if (b.mensagem_id || b.tentativa_id)
    id = (
      await one(
        tx,
        `SELECT g.conta_portal_id FROM mensagem_portal m JOIN concessao_portal g ON g.organizacao_id=m.organizacao_id AND g.id=m.concessao_id WHERE m.organizacao_id=$1 AND m.unidade_id=$2 AND m.id=${b.mensagem_id ? "$3" : "(SELECT mensagem_id FROM tentativa_comunicacao WHERE organizacao_id=$1 AND id=$3)"}`,
        [a.organizacao_id, b.unidade_id, b.mensagem_id ?? b.tentativa_id],
      )
    ).conta_portal_id;
  if (id) {
    await one(
      tx,
      "SELECT id FROM conta_portal WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
      [a.organizacao_id, b.unidade_id, id],
    );
    await tx.query("SELECT travar_conta_portal($1,$2)", [a.organizacao_id, id]);
  }
}
const definitions: [string, string, string, string, string[]][] = [
  [
    "contas",
    "portalAccount",
    "conta_portal",
    "portal:administrar",
    ["responsavel_id"],
  ],
  [
    "contas-revogacoes",
    "portalRevoke",
    "revogacao_conta_portal",
    "portal:administrar",
    ["conta_portal_id"],
  ],
  [
    "concessoes",
    "portalGrant",
    "concessao_portal",
    "portal:autorizar",
    ["conta_portal_id", "paciente_id", "vinculo_id", "valida_ate", "evidencia"],
  ],
  [
    "concessoes-revogacoes",
    "portalGrantRevoke",
    "revogacao_concessao_portal",
    "portal:autorizar",
    ["concessao_id"],
  ],
];
export const portalActions: Action[] = definitions.map(
  ([path, input, table, permission, fields]) => ({
    path: `/comunicacao/${path}`,
    input,
    permission,
    scope,
    async run(tx, a, b, _id, cmd) {
      await account(tx, a, b);
      return { id: await insert(tx, a, b, cmd, table, fields) };
    },
  }),
);
portalActions.push({
  path: "/comunicacao/preferencias",
  input: "portalPreference",
  permission: "comunicacao:preferencias",
  scope,
  async run(tx, a, b, _id, cmd) {
    await account(tx, a, b);
    return {
      id: await insert(
        tx,
        a,
        b,
        cmd,
        "preferencia_comunicacao",
        ["conta_portal_id", "finalidade", "permitida", "evidencia"],
        { versao: Number(b.versao_esperada) + 1 },
      ),
    };
  },
});
portalActions.push({
  path: "/comunicacao/mensagens",
  input: "portalMessage",
  permission: "comunicacao:preparar",
  scope,
  async run(tx, a, b, _id, cmd) {
    await account(tx, a, b);
    const docs = b.documentos as string[];
    if ((b.finalidade === "documento") !== docs.length > 0)
      throw new DomainError(400, "finalidade_documental_exige_versoes");
    if (docs.length) {
      const requests = await tx.query(
        "SELECT DISTINCT solicitacao_id FROM documento_versao WHERE organizacao_id=$1 AND id=ANY($2::uuid[]) ORDER BY solicitacao_id",
        [a.organizacao_id, docs],
      );
      for (const r of requests.rows)
        await tx.query("SELECT travar_solicitacao_documento($1,$2)", [
          a.organizacao_id,
          r.solicitacao_id,
        ]);
    }
    const id = await insert(tx, a, b, cmd, "mensagem_portal", [
      "concessao_id",
      "finalidade",
      "canal",
      "origem",
      "referencia",
      "titulo",
      "texto",
      "agendamento_versao_id",
    ]);
    for (const document of docs)
      await insert(tx, a, b, cmd, "mensagem_documento", [], {
        mensagem_id: id,
        documento_versao_id: document,
      });
    return { id };
  },
});
portalActions.push({
  path: "/comunicacao/tentativas",
  input: "portalAttempt",
  permission: "comunicacao:simular",
  scope,
  async run(tx, a, b, _id, cmd) {
    await account(tx, a, b);
    return {
      id: await insert(
        tx,
        a,
        b,
        cmd,
        "tentativa_comunicacao",
        ["mensagem_id"],
        { sequencia: Number(b.sequencia_esperada) + 1 },
      ),
    };
  },
});
portalActions.push({
  path: "/comunicacao/retornos",
  input: "portalResult",
  permission: "comunicacao:simular",
  scope,
  async run(tx, a, b, _id, cmd) {
    await account(tx, a, b);
    return {
      id: await insert(
        tx,
        a,
        b,
        cmd,
        "retorno_comunicacao",
        ["tentativa_id", "estado", "ocorrido_em", "evidencia", "referencia"],
        { sequencia: Number(b.sequencia_esperada) + 1 },
      ),
    };
  },
});
const lists: [string, string, string, string][] = [
  ["contas", "conta_portal", "responsavel_id", "portal:ler"],
  [
    "contas-revogacoes",
    "revogacao_conta_portal",
    "conta_portal_id",
    "portal:ler",
  ],
  [
    "concessoes",
    "concessao_portal_consulta",
    "conta_portal_id,paciente_id,vinculo_id,valida_ate,evidencia,vigente",
    "portal:ler",
  ],
  [
    "concessoes-revogacoes",
    "revogacao_concessao_portal",
    "concessao_id",
    "portal:ler",
  ],
  [
    "preferencias",
    "preferencia_comunicacao_consulta",
    "conta_portal_id,finalidade,canal,versao,permitida,evidencia,atual",
    "comunicacao:ler",
  ],
  [
    "mensagens",
    "mensagem_portal_consulta",
    "concessao_id,conta_portal_id,paciente_id,finalidade,canal,origem,referencia,titulo,agendamento_versao_id,situacao,acesso_vigente",
    "comunicacao:ler",
  ],
  [
    "documentos",
    "mensagem_documento",
    "mensagem_id,documento_versao_id",
    "comunicacao:ler",
  ],
  [
    "tentativas",
    "tentativa_comunicacao",
    "mensagem_id,sequencia",
    "comunicacao:ler",
  ],
  [
    "retornos",
    "retorno_comunicacao",
    "tentativa_id,sequencia,estado,ocorrido_em,evidencia,referencia",
    "comunicacao:ler",
  ],
];
export const portalLists = lists.map(([path, table, columns, permission]) => ({
  path: `/comunicacao/${path}`,
  table,
  columns: `id,unidade_id,${columns},autor_id,motivo,criada_em`,
  unit: true,
  permission,
}));
