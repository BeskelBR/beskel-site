# Relatório C7 — Composição do custo de aquisição

Data: 15/09/2026. Versão 0.16.0. Trabalho exclusivamente em SISTEMA/hvb-sistema-dev.

## Entrega

Rateio versionado dos componentes comerciais por item e avaliação explícita do custo dos recebimentos originais. Valores/quantidades parciais não excedem o pedido; a última quantidade avaliada fecha o saldo do item. Correção exige reversão e preserva histórico. Alteração posterior do preço é sinalizada, sem recálculo automático. Entrada fisicamente revertida deixa de compor o custo analítico ativo.

Migrations 051–052: quatro tabelas, três views, duas permissões e sete operações novas. Totais conferidos: 164 tabelas, 55 views, 106 permissões e 328 operações em 198 caminhos. Sem dependências novas. Contratos anteriores comparados ao OpenAPI anterior: preservados, exceto expansão do catálogo de permissões.

Seed db:seed:acquisition executado e repetido no DEV sintético: rateio 105, recebimentos de duas e três caixas (50 unidades no total), custos explícitos 42 e 63. Custo físico original de 1,25 mantido. Referências em .local/acquisition-demo.json, ignoradas pelo Git. Há movimentos fictícios de preparo/recebimento; nenhuma operação externa.

## Verificação pontual

**32 testes aprovados:** cinco unitários, nove de compras/recebimentos, oito de preços/conciliação e dez de custo de aquisição. Evidência: [checks-c7-focused.json](evidencias/checks-c7-focused.json), comando pnpm check:acquisition.

Casos novos: fechamento de recebimentos parciais, preservação do custo físico/dívida, componentes divergentes e rollback, distribuição entre múltiplos itens, retry, concorrência de avaliações, fechamento exato, sucessão do rateio após reversões, entrada substituta, preço posterior, RLS/permissões/listas/histórico e avaliação concorrente com reversão física.

TypeScript, lint, formatação, migrations nas bases locais existentes e OpenAPI aprovados. Testes via Fastify por injeção e PostgreSQL real local. Suíte geral, instalação vazia, carga, CI, HTTP por socket, interface e homologação permanecem posteriores conforme acordado. Evidências anteriores preservadas; pnpm check inclui o novo arquivo.

## Continuidade

A base técnica de compras/custos agora cobre pedido, recebimento, preço, conciliação de valores, rateio explícito e custo analítico por recebimento. Método contábil real, tributação e aprovação hospitalar continuam pendências; custo analítico não substitui automaticamente snapshots físicos.

Próximo grupo: complementos financeiros de fornecedores, começando pelo plano de parcelas, seguido de crédito comercial e conciliação de saídas. Depois seguem complementos de prontuário e vínculos/auditoria já listados na matriz. Esses três grupos funcionais ainda não equivalem a três execuções garantidas; o core inteiro não está declarado concluído.

Pendências anteriores preservadas e novas limitações acrescentadas. Nenhuma alteração fora de SISTEMA, nas demais branches, em dados reais, SimplesVet/M7, Terminal físico, Vercel/Cloudflare, DNS ou infraestrutura paga. Ver [dicionário](DADOS-C7.md), [ADR](adr/0017-custo-aquisicao.md) e [cobertura](COBERTURA-NUCLEO.md).
