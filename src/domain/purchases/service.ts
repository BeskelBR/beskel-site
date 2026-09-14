import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { authorize, DomainError, one } from "../core.ts";
import type { Actor } from "../core.ts";
import type { Action, Body } from "../foundation.ts";
import { inventoryActions } from "../inventory/service.ts";
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
  return record.id as string;
}
async function lock(tx: PoolClient, a: Actor, b: Body) {
  await one(
    tx,
    "SELECT id FROM pedido_compra WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
    [a.organizacao_id, b.unidade_id, b.pedido_id],
  );
  await tx.query("SELECT travar_pedido_compra($1,$2)", [
    a.organizacao_id,
    b.pedido_id,
  ]);
}
export const purchaseActions: Action[] = [
  {
    path: "/compras/fornecedores",
    input: "purchaseSupplier",
    permission: "compras:configurar",
    scope,
    async run(tx, a, b, _id, cmd) {
      return {
        id: await insert(tx, a, b, cmd, "fornecedor_compra", [
          "nome",
          "referencia",
        ]),
      };
    },
  },
  {
    path: "/compras/pedidos",
    input: "purchaseOrder",
    permission: "compras:solicitar",
    scope,
    async run(tx, a, b, _id, cmd) {
      const id = await insert(tx, a, b, cmd, "pedido_compra", [
        "fornecedor_id",
        "referencia",
        "observacao",
      ]);
      for (const item of b.itens as Body[])
        await insert(tx, a, b, cmd, "item_pedido_compra", [], {
          pedido_id: id,
          apresentacao_id: item.apresentacao_id,
          quantidade_apresentacoes: item.quantidade_apresentacoes,
        });
      return { id };
    },
  },
  {
    path: "/compras/decisoes",
    input: "purchaseDecision",
    permission: "compras:decidir",
    scope,
    async run(tx, a, b, _id, cmd) {
      await lock(tx, a, b);
      const p = await one(
        tx,
        "SELECT situacao FROM pedido_compra_consulta WHERE organizacao_id=$1 AND id=$2",
        [a.organizacao_id, b.pedido_id],
      );
      if (p.situacao !== b.estado_esperado)
        throw new DomainError(409, "pedido_alterado_recarregue");
      return {
        id: await insert(
          tx,
          a,
          b,
          cmd,
          "decisao_pedido_compra",
          ["pedido_id", "estado"],
          { sequencia: b.estado_esperado === "rascunho" ? 1 : 2 },
        ),
      };
    },
  },
  {
    path: "/compras/recebimentos",
    input: "purchaseReceipt",
    permission: "compras:receber",
    scope,
    async run(tx, a, b, _id, cmd) {
      await authorize(tx, a, "estoque:movimentar", b.unidade_id as string);
      await lock(tx, a, b);
      const items = [...(b.itens as Body[])].sort((x, y) =>
        String(x.posicao_id).localeCompare(String(y.posicao_id)),
      );
      const positions = [...new Set(items.map((i) => i.posicao_id))];
      const valid = await tx.query(
        "SELECT id FROM posicao_estoque WHERE organizacao_id=$1 AND unidade_id=$2 AND id=ANY($3::uuid[])",
        [a.organizacao_id, b.unidade_id, positions],
      );
      if (valid.rowCount !== positions.length)
        throw new DomainError(404, "posicao_fora_da_unidade");
      const id = await insert(tx, a, b, cmd, "recebimento_compra", [
        "pedido_id",
        "referencia",
        "documento_fornecedor",
        "ocorrido_em",
      ]);
      const entry = inventoryActions.find(
        (a) => a.path === "/estoque/entradas",
      );
      if (!entry) throw new Error("Contrato interno de entrada ausente");
      for (const item of items) {
        const movement = await entry.run(
          tx,
          a,
          {
            posicao_id: item.posicao_id,
            quantidade_apresentacoes: item.quantidade_apresentacoes,
            ocorrido_em: b.ocorrido_em,
            motivo: b.motivo,
          },
          "",
          cmd,
        );
        await insert(tx, a, b, cmd, "recebimento_compra_item", [], {
          id: movement.id,
          recebimento_id: id,
          item_pedido_id: item.item_pedido_id,
        });
      }
      return { id };
    },
  },
];
const lists: [string, string, string][] = [
  ["fornecedores", "fornecedor_compra", "nome,referencia"],
  [
    "pedidos",
    "pedido_compra_consulta",
    "fornecedor_id,referencia,observacao,situacao",
  ],
  [
    "itens",
    "item_pedido_compra_consulta",
    "pedido_id,apresentacao_id,quantidade_apresentacoes,recebido_apresentacoes",
  ],
  ["decisoes", "decisao_pedido_compra", "pedido_id,sequencia,estado"],
  [
    "recebimentos",
    "recebimento_compra",
    "pedido_id,referencia,documento_fornecedor,ocorrido_em",
  ],
  [
    "recebimentos-itens",
    "recebimento_compra_item_consulta",
    "recebimento_id,item_pedido_id,posicao_id,quantidade_apresentacoes,quantidade_base,fator_snapshot,custo_base_snapshot,ocorrido_em,revertido",
  ],
];
export const purchaseLists = lists.map(([path, table, columns]) => ({
  path: `/compras/${path}`,
  table,
  columns: `id,unidade_id,${columns},autor_id,motivo,criada_em`,
  unit: true,
  permission: "compras:ler",
}));
