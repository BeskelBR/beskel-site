# Dicionário C7 — Custo de aquisição

Migrations 051–052, versão 0.16.0. Quatro tabelas, três views e duas permissões novas. Totais conferidos no DEV: 164 tabelas, 55 views, 106 permissões.

Todas as tabelas novas têm id, organizacao_id, unidade_id, autor_id, comando_id, motivo e criada_em, com RLS, FKs e imutabilidade.

| Entidade | Conteúdo e invariantes |
|---|---|
| rateio_aquisicao | Pedido, precificação, versão, anterior e critério explícito. Versão esperada, preço atual ao criar e nenhuma avaliação anterior ativa |
| item_rateio_aquisicao | Rateio, item original, subtotal, frete/acréscimo/desconto e total calculado. Uma linha por item e componentes integralmente distribuídos |
| custo_recebimento | Item de rateio, ID original da entrada recebida e valor. Uma avaliação ativa por entrada, com limites de valor/quantidade |
| reversao_custo_recebimento | Uma reversão por avaliação; preserva fato e libera capacidade |
| rateio_aquisicao_consulta | Total da precificação, atual do rateio e preco_atual; estes dois indicadores podem divergir |
| item_rateio_aquisicao_consulta | Quantidade pedida, avaliada e pendente; valor atribuído e saldo a atribuir. Agrega avaliações ativas |
| custo_recebimento_consulta | IDs de rateio/pedido/item/recebimento/posição, quantidades originais, recebimento_revertido e ativo |

O valor total e quantidade_base são o numerador e denominador do custo por unidade base; o servidor não grava um quociente arredondado. Quantidade pendente não significa estoque disponível. Ver [ADR](adr/0017-custo-aquisicao.md).

## Contratos /v1

| Método | Caminho | Permissão |
|---|---|---|
| POST | /compras/rateios-custo | compras:ratear_custo |
| POST | /compras/custos-recebimentos | compras:avaliar_custo |
| POST | /compras/reversoes-custos | compras:avaliar_custo |
| GET | /compras/rateios-custo | compras:ler |
| GET | /compras/rateios-custo-itens | compras:ler |
| GET | /compras/custos-recebimentos | compras:ler |
| GET | /compras/reversoes-custos | compras:ler |

POST exige unidade, motivo, simulacao=true, confirmacao_humana=true e chave idempotente. Rateio informa pedido, precificação, versao_esperada (0 na primeira), critério e todos os itens com seus componentes. A avaliação informa item_rateio_id, recebimento_item_id e valor como texto decimal. Reversão informa custo_recebimento_id.

GET exige unidade; filtros dependem das colunas disponíveis: pedido_id, precificacao_id, rateio_id, item_rateio_id, item_pedido_id, recebimento_id, recebimento_item_id, posicao_id e custo_recebimento_id, conforme [OpenAPI](../openapi/hvb-sistema.json). Paginação UUID preserva o contrato existente.
