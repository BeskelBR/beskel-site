import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { DomainError, one } from "../core.ts";
import type { Actor } from "../core.ts";
import type { Action, Body } from "../foundation.ts";
import { cents, moneyText } from "../financial/service.ts";
const scope: Action["scope"] = async (_t, _a, b) => b.unidade_id as string;
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
    },
    keys = Object.keys(record);
  await tx.query(
    `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(",")})`,
    Object.values(record),
  );
  return record.id as string;
}
export const acquisitionActions: Action[] = [
  {
    path: "/compras/rateios-custo",
    input: "acquisitionAllocation",
    permission: "compras:ratear_custo",
    scope,
    async run(tx, a, b, _id, cmd) {
      await one(
        tx,
        "SELECT id FROM pedido_compra WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
        [a.organizacao_id, b.unidade_id, b.pedido_id],
      );
      await tx.query("SELECT travar_pedido_compra($1,$2)", [
        a.organizacao_id,
        b.pedido_id,
      ]);
      const last = (
        await tx.query(
          "SELECT id,versao FROM rateio_aquisicao WHERE organizacao_id=$1 AND pedido_id=$2 ORDER BY versao DESC LIMIT 1",
          [a.organizacao_id, b.pedido_id],
        )
      ).rows[0];
      if ((last?.versao ?? 0) !== b.versao_esperada)
        throw new DomainError(409, "rateio_alterado_recarregue");
      const prices = await tx.query(
        "SELECT item_pedido_id,subtotal FROM preco_item_compra WHERE organizacao_id=$1 AND unidade_id=$2 AND precificacao_id=$3",
        [a.organizacao_id, b.unidade_id, b.precificacao_id],
      );
      const items = b.itens as {
        item_pedido_id: string;
        frete: string;
        acrescimo: string;
        desconto: string;
      }[];
      if (
        items.length !== prices.rowCount ||
        new Set(items.map((i) => i.item_pedido_id)).size !== items.length
      )
        throw new DomainError(409, "rateio_exige_todos_os_itens");
      const id = await insert(tx, a, b, cmd, "rateio_aquisicao", {
        pedido_id: b.pedido_id,
        precificacao_id: b.precificacao_id,
        versao: (last?.versao ?? 0) + 1,
        anterior_id: last?.id ?? null,
        criterio: b.criterio,
      });
      for (const item of items) {
        const price = prices.rows.find(
          (p) => p.item_pedido_id === item.item_pedido_id,
        );
        if (!price) throw new DomainError(409, "item_de_outro_preco");
        const total = moneyText(
          cents(price.subtotal) +
            cents(item.frete) +
            cents(item.acrescimo) -
            cents(item.desconto),
        );
        await insert(tx, a, b, cmd, "item_rateio_aquisicao", {
          ...item,
          rateio_id: id,
          subtotal: price.subtotal,
          total,
        });
      }
      return { id, versao: (last?.versao ?? 0) + 1 };
    },
  },
  {
    path: "/compras/custos-recebimentos",
    input: "acquisitionReceiptCost",
    permission: "compras:avaliar_custo",
    scope,
    async run(tx, a, b, _id, cmd) {
      await one(
        tx,
        "SELECT id FROM item_rateio_aquisicao WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
        [a.organizacao_id, b.unidade_id, b.item_rateio_id],
      );
      return {
        id: await insert(tx, a, b, cmd, "custo_recebimento", {
          item_rateio_id: b.item_rateio_id,
          recebimento_item_id: b.recebimento_item_id,
          valor: b.valor,
        }),
      };
    },
  },
  {
    path: "/compras/reversoes-custos",
    input: "acquisitionCostReverse",
    permission: "compras:avaliar_custo",
    scope,
    async run(tx, a, b, _id, cmd) {
      await one(
        tx,
        "SELECT id FROM custo_recebimento WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
        [a.organizacao_id, b.unidade_id, b.custo_recebimento_id],
      );
      return {
        id: await insert(tx, a, b, cmd, "reversao_custo_recebimento", {
          custo_recebimento_id: b.custo_recebimento_id,
        }),
      };
    },
  },
];
export const acquisitionLists = [
  {
    path: "/compras/rateios-custo",
    table: "rateio_aquisicao_consulta",
    columns:
      "pedido_id,precificacao_id,versao,anterior_id,criterio,total,preco_atual,atual",
  },
  {
    path: "/compras/rateios-custo-itens",
    table: "item_rateio_aquisicao_consulta",
    columns:
      "rateio_id,item_pedido_id,subtotal,frete,acrescimo,desconto,total,quantidade_apresentacoes,valor_atribuido,saldo_atribuir,quantidade_avaliada,quantidade_pendente",
  },
  {
    path: "/compras/custos-recebimentos",
    table: "custo_recebimento_consulta",
    columns:
      "item_rateio_id,rateio_id,pedido_id,item_pedido_id,recebimento_item_id,recebimento_id,posicao_id,valor,quantidade_apresentacoes,quantidade_base,recebimento_revertido,ativo",
  },
  {
    path: "/compras/reversoes-custos",
    table: "reversao_custo_recebimento",
    columns: "custo_recebimento_id",
  },
].map((x) => ({
  ...x,
  columns: `id,unidade_id,${x.columns},autor_id,motivo,criada_em`,
  unit: true,
  permission: "compras:ler",
}));
