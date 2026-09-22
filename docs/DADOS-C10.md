# Dicionário C10 — Conciliação de saídas

Migrations 057–058, versão 0.19.0. Três tabelas, três views e duas permissões novas. Totais DEV: 173 tabelas, 64 views, 112 permissões.

Tabelas novas registram organização, unidade, autor, comando, motivo e criação, com RLS, FKs e imutabilidade.

| Entidade | Conteúdo e invariantes |
|---|---|
| saida_extrato_fornecedor | Conta, referência, identificador externo, data, valor e evidência; correção opcional após reversão e única sucessora |
| conciliacao_saida_fornecedor | Pagamento original, saída, valor e evidência; mesmas conta/unidade, com limites dos dois lados |
| reversao_saida_fornecedor | Exatamente um alvo: saída ou conciliação; uma reversão por alvo |
| conciliacao_saida_fornecedor_consulta | Fornecedor/conta e ativo; inativa por reversão própria, do pagamento ou da saída |
| saida_extrato_fornecedor_consulta | Revertido e valor nao_conciliado |
| pagamento_conciliacao_consulta | Pagamento C4, disponível para liquidar dívida e valor nao_conciliado, com semânticas distintas |

## Contratos /v1

| Método | Caminho | Permissão |
|---|---|---|
| POST | /a-pagar/saidas-extrato | pagar:extrato_saida |
| POST | /a-pagar/conciliacoes-saidas | pagar:conciliar_saida |
| POST | /a-pagar/reversoes-saidas | pagar:reverter |
| GET | /a-pagar/saidas-extrato | pagar:ler |
| GET | /a-pagar/conciliacoes-saidas | pagar:ler |
| GET | /a-pagar/reversoes-saidas | pagar:ler |
| GET | /a-pagar/pagamentos-conciliacao | pagar:ler |

POST usa unidade, motivo, simulacao=true, confirmacao_humana=true e chave idempotente. Saída informa conta_financeira_id, referencia, referencia_externa, ocorrido_em, valor e evidencia; correcao_de_id é opcional. Conciliação informa pagamento_id, saida_id, valor e evidencia. Reversão informa apenas saida_id ou conciliacao_id.

GET exige unidade e paginação UUID. Filtros dependem das colunas: conta_financeira_id, fornecedor_id, pagamento_id, saida_id, conciliacao_id e correcao_de_id. Valores são textos decimais exatos. Consultas preservam registros revertidos; não usar o residual sem considerar vigência.

Ver [OpenAPI](../openapi/hvb-sistema.json) e [ADR](adr/0020-conciliacao-saidas.md).
