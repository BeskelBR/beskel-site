# Relatório C10 — Conciliação de saídas de fornecedores

Data: 15/09/2026. Versão 0.19.0. Trabalho exclusivamente em SISTEMA/hvb-sistema-dev.

## Entrega

Saída de extrato declarada, conciliação parcial de pagamentos, agrupamento/fracionamento, saldos residuais, reversões e correção documental. Crédito comercial não é conciliado como débito. Conciliar não liquida dívida e não altera pagamento ou estoque. Reversão do pagamento inativa o vínculo e mantém a saída para revisão, sem presumir estorno bancário.

Migrations 057–058: três tabelas, três views, duas permissões e sete operações novas. Totais conferidos: 173 tabelas, 64 views, 112 permissões e 349 operações em 210 caminhos. Nenhuma dependência nova. Contratos anteriores preservados na comparação com C9, exceto expansão do catálogo de permissões.

Seed db:seed:supplier-outflow executado e repetido: pagamento 60, saída 100, vínculo 60, extrato residual 40 e dívida 100. Consulta confirmou um vínculo, disponível do pagamento 60 e nenhum efeito de liquidação inferido. Referências em .local/supplier-outflow-demo.json, ignoradas pelo Git. Dados fictícios e nenhuma operação bancária.

## Verificação pontual

**26 testes aprovados:** cinco unitários, dez de contas a pagar e onze de conciliação de saídas. Evidência: [checks-c10-focused.json](evidencias/checks-c10-focused.json), comando pnpm check:supplier-outflow.

Casos: separação entre conciliar/liquidar, múltiplos pagamentos/saídas, retry/duplicidade, concorrência nos dois saldos, reversão de vínculo/saída/pagamento, correção com uma sucessora, conta/unidade/RLS/permissões/consultas/histórico, centavos/data/alvo único, exclusão de crédito comercial e estorno concorrente.

TypeScript, lint, formatação, migrations nas bases locais existentes e OpenAPI aprovados. Executado um recorte completo, sem repetição da suíte geral. Testes por injeção Fastify e PostgreSQL local real. Carga, instalação vazia, CI, interfaces e homologação continuam posteriores; pnpm check inclui os testes novos.

## Continuidade organizada

Concluída a base técnica planejada do grupo financeiro de fornecedores: obrigação, pagamento declarado, liquidação, parcelas, crédito e conciliação de saídas. Faltam dois grupos de complementos do core: prontuário e vínculos/auditoria. O próximo bloco reúne modelos, anexos, busca e coautoria de prontuário conforme a matriz, sem assinatura válida presumida. O número de grupos não promete número de execuções.

O usuário determinou concluir o ciclo básico antes de resolver pendências e bloqueios para reduzir consumo de cota. Por isso não houve nova tentativa de Git/publicação neste recorte. C8–C10 permanecem locais; último commit publicado C7, 789ee1f26241be9e636ea0ad328d03a1cea6f04b. Bloqueio da revisão automática e autorização anterior de publicação permanecem registrados para retomada posterior.

Nenhuma alteração fora de SISTEMA ou nas demais branches, acesso a dados reais/SimplesVet/M7, Terminal físico, Vercel/Cloudflare, DNS ou infraestrutura paga. Ver [dicionário](DADOS-C10.md), [ADR](adr/0020-conciliacao-saidas.md) e [roteiro](NUCLEO-FUNCIONAL.md).
