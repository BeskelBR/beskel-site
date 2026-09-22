import { randomUUID } from "node:crypto";
import type { Action } from "../foundation.ts";
const definitions: [string, string, string, string, string[]][] = [
  [
    "creditos",
    "credito_fornecedor",
    "supplierCredit",
    "pagar:creditar",
    [
      "fornecedor_id",
      "origem_obrigacao_id",
      "correcao_de_id",
      "origem",
      "referencia",
      "documento_referencia",
      "descricao",
      "ocorrido_em",
      "valor",
    ],
  ],
  [
    "aplicacoes-creditos",
    "liquidacao_fornecedor",
    "supplierCreditApplication",
    "pagar:aplicar_credito",
    ["obrigacao_id", "credito_id", "liquidada_em", "valor"],
  ],
  [
    "reversoes-creditos",
    "reversao_credito_fornecedor",
    "supplierCreditReverse",
    "pagar:reverter",
    ["credito_id"],
  ],
];
export const supplierCreditActions: Action[] = definitions.map(
  ([path, table, input, permission, fields]) => ({
    path: `/a-pagar/${path}`,
    input,
    permission,
    scope: async (_t, _a, b) => b.unidade_id as string,
    async run(tx, a, b, _id, cmd) {
      await tx.query("SELECT travar_contas_pagar($1,$2)", [
        a.organizacao_id,
        b.unidade_id,
      ]);
      const record = {
          id: randomUUID(),
          organizacao_id: a.organizacao_id,
          unidade_id: b.unidade_id,
          autor_id: a.usuario_id,
          comando_id: cmd,
          motivo: b.motivo,
          ...Object.fromEntries(fields.map((f) => [f, b[f] ?? null])),
        },
        keys = Object.keys(record);
      await tx.query(
        `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(",")})`,
        Object.values(record),
      );
      return { id: record.id };
    },
  }),
);
export const supplierCreditLists = definitions.map(
  ([path, table, _input, _permission, fields]) => ({
    path: `/a-pagar/${path}`,
    table:
      path === "creditos"
        ? "credito_fornecedor_consulta"
        : path === "aplicacoes-creditos"
          ? "aplicacao_credito_fornecedor_consulta"
          : table,
    columns: `id,unidade_id,${fields.join(",")},autor_id,motivo,criada_em${path === "creditos" ? ",disponivel,revertido" : path === "aplicacoes-creditos" ? ",fornecedor_id,revertido" : ""}`,
    unit: true,
    permission: "pagar:ler",
  }),
);
