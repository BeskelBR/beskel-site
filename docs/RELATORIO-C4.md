# Relatório C4 — Financeiro de aquisição e despesas

Data: 15/09/2026. Versão 0.13.0. Alterações somente em SISTEMA/hvb-sistema-dev.

## Entrega

Obrigações identificadas de fornecedores, pagamentos declarados, liquidações parciais e reversões encadeadas, com valores explícitos. Compra se vincula ao pedido correto; despesa pode existir sem pedido. Recebimento físico e financeiro permanecem independentes. Correção documental preserva origem e versão anterior, exigindo reversão antes de uma única sucessora.

Migrations 044–046, quatro tabelas, três views, cinco permissões e oito operações novas. Totais confirmados: 152 tabelas, 47 views, 99 permissões e 304 operações em 184 caminhos. Sem dependências novas. O seed db:seed:payables, executado no DEV sintético, demonstra obrigação de 100, pagamento declarado de 60, liquidação de 60 e saldo a pagar de 40. Referências em .local/payables-demo.json, ignoradas pelo Git. Nenhum pagamento bancário ou entrada física foi realizado pelo seed C4.

## Verificação pontual

**24 testes aprovados**: cinco unitários, nove de compras e dez de contas a pagar. Evidência: [checks-c4-focused.json](evidencias/checks-c4-focused.json), comando pnpm check:payables.

Cobertura: separação estoque/dívida/pagamento, deduplicação de documento/referência/retry, concorrência e teto dos dois saldos, liquidação parcial, reversão encadeada, fornecedor/pedido/unidade/organização divergentes, valores/datas/confirmacões inválidos, permissão de leitura/escrita, listas, RLS, SQL imutável e comando concluído. A correção concorrente admite apenas uma sucessora e preserva o valor original.

TypeScript, lint, formatação, migrations nas bases locais existentes e OpenAPI aprovados. Não foram executados suíte geral, instalação vazia, benchmark, HTTP por socket separado ou CI. Testes usam injeção Fastify com PostgreSQL real local. Evidências anteriores foram preservadas, e pnpm check inclui os testes novos quando a verificação geral for retomada.

## Continuidade

C4 fecha o recorte de obrigação/pagamento/liquidação, sem declarar completo todo o financeiro de aquisição. Preços negociados por item, fiscal, custos/rateios, parcelas, crédito do fornecedor e conciliação de saídas bancárias continuam explícitos na matriz e nas pendências. Pagamento aqui é fato declarado em simulação; reversão não devolve dinheiro automaticamente.

Próximo recorte: C5, contrato e fluxo de terminal simulado dentro de SISTEMA. Não editar a pasta/branch Terminal. Pendências humanas e verificação geral continuam posteriores, conforme orientação do usuário. Sem dados reais, SimplesVet/M7, mensagens externas, deploy, DNS ou infraestrutura paga.

Ver [dicionário](DADOS-C4.md), [ADR](adr/0014-contas-pagar.md), [matriz](COBERTURA-NUCLEO.md) e [pendências](PENDENCIAS-HVB.md).
