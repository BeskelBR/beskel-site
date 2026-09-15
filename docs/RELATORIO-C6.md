# Relatório C6 — Preços negociados e conciliação explícita

Data: 15/09/2026. Versão 0.15.0. Trabalho exclusivamente em SISTEMA/hvb-sistema-dev.

## Entrega

Precificação completa e versionada por item, componentes comerciais explícitos e vínculo parcial/reversível com obrigações C4. A obrigação mantém seu valor declarado. Vínculos conservam a versão de origem, respeitam orçamento agregado entre versões e ficam inativos quando a obrigação é revertida. Estoque, custo físico, pagamentos e liquidações permanecem ações separadas.

Migrations 049–050: quatro tabelas, três views, duas permissões e oito operações novas. Totais conferidos: 160 tabelas, 52 views, 104 permissões e 321 operações em 194 caminhos. Nenhuma dependência nova. Contratos anteriores comparados ao OpenAPI anterior: preservados, exceto expansão do catálogo de permissões.

Seed db:seed:pricing executado e repetido no DEV sintético: preço total 105, obrigação 100, vínculo 100 e saldo comercial 5; sem duplicação por retry. Referências em .local/pricing-demo.json, ignoradas no Git. O preparo reutiliza cadastros/cenários fictícios; precificação e conciliação não alteram custo, saldo físico ou pagamentos.

## Verificação pontual

**23 testes aprovados:** cinco unitários, dez de contas a pagar e oito de preços/conciliação. Evidência: [checks-c6-focused.json](evidencias/checks-c6-focused.json), recorte pnpm check:pricing.

Casos: total e componentes exatos, todos os itens uma vez, rollback, rejeição de arredondamento e desconto excessivo, versões concorrentes, retry, limites de orçamento/obrigação, vínculos entre versões, reversões, unidade/RLS/permissões, listas e proteção do histórico/comando concluído. TypeScript, lint, formatação, migrations nas bases locais existentes e OpenAPI aprovados.

Testes usam Fastify por injeção e PostgreSQL real local. Suíte geral, carga, instalação vazia, CI, HTTP por socket e homologação não foram executados neste bloco, conforme sequência acordada. Evidências históricas preservadas; pnpm check inclui o novo arquivo de testes.

## Continuidade

C6 fecha preços negociados e vínculo de valores, mas não encerra o grupo de compras/custos: rateio de aquisição por item/recebimento ainda falta. Próximo recorte: composição explícita desse custo, preservando custo histórico e sem presumir tratamento fiscal. Complementos financeiros de fornecedores, prontuário e vínculos/auditoria também continuam na matriz; os quatro grupos estimados não equivalem a quatro execuções nem a módulos inteiramente ausentes.

Pendências anteriores preservadas e novas limitações registradas. Nenhuma alteração fora de SISTEMA, nas demais branches, em dados reais, SimplesVet/M7, Terminal físico, Vercel/Cloudflare, DNS ou infraestrutura paga.

Ver [dicionário](DADOS-C6.md), [ADR](adr/0016-precos-conciliacao-compras.md) e [matriz](COBERTURA-NUCLEO.md).
