# ADR 0012 — Compra e recebimento vinculados ao estoque

Data: 14/09/2026. Proposta técnica implementada em DEV. Políticas hospitalares permanecem pendentes.

O escopo vigente inclui compras/recebimentos. M2 já registra a entrada física e projeta o saldo por lançamentos balanceados; uma compra não deve introduzir um segundo livro ou duplicar esse efeito.

## Decisão

- Fornecedor identificado por nome e referência UUID, dentro da organização/unidade. Sem cadastro fiscal validado ou comunicação externa.
- Pedido imutável com fornecedor, referência, observação e de um a cinquenta itens. Cada item aponta para uma apresentação versionada exata e quantidade decimal. Uma apresentação aparece uma vez por pedido. Itens nascem no mesmo comando do pedido.
- Pedido começa rascunho. Decisão explícita e com estado esperado aprova ou cancela; aprovado também pode ser cancelado. Não há reabertura implícita ou edição do pedido aprovado.
- Recebimento informa pedido, referência deduplicável, referência textual do documento do fornecedor, instante ocorrido e de uma a vinte entradas. Exige pedido aprovado, permissão de compras e de movimentação física na mesma unidade.
- O serviço reutiliza a ação interna de entrada do estoque. Cada linha de recebimento tem o mesmo ID da transação física, o mesmo comando e instante. O fator e custo são os snapshots do estoque existente; não são recalculados a partir de uma nota fiscal.
- Posição de destino deve ser de custódia hospitalar e o lote deve apontar para a apresentação pedida. A unidade também deve coincidir. Não se substitui produto/apresentação por nome.
- Recebimentos parciais são permitidos até a quantidade pedida. Trava por pedido serializa decisões e recebimentos; posições são processadas em ordem determinística. Se qualquer linha falhar, cabeçalho, linhas, transações e saldos da requisição são desfeitos juntos.
- A quantidade recebida é derivada das entradas vinculadas ainda não revertidas. Reversão física existente preserva o recibo, compensa o saldo e libera a quantidade correspondente no pedido; continua sujeita a estoque/reservas disponíveis. Não cria crédito financeiro ao fornecedor.
- Cancelamento após recebimento parcial preserva o que já entrou e impede novas entradas. Reversão de um recebimento cancelado não reabre o pedido.

## Limites

Não há envio de pedido, preço negociado, cálculo de tributo/frete/desconto, nota fiscal eletrônica, título a pagar, pagamento, crédito de fornecedor ou custo contábil automático. O documento informado é uma referência declarada. Fornecedor não é equiparado a fabricante.

Uma entrada independente M2 continua possível, sem ser promovida retroativamente a recebimento de compra. Não se permite anexar uma transação antiga a comando novo. Recebimentos aceitam instante passado explicitamente informado, separado do registro; política de registro tardio permanece pendente.

Correção de fornecedor/pedido, múltiplas versões, substituição de apresentação, devolução comercial, transferência entre unidades e aprovação por alçada precisam de recortes próprios. Até vinte posições por requisição usam o serviço M2 sem otimização especulativa. Medição de carga e homologação geral ficam para a etapa posterior solicitada pelo usuário.

Ver [relatório](../RELATORIO-C1.md), [dicionário](../DADOS-C1.md) e [pendências](../PENDENCIAS-HVB.md).
