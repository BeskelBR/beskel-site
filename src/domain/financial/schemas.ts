import { choice, integer, object, text, time, uuid } from "../schemas.ts";
import { amount } from "../inventory/schemas.ts";
export const money = {
  type: "string",
  pattern: "^(0|[1-9][0-9]{0,13})(\\.[0-9]{1,2})?$",
};
const date = { type: "string", format: "date" };
const common = {
  unidade_id: uuid,
  motivo: text,
  simulacao: { type: "boolean", const: true },
  confirmacao_humana: { type: "boolean", const: true },
};
export const financialInputs = {
  pagador: object({ ...common, responsavel_id: uuid }, [
    ...Object.keys(common),
    "responsavel_id",
  ]),
  item_comercial_versao: object(
    {
      ...common,
      codigo: text,
      versao: integer,
      descricao: text,
      tipo: choice("servico", "produto"),
      produto_id: uuid,
      unidade_medida_id: uuid,
    },
    [
      ...Object.keys(common),
      "codigo",
      "versao",
      "descricao",
      "tipo",
      "unidade_medida_id",
    ],
  ),
  preco_versao: object(
    {
      ...common,
      item_comercial_id: uuid,
      versao: integer,
      inicio: time,
      fim: time,
      valor: money,
    },
    [
      ...Object.keys(common),
      "item_comercial_id",
      "versao",
      "inicio",
      "fim",
      "valor",
    ],
  ),
  conta: object({ ...common, episodio_id: uuid, descricao: text }, [
    ...Object.keys(common),
    "episodio_id",
    "descricao",
  ]),
  caixa: object({ ...common, descricao: text }, [
    ...Object.keys(common),
    "descricao",
  ]),
  sessao_caixa: object(
    { ...common, caixa_id: uuid, aberta_em: time, abertura: money },
    [...Object.keys(common), "caixa_id", "aberta_em", "abertura"],
  ),
  recebimento: object(
    {
      ...common,
      pagador_id: uuid,
      meio: choice("dinheiro", "transferencia", "cartao"),
      sessao_id: uuid,
      referencia: uuid,
      recebido_em: time,
      valor: money,
      evidencia: text,
    },
    [
      ...Object.keys(common),
      "pagador_id",
      "meio",
      "referencia",
      "recebido_em",
      "valor",
      "evidencia",
    ],
  ),
  liquidacao: object(
    { ...common, titulo_id: uuid, recebimento_id: uuid, valor: money },
    [...Object.keys(common), "titulo_id", "recebimento_id", "valor"],
  ),
  credito_cliente: object(
    { ...common, pagador_id: uuid, recebimento_id: uuid, valor: money },
    [...Object.keys(common), "pagador_id", "recebimento_id", "valor"],
  ),
  aplicacao_credito: object(
    { ...common, credito_id: uuid, titulo_id: uuid, valor: money },
    [...Object.keys(common), "credito_id", "titulo_id", "valor"],
  ),
  parcela_adquirente: object(
    {
      ...common,
      recebimento_id: uuid,
      numero: integer,
      adquirente: text,
      referencia: text,
      repasse_previsto: date,
      bruto: money,
      taxa: money,
      liquido: money,
    },
    [
      ...Object.keys(common),
      "recebimento_id",
      "numero",
      "adquirente",
      "referencia",
      "repasse_previsto",
      "bruto",
      "taxa",
      "liquido",
    ],
  ),
  conta_financeira: object({ ...common, descricao: text }, [
    ...Object.keys(common),
    "descricao",
  ]),
  deposito_adquirente: object(
    {
      ...common,
      conta_financeira_id: uuid,
      adquirente: text,
      referencia: text,
      depositado_em: time,
      valor: money,
      evidencia: text,
    },
    [
      ...Object.keys(common),
      "conta_financeira_id",
      "adquirente",
      "referencia",
      "depositado_em",
      "valor",
      "evidencia",
    ],
  ),
  alocacao_deposito: object(
    { ...common, deposito_id: uuid, parcela_id: uuid, valor: money },
    [...Object.keys(common), "deposito_id", "parcela_id", "valor"],
  ),
  item_extrato: object(
    {
      ...common,
      conta_financeira_id: uuid,
      referencia: text,
      ocorrido_em: time,
      valor: money,
      evidencia: text,
    },
    [
      ...Object.keys(common),
      "conta_financeira_id",
      "referencia",
      "ocorrido_em",
      "valor",
      "evidencia",
    ],
  ),
  vinculo_conciliacao: object(
    {
      ...common,
      deposito_id: uuid,
      extrato_id: uuid,
      valor: money,
      evidencia: text,
    },
    [...Object.keys(common), "deposito_id", "extrato_id", "valor", "evidencia"],
  ),
  reversao_financeira: object(
    {
      ...common,
      item_conta_id: uuid,
      titulo_id: uuid,
      recebimento_id: uuid,
      liquidacao_id: uuid,
      credito_id: uuid,
      aplicacao_id: uuid,
      alocacao_deposito_id: uuid,
      conciliacao_id: uuid,
    },
    [...Object.keys(common)],
  ),
  evento_cobravel: object(
    {
      ...common,
      item_comercial_id: uuid,
      execucao_id: uuid,
      consumo_item_id: uuid,
      periodo_diaria_id: uuid,
      quantidade: amount,
    },
    [...Object.keys(common), "item_comercial_id", "quantidade"],
  ),

  avaliacao_cobranca: object(
    {
      ...common,
      evento_id: uuid,
      versao_esperada: { type: "integer", minimum: 0 },
      preco_id: uuid,
      cobertura_id: uuid,
      decisao: choice("cobravel", "isento", "cobertura", "pendente"),
      desconto: money,
    },
    [
      ...Object.keys(common),
      "evento_id",
      "versao_esperada",
      "decisao",
      "desconto",
    ],
  ),

  item_conta: object({
    ...common,
    conta_id: uuid,
    avaliacao_id: uuid,
    responsabilidades: {
      type: "array",
      maxItems: 20,
      items: object({ pagador_id: uuid, valor: money }),
    },
  }),

  titulo: object({
    ...common,
    pagador_id: uuid,
    vencimento: date,
    itens: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: object({ responsabilidade_id: uuid, valor: money }),
    },
  }),

  fechamento_caixa: object({
    ...common,
    sessao_id: uuid,
    fechada_em: time,
    contado: money,
  }),
};
export const financialPermissions = [
  "financeiro:ler",
  "financeiro:configurar",
  "financeiro:avaliar",
  "financeiro:emitir",
  "financeiro:receber",
  "financeiro:alocar",
  "financeiro:credito",
  "financeiro:caixa",
  "financeiro:conciliar",
  "financeiro:reverter",
];
