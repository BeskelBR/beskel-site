import { randomUUID } from "node:crypto";
import { DomainError } from "../core.ts";
import type { Action } from "../foundation.ts";
const definitions: [string, string, string, string, string[]][] = [
  [
    "saidas-extrato",
    "saida_extrato_fornecedor",
    "supplierOutflow",
    "pagar:extrato_saida",
    [
      "conta_financeira_id",
      "referencia",
      "referencia_externa",
      "correcao_de_id",
      "ocorrido_em",
      "valor",
      "evidencia",
    ],
  ],
  [
    "conciliacoes-saidas",
    "conciliacao_saida_fornecedor",
    "supplierOutflowReconciliation",
    "pagar:conciliar_saida",
    ["pagamento_id", "saida_id", "valor", "evidencia"],
  ],
  [
    "reversoes-saidas",
    "reversao_saida_fornecedor",
    "supplierOutflowReverse",
    "pagar:reverter",
    ["saida_id", "conciliacao_id"],
  ],
];
export const supplierOutflowActions: Action[] = definitions.map(
  ([path, table, input, permission, fields]) => ({
    path: `/a-pagar/${path}`,
    input,
    permission,
    scope: async (_t, _a, b) => b.unidade_id as string,
    async run(tx, a, b, _id, cmd) {
      if (
        path === "reversoes-saidas" &&
        fields.filter((f) => b[f] !== undefined).length !== 1
      )
        throw new DomainError(400, "informe_um_alvo_de_reversao");
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
export const supplierOutflowLists = [
  ...definitions.map(([path, table, _input, _permission, fields]) => ({
    path: `/a-pagar/${path}`,
    table: path === "reversoes-saidas" ? table : `${table}_consulta`,
    columns: `id,unidade_id,${fields.join(",")},autor_id,motivo,criada_em${path === "saidas-extrato" ? ",nao_conciliado,revertido" : path === "conciliacoes-saidas" ? ",fornecedor_id,conta_financeira_id,ativo" : ""}`,
    unit: true,
    permission: "pagar:ler",
  })),
  {
    path: "/a-pagar/pagamentos-conciliacao",
    table: "pagamento_conciliacao_consulta",
    columns:
      "id,unidade_id,fornecedor_id,conta_financeira_id,referencia,pago_em,valor,evidencia,autor_id,motivo,criada_em,disponivel,revertido,nao_conciliado",
    unit: true,
    permission: "pagar:ler",
  },
];
