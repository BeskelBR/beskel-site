# Dicionário C1 — Compras e recebimento físico

Migrations 039–040. Seis tabelas e três views novas; total de 146 tabelas, 43 views e 90 permissões. Todas as tabelas novas preservam organização, unidade, autor, comando, motivo e instante de registro, com RLS forçada por organização e FKs tipadas.

| Entidade | Conteúdo |
|---|---|
| `fornecedor_compra` | Nome e referência única por organização/unidade |
| `pedido_compra` | Fornecedor, referência e observação; exige itens atômicos |
| `item_pedido_compra` | Apresentação exata, quantidade de apresentações e pedido |
| `decisao_pedido_compra` | Sequência e decisão aprovado/cancelado, sem apagar estado anterior |
| `recebimento_compra` | Pedido, referência, documento fornecedor declarado e instante ocorrido |
| `recebimento_compra_item` | Mesmo ID da transação de estoque, item do pedido e cabeçalho do recebimento |
| `pedido_compra_consulta` | Pedido com situação derivada da última decisão |
| `recebimento_compra_item_consulta` | Quantidades, posição, fator/custo do movimento e flag de reversão |
| `item_pedido_compra_consulta` | Quantidade pedida e recebida ativa, sem contar entradas revertidas |

API sob `/v1/compras`: quatro POST (`fornecedores`, `pedidos`, `decisoes`, `recebimentos`) e seis GET (os mesmos caminhos, mais `itens` e `recebimentos-itens`). Total acumulado: 290 operações em 176 caminhos. Listas paginadas por UUID, até cem registros, com filtros tipados por pedido, fornecedor, apresentação e recebimento conforme a entidade.

Permissões: `compras:ler`, `compras:configurar`, `compras:solicitar`, `compras:decidir`, `compras:receber`. Receber também exige `estoque:movimentar`. Escritas exigem confirmação humana, `simulacao=true` e chave de idempotência. Quantidades são strings decimais de até seis casas, calculadas pelo mecanismo exato M2.

O ID da linha recebida pode ser usado na reversão existente `/v1/estoque/transacoes/:id/reverter`, respeitando suas permissões e regras de saldo. Ver [ADR 0012](adr/0012-compras-recebimento.md).
