# Dicionário C6 — Preços e conciliação de compras

Migrations 049–050, versão 0.15.0. Quatro tabelas e três views novas; total conferido no DEV: 160 tabelas, 52 views, 104 permissões. Todas as tabelas novas registram UUID, organização, unidade, autor, comando, motivo e criação; RLS e imutabilidade obrigatórias.

| Entidade | Conteúdo e invariantes |
|---|---|
| precificacao_compra | Pedido, versão, anterior, frete/acréscimo/desconto/total. Uma sucessora e todos os itens no mesmo comando; total exato e não inferior aos vínculos ativos |
| preco_item_compra | Versão do preço, item original, preço por apresentação e subtotal. Um registro por item, com quantidade original e centavos exatos |
| vinculo_valor_compra | Versão exata, obrigação e valor positivo; mesmos pedido/fornecedor/unidade e limites dos dois lados |
| reversao_vinculo_compra | Um evento por vínculo; preserva histórico e libera capacidade sem desfazer obrigação |
| vinculo_valor_compra_consulta | Acrescenta pedido e ativo; inativo por reversão própria ou da obrigação |
| precificacao_compra_consulta | Acrescenta atual, vinculado_pedido agregado entre versões e saldo_vincular. Apenas a atual define orçamento disponível |
| obrigacao_valor_compra_consulta | Valor declarado, pedido, fornecedor, revertido e nao_vinculado; não representa saldo financeiro a pagar |

## Contratos /v1

| Método | Caminho | Permissão |
|---|---|---|
| POST | /compras/precificacoes | compras:precificar |
| POST | /compras/vinculos-valores | compras:conciliar_valores + pagar:ler |
| POST | /compras/reversoes-valores | compras:conciliar_valores + pagar:ler |
| GET | /compras/precificacoes | compras:ler |
| GET | /compras/precos-itens | compras:ler |
| GET | /compras/vinculos-valores | pagar:ler |
| GET | /compras/reversoes-valores | pagar:ler |
| GET | /a-pagar/conciliacao-compras | pagar:ler |

POST exige unidade, motivo, simulacao=true, confirmacao_humana=true e chave idempotente. Precificação informa versao_esperada (0 na primeira), componentes e todos os itens; total é calculado. GET exige unidade e aceita paginação; filtros dependem das colunas disponíveis, conforme [OpenAPI](../openapi/hvb-sistema.json). Dinheiro é texto decimal.

Ver [ADR 0016](adr/0016-precos-conciliacao-compras.md) para saldos históricos, cancelamento, reversões e limites fiscais/contábeis.
