# Dicionário C8 — Plano de parcelas de fornecedor

Migrations 053–054, versão 0.17.0. Quatro tabelas, quatro views e duas permissões novas. Totais DEV: 168 tabelas, 59 views e 108 permissões.

Todas as tabelas novas registram UUID, organização, unidade, autor, comando, motivo e criação. RLS, FKs e imutabilidade preservam histórico.

| Entidade | Conteúdo e invariantes |
|---|---|
| plano_parcelas_fornecedor | Obrigação, versão e anterior. Uma sucessora; obrigação vigente e nenhuma alocação anterior ativa ao reprogramar |
| parcela_fornecedor | Plano, número, vencimento e valor positivo. Sequência 1..N, até 120, soma integral e datas não decrescentes |
| alocacao_parcela_fornecedor | Parcela, liquidação original e valor positivo. Mesma obrigação e limites dos dois lados |
| reversao_alocacao_parcela | Uma reversão por alocação; não reverte liquidação ou pagamento |
| plano_parcelas_fornecedor_consulta | Fornecedor, valor/saldo da obrigação, atual, obrigacao_revertida e liquidado_sem_parcela |
| parcela_fornecedor_consulta | Obrigação/fornecedor, vigente, valor alocado e saldo |
| alocacao_parcela_fornecedor_consulta | Plano/obrigação e ativo; inativa por reversão própria ou da liquidação |
| liquidacao_parcela_consulta | Liquidação original, revertida e nao_alocado; não cria liquidação adicional |

## Contratos /v1

| Método | Caminho | Permissão |
|---|---|---|
| POST | /a-pagar/planos-parcelas | pagar:parcelar |
| POST | /a-pagar/alocacoes-parcelas | pagar:alocar_parcela |
| POST | /a-pagar/reversoes-parcelas | pagar:alocar_parcela |
| GET | /a-pagar/planos-parcelas | pagar:ler |
| GET | /a-pagar/parcelas | pagar:ler |
| GET | /a-pagar/alocacoes-parcelas | pagar:ler |
| GET | /a-pagar/reversoes-parcelas | pagar:ler |
| GET | /a-pagar/liquidacoes-para-parcelas | pagar:ler |

POST exige unidade, motivo, simulacao=true, confirmacao_humana=true e chave idempotente. Plano informa obrigacao_id, versao_esperada (0 na primeira) e parcelas com data/valor; a numeração é gerada pela ordem do array. Alocação informa parcela_id, liquidacao_id e valor. Reversão informa alocacao_id.

GET exige unidade e aceita paginação UUID; filtros disponíveis conforme colunas: obrigacao_id, fornecedor_id, plano_id, parcela_id, liquidacao_id, pagamento_id e alocacao_id. Datas são datas civis explícitas, valores são textos decimais. Ver [OpenAPI](../openapi/hvb-sistema.json) e [ADR](adr/0018-parcelas-fornecedores.md) para interpretação de saldos e histórico.
