# ADR 0016 — Preços negociados e conciliação de compras

Estado: proposta implementada em DEV, 15/09/2026, C6. Restrições do usuário: somente SISTEMA/hvb-sistema-dev, dados fictícios, sem infraestrutura ou operação externa. O documento de escopo informa capacidades; não aprova políticas fiscais ou hospitalares.

## Decisão

Cada precificação é uma versão completa do pedido, com preço por apresentação e subtotal de cada item. Total = soma dos subtotais + frete + acréscimo − desconto. Quantidades originais são preservadas. Dinheiro entra como texto decimal; a multiplicação deve resultar em centavos exatos. Um subtotal como 0,5 × 1,25 é rejeitado, pois não existe política de arredondamento aprovada. Cabeçalho e todos os itens são gravados no mesmo comando. Versão esperada controla concorrência; histórico é imutável.

A obrigação C4 registra o valor declarado do documento independentemente do preço negociado. A conciliação é uma ação humana explícita entre uma obrigação existente e a versão atual do preço, com o mesmo pedido, fornecedor e unidade. Não cria obrigação, pagamento, liquidação, entrada física ou custo do lote. Exemplo sintético: pedido total 105, obrigação 100, vínculo 100; saldo comercial para vincular 5 e dívida ainda não paga 100.

Vínculos podem ser parciais. O valor não pode exceder o restante da obrigação nem o orçamento atual do pedido. Todos os vínculos ativos do pedido contam, inclusive os de versões anteriores. Nova versão não pode reduzir total abaixo desse montante. Cada vínculo mantém a versão exata de origem; não é transferido para a nova versão.

Reverter um vínculo libera conciliação sem desfazer a dívida. Reverter a obrigação torna seus vínculos inativos por consulta, mantendo os registros históricos. A obrigação corrigida começa sem vínculos; nenhuma associação é transferida automaticamente. Pedido cancelado não admite nova precificação, mas ainda pode ter sua obrigação explícita conciliada contra a última versão existente; cancelamento físico não comprova inexistência de dívida.

## Integridade e acesso

RLS por organização, FKs de unidade, comandos abertos, auditoria/outbox e idempotência seguem a fundação. Travas usam a mesma ordem: contas a pagar da unidade, depois pedido. Validações reconsultam saldos após a trava. Trigger diferido exige todos os itens e fechamento exato do total; registros não aceitam alteração ou exclusão.

Precificar exige compras:precificar. Vincular/reverter exige compras:conciliar_valores e pagar:ler na unidade. Consultas de preços usam compras:ler e incluem o agregado vinculado do pedido; vínculos individuais, reversões e conciliação de obrigações exigem pagar:ler. Paginação UUID e filtros são os mesmos da API existente.

## Limites

Saldo de uma versão histórica compara seu total fixo ao agregado ativo atual e pode ficar negativo após uma versão maior; somente a versão atual define capacidade de novo vínculo. A consulta de obrigações também inclui despesas sem pedido e obrigações revertidas: nao_vinculado não é indicador de inadimplência ou tarefa obrigatória. Despesas sem pedido não são elegíveis a esse vínculo.

Não há aprovação comercial de preço, emissão/validação fiscal, cálculo de tributos, rateio contábil por item/recebimento, política de arredondamento ou crédito comercial neste bloco. Acréscimo é valor informado, sem natureza tributária inferida. Esses limites permanecem na matriz e nas pendências. Interfaces, autenticação operacional e homologação seguem posteriores.
