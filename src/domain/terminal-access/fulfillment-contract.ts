// Future Mobile -> API boundary. No write route is enabled by this contract.
// Access events never satisfy this command or imply execution/billing.
export type FulfillmentProposal = {
  ordem_id: string;
  sessao_acesso_id: string;
  versao_ordem_esperada: number;
  referencia: string;
  ocorrido_em: string;
  motivo: string;
  itens: Array<{
    item_ordem_id?: string;
    produto_id: string;
    quantidade_base: string;
    resultado: "retirado" | "nao_retirado" | "adicional";
    origem_id?: string;
    destino_id?: string;
    lote_id?: string;
    motivo: string;
  }>;
};
export type FulfillmentCompensation = {
  fulfillment_original_id: string;
  transacao_original_id: string;
  quantidade_base: string;
  motivo: string;
  ocorrido_em: string;
};
