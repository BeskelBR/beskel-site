import { choice, integer, object, text, time, uuid } from "../schemas.ts";
export const amount = {
  type: "string",
  pattern: "^(0|[1-9][0-9]{0,13})(\\.[0-9]{1,6})?$",
};
export const inventoryInputs = {
  stockUnit: object({
    simbolo: text,
    dimensao: choice("contagem", "massa", "volume"),
    fator_referencia: amount,
  }),
  product: object({ nome: text, unidade_base_id: uuid, finalidade: text }),
  presentation: object(
    {
      produto_id: uuid,
      codigo: text,
      versao: integer,
      anterior_id: uuid,
      unidade_conteudo_id: uuid,
      quantidade_conteudo: amount,
      fator_unidade_base: amount,
    },
    [
      "produto_id",
      "codigo",
      "versao",
      "unidade_conteudo_id",
      "quantidade_conteudo",
      "fator_unidade_base",
    ],
  ),
  stockLot: object(
    {
      apresentacao_id: uuid,
      fabricante: text,
      codigo: text,
      validade: { type: "string", format: "date" },
      situacao_validade: choice("conhecida", "pendente", "isenta"),
      custo_base: amount,
    },
    ["apresentacao_id", "fabricante", "codigo", "situacao_validade"],
  ),
  container: object(
    {
      lote_id: uuid,
      identificacao: text,
      aberto_em: time,
      validade_apos_abertura: time,
      regra_informada: text,
    },
    ["lote_id", "identificacao", "aberto_em", "regra_informada"],
  ),
  custody: object(
    { tipo: choice("hospital", "tutor"), paciente_id: uuid, episodio_id: uuid },
    ["tipo"],
  ),
  position: object(
    { local_id: uuid, lote_id: uuid, recipiente_id: uuid, custodia_id: uuid },
    ["local_id", "lote_id", "custodia_id"],
  ),
  entry: object({
    posicao_id: uuid,
    quantidade_apresentacoes: amount,
    ocorrido_em: time,
    motivo: text,
  }),
  movement: object({
    origem_id: uuid,
    destino_id: uuid,
    quantidade_base: amount,
    ocorrido_em: time,
    motivo: text,
  }),
  loss: object({
    posicao_id: uuid,
    quantidade_base: amount,
    ocorrido_em: time,
    motivo: text,
  }),
  reserve: object({
    posicao_id: uuid,
    quantidade_base: amount,
    expira_em: time,
    motivo: text,
  }),
  fulfill: object({ destino_id: uuid, ocorrido_em: time, motivo: text }),
  return: object({ quantidade_base: amount, ocorrido_em: time, motivo: text }),
  reversal: object({ ocorrido_em: time, motivo: text }),
  inventory: object({ local_id: uuid, motivo: text }),
  count: object({
    sessao_id: uuid,
    posicao_id: uuid,
    quantidade_contada: amount,
    contada_em: time,
    versao_esperada: integer,
  }),
  applyCount: object({ motivo: text, ocorrido_em: time }),
};
export const inventoryPermissions = [
  "estoque:ler",
  "estoque:catalogar",
  "estoque:movimentar",
  "estoque:reservar",
  "estoque:inventariar",
  "estoque:ajustar",
  "estoque:reverter",
];
