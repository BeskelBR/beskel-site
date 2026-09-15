# ADR 0017 — Rateio explícito e custo por recebimento

Estado: proposta implementada em DEV, C7, 15/09/2026. Restrita a SISTEMA/hvb-sistema-dev e dados fictícios. O escopo informa necessidades; critérios fiscais e hospitalares continuam sem aprovação.

## Decisão

Um rateio versionado referencia uma precificação completa C6. Cada item conserva o subtotal negociado e recebe valores explícitos de frete, acréscimo e desconto. A soma de cada componente deve corresponder ao cabeçalho do preço, e nenhum total de item pode ser negativo. Todos os itens são gravados atomicamente, com autoria, motivo e descrição do critério. O servidor não escolhe percentuais, peso, volume, tributos ou arredondamento por inferência.

Cada avaliação de custo referencia o item de rateio e o mesmo ID da entrada física do recebimento C1/M2. A avaliação abrange toda a quantidade desse item recebido, com valor monetário explícito. Só pode existir uma avaliação ativa por entrada. Recebimentos parciais acumulam quantidade e valor; não excedem a quantidade do pedido nem o total rateado do item. Quando a quantidade avaliada completa o pedido, o último valor precisa fechar o saldo integral. Valores zero são válidos, inclusive para componentes e parcelas de custo zero; não representam gratuidade presumida.

Exemplo fictício: cinco caixas, total negociado/rateado 105. Entradas de duas e três caixas recebem 42 e 63. A apresentação converte cada caixa em dez unidades, preservando os denominadores físicos originais (20 e 30). Não se grava quociente monetário arredondado: valor e quantidade permitem reconstruir a razão exata. O custo físico preexistente de 1,25 por unidade permanece nos movimentos e consumos; a avaliação de aquisição é uma camada analítica separada, sem recalcular o passado.

## Correção e mudanças posteriores

Reverter uma avaliação libera seu valor e quantidade, preservando o registro. Nova versão do rateio exige desfazer todas as avaliações ativas do pedido, para evitar mistura de orçamentos entre versões. A versão esperada impede sucessoras concorrentes. Só se cria rateio com o preço atual; a nova versão pode redistribuir componentes ou referenciar a nova precificação.

Mudança posterior no preço sinaliza preco_atual=false no rateio já escolhido. Esse rateio continua explícito e pode receber avaliações enquanto for a versão atual do rateio; nenhuma atualização automática ocorre. Para adotar o novo preço, é necessário reverter avaliações, criar novo rateio e avaliar novamente. Pedido cancelado ainda pode ter custos de recebimentos anteriores registrados; cancelamento não apaga aquisição ou dívida.

Reversão física da entrada torna suas avaliações inativas por consulta e recompõe a capacidade analítica, sem apagar valores. Uma entrada substituta precisa de nova avaliação. Isso não representa devolução comercial, crédito financeiro ou método contábil de baixa. Quantidade pendente é a parcela do pedido ainda sem avaliação ativa, podendo incluir mercadoria ainda não recebida; não é saldo físico disponível.

## Integridade e acesso

Quatro tabelas imutáveis, RLS por organização e FKs de unidade. Comando aberto, auditoria/outbox, motivo e idempotência seguem a fundação. Trigger diferido exige todos os itens e fechamento de cada componente. O rateio trava o pedido; a avaliação trava pedido e posição física nessa ordem e reconsulta recebimento/saldos depois da trava. Reversão física usa a mesma posição. Operações concorrentes não deixam custo ativo para entrada revertida.

Criar rateio exige compras:ratear_custo; avaliar/reverter exige compras:avaliar_custo. Listas exigem compras:ler e unidade, com paginação e filtros UUID. Nenhuma dessas permissões permite movimentar estoque, liquidar dívida ou executar pagamento implicitamente.

## Limites operacionais

Este bloco entrega composição e atribuição analíticas de aquisição por item/recebimento. Não implanta método de valorização contábil de estoque (média, FIFO etc.), recalcula consumo, aprova tributação, emite nota fiscal ou altera o custo cadastrado do lote. A política real, a interface de revisão e a homologação ficam nas pendências. Notas complementares e alteração de preço exigem revisão explícita; não se cria obrigação nem crédito por diferença.
