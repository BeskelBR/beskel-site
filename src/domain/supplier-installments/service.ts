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
export const installmentActions: Action[] = [
  {
    path: "/a-pagar/planos-parcelas",
    input: "supplierInstallmentPlan",
    permission: "pagar:parcelar",
    scope,
    async run(tx, a, b, _id, cmd) {
      await one(
        tx,
        "SELECT id FROM obrigacao_fornecedor WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
        [a.organizacao_id, b.unidade_id, b.obrigacao_id],
      );
      await tx.query("SELECT travar_contas_pagar($1,$2)", [
        a.organizacao_id,
        b.unidade_id,
      ]);
      const last = (
        await tx.query(
          "SELECT id,versao FROM plano_parcelas_fornecedor WHERE organizacao_id=$1 AND obrigacao_id=$2 ORDER BY versao DESC LIMIT 1",
          [a.organizacao_id, b.obrigacao_id],
        )
      ).rows[0];
      if ((last?.versao ?? 0) !== b.versao_esperada)
        throw new DomainError(409, "plano_alterado_recarregue");
      const id = await insert(tx, a, b, cmd, "plano_parcelas_fornecedor", {
        obrigacao_id: b.obrigacao_id,
        versao: (last?.versao ?? 0) + 1,
        anterior_id: last?.id ?? null,
      });
      const installments = b.parcelas as {
        vencimento: string;
        valor: string;
      }[];
      for (const [index, item] of installments.entries())
        await insert(tx, a, b, cmd, "parcela_fornecedor", {
          ...item,
          plano_id: id,
          numero: index + 1,
        });
      return { id, versao: (last?.versao ?? 0) + 1 };
    },
  },
  {
    path: "/a-pagar/alocacoes-parcelas",
    input: "supplierInstallmentAllocation",
    permission: "pagar:alocar_parcela",
    scope,
    async run(tx, a, b, _id, cmd) {
      await one(
        tx,
        "SELECT id FROM parcela_fornecedor WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
        [a.organizacao_id, b.unidade_id, b.parcela_id],
      );
      return {
        id: await insert(tx, a, b, cmd, "alocacao_parcela_fornecedor", {
          parcela_id: b.parcela_id,
          liquidacao_id: b.liquidacao_id,
          valor: b.valor,
        }),
      };
    },
  },
  {
    path: "/a-pagar/reversoes-parcelas",
    input: "supplierInstallmentReverse",
    permission: "pagar:alocar_parcela",
    scope,
    async run(tx, a, b, _id, cmd) {
      await one(
        tx,
        "SELECT id FROM alocacao_parcela_fornecedor WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3",
        [a.organizacao_id, b.unidade_id, b.alocacao_id],
      );
      return {
        id: await insert(tx, a, b, cmd, "reversao_alocacao_parcela", {
          alocacao_id: b.alocacao_id,
        }),
      };
    },
  },
];
export const installmentLists = [
  {
    path: "/a-pagar/planos-parcelas",
    table: "plano_parcelas_fornecedor_consulta",
    columns:
      "obrigacao_id,fornecedor_id,versao,anterior_id,valor_obrigacao,saldo_obrigacao,obrigacao_revertida,atual,liquidado_sem_parcela",
  },
  {
    path: "/a-pagar/parcelas",
    table: "parcela_fornecedor_consulta",
    columns:
      "plano_id,obrigacao_id,fornecedor_id,numero,vencimento,valor,vigente,alocado,saldo",
  },
  {
    path: "/a-pagar/alocacoes-parcelas",
    table: "alocacao_parcela_fornecedor_consulta",
    columns: "parcela_id,liquidacao_id,plano_id,obrigacao_id,valor,ativo",
  },
  {
    path: "/a-pagar/reversoes-parcelas",
    table: "reversao_alocacao_parcela",
    columns: "alocacao_id",
  },
  {
    path: "/a-pagar/liquidacoes-para-parcelas",
    table: "liquidacao_parcela_consulta",
    columns:
      "obrigacao_id,pagamento_id,credito_id,liquidada_em,valor,revertida,nao_alocado",
  },
].map((x) => ({
  ...x,
  columns: `id,unidade_id,${x.columns},autor_id,motivo,criada_em`,
  unit: true,
  permission: "pagar:ler",
}));
