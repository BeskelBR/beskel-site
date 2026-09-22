# Relatório C8 — Plano de parcelas de fornecedores

Data: 15/09/2026. Versão 0.17.0. Trabalho exclusivamente em SISTEMA/hvb-sistema-dev.

## Entrega

Plano integral versionado para obrigação de compra/despesa, datas explícitas, alocação parcial de liquidações existentes e reversões. Reprogramação preserva histórico; valores ainda sem parcela ficam visíveis. Não há dívida duplicada, pagamento adicional ou vencimento calculado por inferência.

Migrations 053–054: quatro tabelas, quatro views, duas permissões e oito operações novas. Totais conferidos: 168 tabelas, 59 views, 108 permissões e 336 operações em 203 caminhos. Nenhuma dependência nova. Contratos anteriores comparados ao OpenAPI anterior: preservados, exceto expansão do catálogo de permissões.

Seed db:seed:installments executado, repetido e consultado no DEV sintético. Obrigação 100; parcelas 40/60; pagamento/liquidação declarados 60; alocações 40/20; saldos de parcelas 0/40 e dívida 40. Exatamente duas alocações e nada liquidado sem parcela. Referências em .local/installments-demo.json, ignoradas pelo Git. Nenhum pagamento real.

## Verificação pontual

**25 testes aprovados:** cinco unitários, dez de contas a pagar e dez de parcelas. Evidência: [checks-c8-focused.json](evidencias/checks-c8-focused.json), comando pnpm check:installments.

Casos: integridade integral do plano, zero/centavos/datas inválidos, rollback, liquidação anterior à versão do plano, alocação sem segunda baixa, retry e concorrência, limites dos dois lados, reprogramação, reversão/correção documental, permissões/RLS/listas/imutabilidade, estorno concorrente e parcelamento de despesa com vencimentos iguais explícitos.

TypeScript, lint sem avisos, formatação, migrations nas bases locais existentes e OpenAPI aprovados. Testes via Fastify por injeção e PostgreSQL real local. Suíte geral, instalação vazia, carga, CI, socket separado, interface e homologação permanecem posteriores conforme acordado. Evidências históricas preservadas; pnpm check inclui os testes novos.

## Continuidade

O grupo financeiro de fornecedores continua em andamento: plano de parcelas entregue; próximos crédito comercial e conciliação de saídas. Depois seguem complementos de prontuário e vínculos/auditoria. Permanecem três grupos com faltas funcionais, sem equivalência a três execuções garantidas.

Pendências anteriores preservadas; política financeira, vencimento operacional, alçadas e ergonomia de reprogramação acrescentadas ao registro. Nenhuma alteração fora de SISTEMA, nas demais branches, em dados reais, SimplesVet/M7, Terminal físico, Vercel/Cloudflare, DNS ou infraestrutura paga.

Ver [dicionário](DADOS-C8.md), [ADR](adr/0018-parcelas-fornecedores.md) e [cobertura](COBERTURA-NUCLEO.md).

## Histórico de aprovação

Duas tentativas anteriores de preparar o commit foram bloqueadas por incompatibilidade interna da revisão automática, sem alteração do índice ou contorno. O usuário autorizou explicitamente a retomada do commit e da publicação. Os 22 arquivos do lote, o escopo SISTEMA/hvb-sistema-dev, as migrations e a ausência de segredos foram conferidos.


Após a autorização explícita, a nova tentativa de git add voltou a ser bloqueada pelo mesmo erro interno da revisão automática. C8 continua local sem commit/push; a implementação autorizada prosseguiu para C9. Ver RELATORIO-C9.md.
