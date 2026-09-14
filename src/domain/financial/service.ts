import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { DomainError, one } from "../core.ts";
import type { Actor } from "../core.ts";
import type { Action, Body } from "../foundation.ts";
import { exact } from "../inventory/decimal.ts";
const str = (b: Body, k: string) => b[k] as string;
export function cents(value: string) {
  const scaled = exact(value);
  if (scaled % 10000n !== 0n)
    throw new DomainError(400, "valor_exige_centavos_exatos");
  return scaled / 10000n;
}
export function moneyText(value: bigint) {
  if (value < 0n) throw new DomainError(409, "valor_monetario_negativo");
  return `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
}
async function lock(tx: PoolClient, a: Actor, b: Body) {
  await one(tx, "SELECT travar_financeiro($1,$2)", [
    a.organizacao_id,
    b.unidade_id,
  ]);
}
async function get(
  tx: PoolClient,
  a: Actor,
  b: Body,
  table: string,
  id: string,
  columns: string,
) {
  return one(
    tx,
    `SELECT ${columns} FROM ${table} WHERE organizacao_id=$1 AND unidade_id=$2 AND id=$3`,
    [a.organizacao_id, b.unidade_id, id],
  );
}
async function insert(
  tx: PoolClient,
  a: Actor,
  b: Body,
  cmd: string,
  table: string,
  values: Body,
) {
  const id = randomUUID(),
    data = {
      id,
      organizacao_id: a.organizacao_id,
      unidade_id: b.unidade_id,
      autor_id: a.usuario_id,
      comando_id: cmd,
      motivo: b.motivo,
      ...values,
    };
  const keys = Object.keys(data);
  await tx.query(
    `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map((_, i) => `$${i + 1}`).join(",")})`,
    Object.values(data),
  );
  return id;
}
function simple(
  path: string,
  table: string,
  permission: string,
  fields: string[],
): Action {
  return {
    path: `/financeiro/${path}`,
    input: table,
    permission: `financeiro:${permission}`,
    scope: async (_t, _a, b) => str(b, "unidade_id"),
    async run(tx, a, b, _id, cmd) {
      await lock(tx, a, b);
      return {
        id: await insert(
          tx,
          a,
          b,
          cmd,
          table,
          Object.fromEntries(fields.map((f) => [f, b[f] ?? null])),
        ),
      };
    },
  };
}
export const financialActions: Action[] = [
  simple("pagadores", "pagador", "configurar", ["responsavel_id"]),
  simple("catalogo", "item_comercial_versao", "configurar", [
    "codigo",
    "versao",
    "descricao",
    "tipo",
    "produto_id",
    "unidade_medida_id",
  ]),
  simple("precos", "preco_versao", "configurar", [
    "item_comercial_id",
    "versao",
    "inicio",
    "fim",
    "valor",
  ]),
  simple("contas", "conta", "emitir", ["episodio_id", "descricao"]),
  simple("caixas", "caixa", "configurar", ["descricao"]),
  simple("sessoes", "sessao_caixa", "caixa", [
    "caixa_id",
    "aberta_em",
    "abertura",
  ]),
  simple("recebimentos", "recebimento", "receber", [
    "pagador_id",
    "meio",
    "sessao_id",
    "referencia",
    "recebido_em",
    "valor",
    "evidencia",
  ]),
  simple("liquidacoes", "liquidacao", "alocar", [
    "titulo_id",
    "recebimento_id",
    "valor",
  ]),
  simple("creditos", "credito_cliente", "credito", [
    "pagador_id",
    "recebimento_id",
    "valor",
  ]),
  simple("aplicacoes-credito", "aplicacao_credito", "credito", [
    "credito_id",
    "titulo_id",
    "valor",
  ]),
  simple("parcelas", "parcela_adquirente", "receber", [
    "recebimento_id",
    "numero",
    "adquirente",
    "referencia",
    "repasse_previsto",
    "bruto",
    "taxa",
    "liquido",
  ]),
  simple("contas-financeiras", "conta_financeira", "configurar", ["descricao"]),
  simple("depositos", "deposito_adquirente", "conciliar", [
    "conta_financeira_id",
    "adquirente",
    "referencia",
    "depositado_em",
    "valor",
    "evidencia",
  ]),
  simple("alocacoes-deposito", "alocacao_deposito", "conciliar", [
    "deposito_id",
    "parcela_id",
    "valor",
  ]),
  simple("extrato", "item_extrato", "conciliar", [
    "conta_financeira_id",
    "referencia",
    "ocorrido_em",
    "valor",
    "evidencia",
  ]),
  simple("conciliacoes", "vinculo_conciliacao", "conciliar", [
    "deposito_id",
    "extrato_id",
    "valor",
    "evidencia",
  ]),
  simple("reversoes", "reversao_financeira", "reverter", [
    "item_conta_id",
    "titulo_id",
    "recebimento_id",
    "liquidacao_id",
    "credito_id",
    "aplicacao_id",
    "alocacao_deposito_id",
    "conciliacao_id",
  ]),
  {
    path: "/financeiro/eventos",
    input: "evento_cobravel",
    permission: "financeiro:avaliar",
    scope: async (_t, _a, b) => str(b, "unidade_id"),
    async run(tx, a, b, _id, cmd) {
      await lock(tx, a, b);
      const sources = [
        "execucao_id",
        "consumo_item_id",
        "periodo_diaria_id",
      ].filter((k) => b[k]);
      if (sources.length !== 1)
        throw new DomainError(400, "uma_origem_tipificada_obrigatoria");
      let source: Body;
      if (b.execucao_id)
        source = await get(
          tx,
          a,
          b,
          "execucao",
          str(b, "execucao_id"),
          "episodio_id,executada_em AS competencia",
        );
      else if (b.periodo_diaria_id)
        source = await get(
          tx,
          a,
          b,
          "periodo_diaria",
          str(b, "periodo_diaria_id"),
          "episodio_id,inicio AS competencia",
        );
      else
        source = await one(
          tx,
          "SELECT c.episodio_id,c.ocorrido_em AS competencia FROM consumo_item ci JOIN consumo c ON c.organizacao_id=ci.organizacao_id AND c.id=ci.consumo_id WHERE ci.organizacao_id=$1 AND ci.unidade_id=$2 AND ci.id=$3",
          [a.organizacao_id, b.unidade_id, b.consumo_item_id],
        );
      return {
        id: await insert(tx, a, b, cmd, "evento_cobravel", {
          ...source,
          item_comercial_id: b.item_comercial_id,
          execucao_id: b.execucao_id ?? null,
          consumo_item_id: b.consumo_item_id ?? null,
          periodo_diaria_id: b.periodo_diaria_id ?? null,
          quantidade: b.quantidade,
        }),
      };
    },
  },
  {
    path: "/financeiro/avaliacoes",
    input: "avaliacao_cobranca",
    permission: "financeiro:avaliar",
    scope: async (_t, _a, b) => str(b, "unidade_id"),
    async run(tx, a, b, _id, cmd) {
      await lock(tx, a, b);
      const e = await get(
        tx,
        a,
        b,
        "evento_cobravel_consulta",
        str(b, "evento_id"),
        "id,episodio_id,item_comercial_id,quantidade,competencia,origem_ativa,execucao_id,consumo_item_id,periodo_diaria_id,semantica_pendente,contexto_diaria,antecedente_comercial_ativo(id) AS antecedente_ativo",
      );
      await one(
        tx,
        "SELECT id FROM episodio WHERE organizacao_id=$1 AND id=$2 FOR UPDATE",
        [a.organizacao_id, e.episodio_id],
      );
      const last = (
        await tx.query(
          "SELECT id,versao FROM avaliacao_cobranca WHERE organizacao_id=$1 AND evento_id=$2 ORDER BY versao DESC LIMIT 1",
          [a.organizacao_id, e.id],
        )
      ).rows[0];
      if ((last?.versao ?? 0) !== b.versao_esperada)
        throw new DomainError(409, "avaliacao_alterada_recarregue");
      let bruto: bigint | null = null,
        result = "pendente",
        benefit = 0n,
        value: bigint | null = null,
        reason = "decisao_comercial_pendente";
      const discount = cents(str(b, "desconto"));
      if (b.preco_id) {
        const p = await get(
          tx,
          a,
          b,
          "preco_versao",
          str(b, "preco_id"),
          "valor",
        );
        const product = exact(e.quantidade) * cents(p.valor);
        if (product % 1000000n !== 0n)
          throw new DomainError(
            409,
            "preco_quantidade_exige_arredondamento_nao_autorizado",
          );
        bruto = product / 1000000n;
      }
      let cover: Body | undefined;
      if (b.cobertura_id)
        cover = await get(
          tx,
          a,
          b,
          "avaliacao_cobertura_consulta",
          str(b, "cobertura_id"),
          "situacao_atual",
        );
      if (!e.origem_ativa) reason = "origem_exige_revisao";
      else if (e.antecedente_ativo)
        reason = "documento_da_origem_anterior_ainda_ativo";
      else if (e.semantica_pendente)
        reason = "parcial_ou_material_do_tutor_pendente";
      else if (bruto === null) reason = "preco_nao_informado";
      else if (b.decisao === "pendente") reason = "decisao_comercial_pendente";
      else if (b.cobertura_id || e.contexto_diaria) {
        if (
          cover?.situacao_atual === "incluido" &&
          b.decisao === "cobertura" &&
          discount === 0n
        ) {
          result = "incluido";
          benefit = bruto;
          value = 0n;
          reason = "cobertura_simulada_sem_divida";
        } else reason = "cobertura_ambigua_ou_nao_informada";
      } else if (b.decisao === "cobertura") reason = "cobertura_nao_informada";
      else {
        if (discount > bruto)
          throw new DomainError(409, "desconto_excede_bruto");
        value = bruto - discount;
        if (b.decisao === "isento" && value !== 0n)
          throw new DomainError(409, "isencao_exige_desconto_integral");
        result = value === 0n ? "isento" : "cobravel";
        reason = "decisao_explicita_simulada";
      }
      const version = (last?.versao ?? 0) + 1;
      const id = await insert(tx, a, b, cmd, "avaliacao_cobranca", {
        evento_id: e.id,
        versao: version,
        anterior_id: last?.id ?? null,
        preco_id: b.preco_id ?? null,
        cobertura_id: b.cobertura_id ?? null,
        resultado: result,
        bruto: bruto === null ? null : moneyText(bruto),
        desconto: moneyText(discount),
        beneficio: moneyText(benefit),
        valor: value === null ? null : moneyText(value),
        justificativa: reason,
      });
      return { id, versao: version };
    },
  },
  {
    path: "/financeiro/itens",
    input: "item_conta",
    permission: "financeiro:emitir",
    scope: async (_t, _a, b) => str(b, "unidade_id"),
    async run(tx, a, b, _id, cmd) {
      await lock(tx, a, b);
      const av = await get(
        tx,
        a,
        b,
        "avaliacao_cobranca_consulta",
        str(b, "avaliacao_id"),
        "valor,evento_id,episodio_id",
      );
      await one(
        tx,
        "SELECT id FROM episodio WHERE organizacao_id=$1 AND id=$2 FOR UPDATE",
        [a.organizacao_id, av.episodio_id],
      );
      const e = await get(
        tx,
        a,
        b,
        "evento_cobravel",
        av.evento_id,
        "item_comercial_id",
      );
      const catalog = await get(
        tx,
        a,
        b,
        "item_comercial_versao",
        e.item_comercial_id,
        "descricao",
      );
      if (av.valor === null) throw new DomainError(409, "avaliacao_pendente");
      const id = await insert(tx, a, b, cmd, "item_conta", {
        conta_id: b.conta_id,
        avaliacao_id: b.avaliacao_id,
        descricao: catalog.descricao,
        valor: av.valor,
      });
      for (const r of b.responsabilidades as Body[])
        await insert(tx, a, b, cmd, "responsabilidade", {
          item_conta_id: id,
          pagador_id: r.pagador_id,
          valor: r.valor,
        });
      return { id };
    },
  },
  {
    path: "/financeiro/titulos",
    input: "titulo",
    permission: "financeiro:emitir",
    scope: async (_t, _a, b) => str(b, "unidade_id"),
    async run(tx, a, b, _id, cmd) {
      await lock(tx, a, b);
      const items = b.itens as Body[],
        total = items.reduce((sum, i) => sum + cents(str(i, "valor")), 0n);
      const id = await insert(tx, a, b, cmd, "titulo", {
        pagador_id: b.pagador_id,
        vencimento: b.vencimento,
        valor: moneyText(total),
      });
      for (const i of items)
        await insert(tx, a, b, cmd, "titulo_item", {
          titulo_id: id,
          responsabilidade_id: i.responsabilidade_id,
          valor: i.valor,
        });
      return { id };
    },
  },
  {
    path: "/financeiro/fechamentos",
    input: "fechamento_caixa",
    permission: "financeiro:caixa",
    scope: async (_t, _a, b) => str(b, "unidade_id"),
    async run(tx, a, b, _id, cmd) {
      await lock(tx, a, b);
      const s = await get(
        tx,
        a,
        b,
        "sessao_caixa_consulta",
        str(b, "sessao_id"),
        "esperado",
      );
      const delta = cents(str(b, "contado")) - cents(s.esperado),
        diff = (delta < 0n ? "-" : "") + moneyText(delta < 0n ? -delta : delta);
      return {
        id: await insert(tx, a, b, cmd, "fechamento_caixa", {
          sessao_id: b.sessao_id,
          fechada_em: b.fechada_em,
          contado: b.contado,
          esperado: s.esperado,
          diferenca: diff,
        }),
      };
    },
  },
];
export const financialLists = [
  {
    path: "/financeiro/pagadores",
    table: "pagador",
    columns: "id,unidade_id,responsavel_id,autor_id,motivo,criada_em",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/catalogo",
    table: "item_comercial_versao",
    columns:
      "id,unidade_id,codigo,versao,descricao,tipo,produto_id,unidade_medida_id,autor_id,motivo,criada_em",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/precos",
    table: "preco_versao",
    columns:
      "id,unidade_id,item_comercial_id,versao,inicio,fim,valor,autor_id,motivo,criada_em",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/contas",
    table: "conta",
    columns: "id,unidade_id,episodio_id,descricao,autor_id,motivo,criada_em",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/eventos",
    table: "evento_cobravel_consulta",
    columns:
      "id,unidade_id,episodio_id,item_comercial_id,execucao_id,consumo_item_id,periodo_diaria_id,quantidade,competencia,autor_id,motivo,criada_em,origem_ativa",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/avaliacoes",
    table: "avaliacao_cobranca_consulta",
    columns:
      "id,unidade_id,evento_id,versao,anterior_id,preco_id,cobertura_id,resultado,bruto,desconto,beneficio,valor,justificativa,autor_id,motivo,criada_em,episodio_id,necessita_revisao",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/itens",
    table: "item_conta_consulta",
    columns:
      "id,unidade_id,conta_id,avaliacao_id,descricao,valor,autor_id,motivo,criada_em,necessita_revisao,revertido",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/responsabilidades",
    table: "responsabilidade",
    columns:
      "id,unidade_id,item_conta_id,pagador_id,valor,autor_id,motivo,criada_em",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/titulos",
    table: "titulo_consulta",
    columns:
      "id,unidade_id,pagador_id,vencimento,valor,autor_id,motivo,criada_em,saldo,revertido",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/itens-titulo",
    table: "titulo_item",
    columns:
      "id,unidade_id,titulo_id,responsabilidade_id,valor,autor_id,motivo,criada_em",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/caixas",
    table: "caixa",
    columns: "id,unidade_id,descricao,autor_id,motivo,criada_em",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/sessoes",
    table: "sessao_caixa_consulta",
    columns:
      "id,unidade_id,caixa_id,aberta_em,abertura,autor_id,motivo,criada_em,esperado,fechada",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/fechamentos",
    table: "fechamento_caixa",
    columns:
      "id,unidade_id,sessao_id,fechada_em,contado,esperado,diferenca,autor_id,motivo,criada_em",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/recebimentos",
    table: "recebimento_consulta",
    columns:
      "id,unidade_id,pagador_id,meio,sessao_id,referencia,recebido_em,valor,evidencia,autor_id,motivo,criada_em,disponivel,bruto_nao_programado,revertido",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/liquidacoes",
    table: "liquidacao",
    columns:
      "id,unidade_id,titulo_id,recebimento_id,valor,autor_id,motivo,criada_em",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/creditos",
    table: "credito_consulta",
    columns:
      "id,unidade_id,pagador_id,recebimento_id,valor,autor_id,motivo,criada_em,disponivel,revertido",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/aplicacoes-credito",
    table: "aplicacao_credito",
    columns:
      "id,unidade_id,credito_id,titulo_id,valor,autor_id,motivo,criada_em",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/parcelas",
    table: "parcela_adquirente_consulta",
    columns:
      "id,unidade_id,recebimento_id,numero,adquirente,referencia,repasse_previsto,bruto,taxa,liquido,autor_id,motivo,criada_em,saldo",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/contas-financeiras",
    table: "conta_financeira",
    columns: "id,unidade_id,descricao,autor_id,motivo,criada_em",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/depositos",
    table: "deposito_consulta",
    columns:
      "id,unidade_id,conta_financeira_id,adquirente,referencia,depositado_em,valor,evidencia,autor_id,motivo,criada_em,nao_alocado,nao_conciliado",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/alocacoes-deposito",
    table: "alocacao_deposito",
    columns:
      "id,unidade_id,deposito_id,parcela_id,valor,autor_id,motivo,criada_em",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/extrato",
    table: "extrato_consulta",
    columns:
      "id,unidade_id,conta_financeira_id,referencia,ocorrido_em,valor,evidencia,autor_id,motivo,criada_em,nao_conciliado",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/conciliacoes",
    table: "vinculo_conciliacao",
    columns:
      "id,unidade_id,deposito_id,extrato_id,valor,evidencia,autor_id,motivo,criada_em",
    unit: true,
    permission: "financeiro:ler",
  },
  {
    path: "/financeiro/reversoes",
    table: "reversao_financeira",
    columns:
      "id,unidade_id,item_conta_id,titulo_id,recebimento_id,liquidacao_id,credito_id,aplicacao_id,alocacao_deposito_id,conciliacao_id,autor_id,motivo,criada_em",
    unit: true,
    permission: "financeiro:ler",
  },
];
