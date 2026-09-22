# Dicionário C9 — Crédito comercial de fornecedor

Migrations 055–056, versão 0.18.0. Duas tabelas, duas views e duas permissões novas. Totais conferidos DEV: 170 tabelas, 61 views, 110 permissões.

| Entidade | Conteúdo e invariantes |
|---|---|
| credito_fornecedor | Fornecedor, origem/documento/referência, obrigação de origem opcional, correção anterior opcional, data, descrição e valor positivo. Uma sucessora após reversão e documento original único |
| reversao_credito_fornecedor | Uma reversão por crédito; exige aplicações previamente revertidas |
| liquidacao_fornecedor | Ampliada: exatamente uma fonte entre pagamento_id e credito_id. Mesmo ID para aplicação e alocação em parcela; nenhuma duplicação da baixa |
| credito_fornecedor_consulta | Registro original, revertido e disponivel após aplicações ativas |
| aplicacao_credito_fornecedor_consulta | Liquidação por crédito, fornecedor e revertido; leitura do fato original |
| liquidacao_fornecedor_ativa | Ampliada com credito_id; mantém regra de reversão C4 |
| liquidacao_parcela_consulta | Acrescenta credito_id, preservando cálculo do valor sem parcela |

Tabelas novas têm organização, unidade, autor, comando, motivo e criação, com RLS, FKs e imutabilidade. A aplicação compartilha o mecanismo de liquidação, saldo da obrigação e alocação de parcelas.

## Contratos /v1

| Método | Caminho | Permissão |
|---|---|---|
| POST | /a-pagar/creditos | pagar:creditar |
| POST | /a-pagar/aplicacoes-creditos | pagar:aplicar_credito |
| POST | /a-pagar/reversoes-creditos | pagar:reverter |
| GET | /a-pagar/creditos | pagar:ler |
| GET | /a-pagar/aplicacoes-creditos | pagar:ler |
| GET | /a-pagar/reversoes-creditos | pagar:ler |

POST usa unidade, motivo, simulacao=true, confirmacao_humana=true e chave idempotente. Crédito informa fornecedor, origem, referência, documento, descrição, data e valor; origem_obrigacao_id e correcao_de_id são opcionais. Aplicação informa obrigacao_id, credito_id, liquidada_em e valor. Reversão de crédito informa credito_id; para reverter aplicação usar POST /a-pagar/reversoes com liquidacao_id original.

Listas exigem unidade e paginação UUID; filtros conforme colunas incluem fornecedor_id, credito_id, obrigacao_id, origem_obrigacao_id e correcao_de_id. GET liquidacoes e liquidacoes-para-parcelas acrescentam credito_id; pagamento_id é nulo quando a fonte é crédito.

Indicadores preco_atual, recebimento_revertido, obrigacao_revertida e revertida foram corrigidos para booleanos nas consultas existentes. Ver [OpenAPI](../openapi/hvb-sistema.json) e [ADR](adr/0019-credito-fornecedor.md) para migração dos clientes e limites.
