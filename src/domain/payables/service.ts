import { randomUUID } from "node:crypto";
import { DomainError } from "../core.ts";
import type { Action } from "../foundation.ts";
const definitions: [string, string, string, string, string[]][] = [
  [
    "obrigacoes",
    "obrigacao_fornecedor",
    "payableObligation",
    "registrar",
    [
      "fornecedor_id",
      "pedido_id",
      "correcao_de_id",
      "origem",
      "referencia",
      "documento_referencia",
      "descricao",
      "ocorrida_em",
      "vencimento",
      "valor",
    ],
  ],
  [
    "pagamentos",
    "pagamento_fornecedor",
    "payablePayment",
    "pagar",
    [
      "fornecedor_id",
      "conta_financeira_id",
      "referencia",
      "pago_em",
      "valor",
      "evidencia",
    ],
  ],
  [
    "liquidacoes",
    "liquidacao_fornecedor",
    "payableSettlement",
    "liquidar",
    ["obrigacao_id", "pagamento_id", "liquidada_em", "valor"],
  ],
  [
    "reversoes",
    "reversao_fornecedor",
    "payableReversal",
    "reverter",
    ["obrigacao_id", "pagamento_id", "liquidacao_id"],
  ],
];
export const payableActions: Action[] = definitions.map(
  ([path, table, input, permission, fields]) => ({
    path: `/a-pagar/${path}`,
    input,
    permission: `pagar:${permission}`,
    scope: async (_t, _a, b) => b.unidade_id as string,
    async run(tx, a, b, _id, cmd) {
      if (
        path === "reversoes" &&
        fields.filter((f) => b[f] !== undefined).length !== 1
      )
        throw new DomainError(400, "informe_um_alvo_de_reversao");
      await tx.query("SELECT travar_contas_pagar($1,$2)", [
        a.organizacao_id,
        b.unidade_id,
      ]);
      const id = randomUUID(),
        record = {
          id,
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
      return { id };
    },
  }),
);
export const payableLists = definitions.map(
  ([path, table, _input, _permission, fields]) => ({
    path: `/a-pagar/${path}`,
    table: ["obrigacoes", "pagamentos"].includes(path)
      ? `${table}_consulta`
      : table,
    columns: `id,unidade_id,${fields.join(",")}${path === "liquidacoes" ? ",credito_id" : ""},autor_id,motivo,criada_em${path === "obrigacoes" ? ",saldo,revertido,necessita_revisao" : path === "pagamentos" ? ",disponivel,revertido" : ""}`,
    unit: true,
    permission: "pagar:ler",
  }),
);
