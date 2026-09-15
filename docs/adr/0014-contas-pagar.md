# ADR 0014 — Obrigações e pagamentos a fornecedores

Data: 15/09/2026. Proposta técnica DEV; processo real, política fiscal e alçadas não aprovados.

O recebimento físico C1 não estabelece valor a pagar nem prova pagamento. C4 registra fatos financeiros explícitos, sem criar outro livro de estoque ou reaproveitar recebimento de cliente como pagamento a fornecedor.

## Decisões

- Obrigação tem fornecedor, origem compra/despesa, documento declarado, referência UUID, descrição, instante ocorrido, vencimento e valor positivo em centavos exatos. Compra exige pedido do mesmo fornecedor/unidade; despesa não informa pedido. O valor é declarado, sem derivação de quantidade recebida ou custo do lote.
- Cadastro da obrigação não exige pedido aprovado: reconhecer um documento é distinto de aprovar compra. Pedido cancelado sinaliza necessita_revisao, preservando obrigação e saldo. A liquidação continua sendo uma decisão humana explícita; o sistema não presume que o cancelamento eliminou a dívida.
- Uma origem documental por organização/unidade/fornecedor/texto exato. Correção mantém essa origem, aponta para a obrigação anterior revertida e permite apenas um sucessor. Nova referência UUID distingue o comando corretivo; valores anteriores permanecem imutáveis. É preciso reverter as liquidações ativas antes de reverter a obrigação e corrigi-la.
- Pagamento é declaração simulada com fornecedor, conta financeira interna existente, referência, valor, instante e evidência. Não movimenta banco, caixa ou saldo contábil automaticamente. Pode anteceder a obrigação: adiantamento fica disponível para liquidação explícita.
- Liquidação vincula uma obrigação e um pagamento do mesmo fornecedor/unidade. É parcial ou total, até o menor saldo disponível, com instante não anterior ao pagamento ou obrigação e não futuro. Várias liquidações permitem um pagamento para várias obrigações ou vários pagamentos para uma obrigação.
- Reversão é um registro imutável com exatamente um alvo: obrigação, pagamento ou liquidação. Pagamento e obrigação só podem ser revertidos sem liquidações ativas. Reverter liquidação recompõe ambos os saldos; nenhuma reversão apaga fatos ou executa devolução bancária.
- Trava transacional por organização/unidade serializa comandos financeiros deste domínio, também aplicada pelos triggers. FKs tipadas, RLS forçada, comando aberto, autor autenticado e imutabilidade protegem a persistência. APIs exigem simulação, confirmação humana e chave de idempotência.
- Cinco permissões próprias: leitura, registro de obrigação, declaração de pagamento, liquidação e reversão. Ler compras não concede acesso financeiro a fornecedores.

## Limites

Saldo e disponível são projeções aritméticas das liquidações não revertidas. Registros revertidos continuam nas listas; seu flag revertido deve ser considerado, pois valor histórico e saldo aritmético não autorizam novo uso. As escritas impedem liquidar registros revertidos.

O vínculo com pedido não equivale a conciliação de nota/recebimento. Receber ou reverter estoque não altera dívida, pagamento ou custo contábil. Documento é referência textual declarada, sem arquivo/validação fiscal; deduplicação é textual exata. Preços negociados por item, impostos, frete, descontos, rateio de custo, parcelas de obrigação, crédito/devolução do fornecedor e conciliação de saídas bancárias permanecem recortes próprios.

Conta financeira é identificador interno; nenhuma disponibilidade bancária é presumida. Não há assinatura, integração fiscal, pagamentos reais ou mensagem ao fornecedor. Dados e seeds exclusivamente fictícios. Desempenho com múltiplos fornecedores/unidades e verificação geral ficam para a etapa posterior.
