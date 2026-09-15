# Dicionário C4 — Contas a pagar

Migrations 044–046, quatro tabelas e três views novas. Totais: 152 tabelas, 47 views, 99 permissões e 46 migrations. Organização/unidade, autor, comando, motivo e data de registro preservados em todos os fatos novos.

| Entidade | Conteúdo |
|---|---|
| obrigacao_fornecedor | Documento/origem, fornecedor, pedido opcional, datas, valor e correção anterior |
| pagamento_fornecedor | Pagamento declarado, fornecedor, conta financeira, evidência, referência e valor |
| liquidacao_fornecedor | Vínculo obrigação/pagamento, instante e valor aplicado |
| reversao_fornecedor | Um único alvo revertido, sem apagar histórico |
| liquidacao_fornecedor_ativa | Liquidações sem reversão |
| obrigacao_fornecedor_consulta | Obrigação, saldo, reversão, correção anterior e revisão por pedido cancelado |
| pagamento_fornecedor_consulta | Pagamento, valor disponível e reversão |

Quatro pares POST/GET sob /v1/a-pagar: obrigacoes, pagamentos, liquidacoes e reversoes. Oito operações novas; total de 304 operações em 184 caminhos. Leitura exige pagar:ler. POST exige respectivamente pagar:registrar, pagar:pagar, pagar:liquidar e pagar:reverter, além de unidade_id, motivo, simulacao=true, confirmacao_humana=true e Idempotency-Key.

Quantias são strings decimais positivas, até duas casas e abaixo de 100 trilhões. Números JSON e precisão excedente são rejeitados. Pagamentos e liquidações não futuros; adiantamento é permitido e permanece não alocado até existir obrigação e decisão explícita.

Listas mantêm paginação UUID (limit padrão 25, máximo 100), unidade obrigatória e filtros presentes na entidade: fornecedor_id, pedido_id, conta_financeira_id, obrigacao_id, pagamento_id, liquidacao_id e correcao_de_id. Saldo/disponível usam duas casas. Revertido é booleano e deve acompanhar a interpretação do saldo. A lista de liquidações preserva todas; a lista de reversões identifica as que deixaram de produzir efeito.

Correção usa POST obrigacoes com correcao_de_id e nova referencia, mesma origem/pedido/fornecedor/documento, após reversão explícita da anterior. Cada antecedente admite somente um sucessor. Vencimento e valor podem ser retificados sem apagar o original.

Decisões e limites em [ADR 0014](adr/0014-contas-pagar.md).
