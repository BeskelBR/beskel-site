import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { authorize, DomainError, one } from "../core.ts";
import type { Actor } from "../core.ts";
import type { Action, Body } from "../foundation.ts";
import { cents, moneyText } from "../financial/service.ts";
import { exact } from "../inventory/decimal.ts";
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
export const pricingActions: Action[] = [
  {
    path: "/compras/precificacoes",
    input: "purchasePricing",
    permission: "compras:precificar",
    scope,
    async run(tx, a, b, _id, cmd) {
      await one(
        tx,
        "SELECT id FROM pedido_compra WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
        [a.organizacao_id, b.unidade_id, b.pedido_id],
      );
      await tx.query("SELECT travar_valores_compra($1,$2,$3)", [
        a.organizacao_id,
        b.unidade_id,
        b.pedido_id,
      ]);
      const last = (
        await tx.query(
          "SELECT id,versao FROM precificacao_compra WHERE organizacao_id=$1 AND pedido_id=$2 ORDER BY versao DESC LIMIT 1",
          [a.organizacao_id, b.pedido_id],
        )
      ).rows[0];
      if ((last?.versao ?? 0) !== b.versao_esperada)
        throw new DomainError(409, "precificacao_alterada_recarregue");
      const requested = b.itens as {
        item_pedido_id: string;
        preco_apresentacao: string;
      }[];
      const items = await tx.query(
        "SELECT id,quantidade_apresentacoes FROM item_pedido_compra WHERE organizacao_id=$1 AND unidade_id=$2 AND pedido_id=$3",
        [a.organizacao_id, b.unidade_id, b.pedido_id],
      );
      if (
        requested.length !== items.rowCount ||
        new Set(requested.map((i) => i.item_pedido_id)).size !==
          requested.length
      )
        throw new DomainError(409, "precificacao_exige_todos_os_itens");
      let sum = 0n;
      const rows = requested.map((i) => {
        const original = items.rows.find((o) => o.id === i.item_pedido_id);
        if (!original) throw new DomainError(409, "item_de_outro_pedido");
        const subtotal =
          exact(original.quantidade_apresentacoes) *
          cents(i.preco_apresentacao);
        if (subtotal % 1000000n !== 0n)
          throw new DomainError(
            409,
            "subtotal_exige_arredondamento_nao_autorizado",
          );
        sum += subtotal / 1000000n;
        return { ...i, subtotal: moneyText(subtotal / 1000000n) };
      });
      const total = moneyText(
        sum +
          cents(b.frete as string) +
          cents(b.acrescimo as string) -
          cents(b.desconto as string),
      );
      const id = await insert(tx, a, b, cmd, "precificacao_compra", {
        pedido_id: b.pedido_id,
        versao: (last?.versao ?? 0) + 1,
        anterior_id: last?.id ?? null,
        frete: b.frete,
        acrescimo: b.acrescimo,
        desconto: b.desconto,
        total,
      });
      for (const item of rows)
        await insert(tx, a, b, cmd, "preco_item_compra", {
          ...item,
          precificacao_id: id,
        });
      return { id, versao: (last?.versao ?? 0) + 1 };
    },
  },
  {
    path: "/compras/vinculos-valores",
    input: "purchaseValueLink",
    permission: "compras:conciliar_valores",
    scope,
    async run(tx, a, b, _id, cmd) {
      await authorize(tx, a, "pagar:ler", b.unidade_id as string);
      const p = await one(
        tx,
        "SELECT pedido_id FROM precificacao_compra WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
        [a.organizacao_id, b.unidade_id, b.precificacao_id],
      );
      await tx.query("SELECT travar_valores_compra($1,$2,$3)", [
        a.organizacao_id,
        b.unidade_id,
        p.pedido_id,
      ]);
      return {
        id: await insert(tx, a, b, cmd, "vinculo_valor_compra", {
          precificacao_id: b.precificacao_id,
          obrigacao_id: b.obrigacao_id,
          valor: b.valor,
        }),
      };
    },
  },
  {
    path: "/compras/reversoes-valores",
    input: "purchaseValueReverse",
    permission: "compras:conciliar_valores",
    scope,
    async run(tx, a, b, _id, cmd) {
      await authorize(tx, a, "pagar:ler", b.unidade_id as string);
      const p = await one(
        tx,
        "SELECT pedido_id FROM vinculo_valor_compra_consulta WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
        [a.organizacao_id, b.unidade_id, b.vinculo_id],
      );
      await tx.query("SELECT travar_valores_compra($1,$2,$3)", [
        a.organizacao_id,
        b.unidade_id,
        p.pedido_id,
      ]);
      return {
        id: await insert(tx, a, b, cmd, "reversao_vinculo_compra", {
          vinculo_id: b.vinculo_id,
        }),
      };
    },
  },
];
export const pricingLists = [
  {
    path: "/compras/precificacoes",
    table: "precificacao_compra_consulta",
    columns:
      "id,unidade_id,pedido_id,versao,anterior_id,frete,acrescimo,desconto,total,atual,vinculado_pedido,saldo_vincular,autor_id,motivo,criada_em",
    permission: "compras:ler",
  },
  {
    path: "/compras/precos-itens",
    table: "preco_item_compra",
    columns:
      "id,unidade_id,precificacao_id,item_pedido_id,preco_apresentacao,subtotal,autor_id,motivo,criada_em",
    permission: "compras:ler",
  },
  {
    path: "/compras/vinculos-valores",
    table: "vinculo_valor_compra_consulta",
    columns:
      "id,unidade_id,precificacao_id,pedido_id,obrigacao_id,valor,ativo,autor_id,motivo,criada_em",
    permission: "pagar:ler",
  },
  {
    path: "/compras/reversoes-valores",
    table: "reversao_vinculo_compra",
    columns: "id,unidade_id,vinculo_id,autor_id,motivo,criada_em",
    permission: "pagar:ler",
  },
  {
    path: "/a-pagar/conciliacao-compras",
    table: "obrigacao_valor_compra_consulta",
    columns:
      "id,unidade_id,fornecedor_id,pedido_id,valor,revertido,nao_vinculado",
    permission: "pagar:ler",
  },
].map((x) => ({ ...x, unit: true }));
