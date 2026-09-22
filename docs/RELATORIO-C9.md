# Relatório C9 — Crédito comercial de fornecedores

Data: 15/09/2026. Versão 0.18.0. Trabalho exclusivamente em SISTEMA/hvb-sistema-dev.

## Entrega

Crédito documentado com saldo próprio, aplicação parcial a obrigação do mesmo fornecedor/unidade, reversão encadeada e correção documental. Aplicação é a liquidação original com fonte crédito, podendo quitar parcelas C8 sem pagamento fictício ou segunda baixa. Crédito de devolução declarada não executa movimento físico.

Migrations 055–056: duas tabelas, duas views, duas permissões e seis operações novas. Totais conferidos: 170 tabelas, 61 views, 110 permissões e 342 operações em 206 caminhos. Nenhuma dependência nova.

Comparação com o contrato C8: cinco GETs alterados. liquidacoes e liquidacoes-para-parcelas acrescentam credito_id/filtro; pagamento_id passa a poder ser nulo na fonte crédito. Indicadores em rateios-custo, custos-recebimentos, planos-parcelas e liquidacoes-para-parcelas foram corrigidos de texto para booleanos. Nenhuma entrada antiga mudou, além da expansão do catálogo de permissões. Mudanças de leitura documentadas no ADR.

Seed db:seed:supplier-credit executado e repetido no DEV sintético: crédito 60, aplicação 40 à dívida e primeira parcela, crédito restante 20 e dívida 60. Consulta confirmou uma única aplicação e nenhum pagamento. Referências em .local/supplier-credit-demo.json, ignoradas pelo Git.

## Verificação pontual

**37 testes aprovados:** cinco unitários, dez de contas a pagar, dez de parcelas e doze de crédito. Evidência: [checks-c9-focused.json](evidencias/checks-c9-focused.json), comando pnpm check:supplier-credit.

Casos: declaração sem efeito financeiro/físico, aplicação com ID único e alocação em parcela, reversões, concorrência entre obrigações e entre pagamento/crédito, retry, duplicidade documental, centavos/datas/fonte única, RLS/permissões/unidade/fornecedor, correção com única sucessora e booleanos nas respostas de aquisição/parcelas.

TypeScript, lint, formatação, migrations nas bases locais existentes e OpenAPI aprovados. Testes por injeção Fastify e PostgreSQL real local. Suíte geral, instalação vazia, carga, CI, interface e homologação permanecem posteriores conforme acordado; pnpm check inclui o arquivo novo.

## Continuidade e publicação

Próximo recorte: conciliação de saídas de fornecedores, separando pagamento declarado de evidência bancária. Depois continuam prontuário e vínculos/auditoria. Três grupos ainda possuem complementos; núcleo inteiro não declarado concluído.

O usuário autorizou explicitamente publicar C8 e prosseguir. A preparação do commit voltou a ser rejeitada pela revisão automática por incompatibilidade interna do checkpoint com Guardian, antes de alterar o índice. A autorização está registrada; não houve contorno. C8 e C9 permanecem locais, sem commit/push, até a liberação técnica do mecanismo. Último commit publicado: 789ee1f26241be9e636ea0ad328d03a1cea6f04b (C7).

Pendências anteriores preservadas. Nenhuma alteração fora de SISTEMA, em outras branches, dados reais, SimplesVet/M7, Terminal físico, Vercel/Cloudflare, DNS ou infraestrutura paga. Ver [dicionário](DADOS-C9.md), [ADR](adr/0019-credito-fornecedor.md) e [cobertura](COBERTURA-NUCLEO.md).
