# Relatório C16 — Correção de diárias

17/09/2026. Versão 0.25.0. Etapa finalizada localmente em SISTEMA/hvb-sistema-dev. Escopo e dependências: [auditoria C16](IMPACTO-C16-CORRECAO-DIARIAS.md).

Entregues cancelamento e correção de associação de pacote e período por novos fatos, preservando origem, autoria e cadeia de sucessoras. Reservas, avaliações de cobertura e documentos financeiros ativos exigem suas compensações explícitas antes da revisão. Associação exige tratar os períodos vigentes. Nenhum valor, dívida ou saldo físico é recalculado automaticamente.

Migrations 069–070 acrescentam duas tabelas, uma view, funções de vigência, guardas e uma permissão. A exclusão histórica de intervalos foi substituída por verificação dos vigentes sob trava do episódio, também protegida em SQL direto. Totais: **196 tabelas, 73 views, 128 permissões, 408 operações em 251 caminhos**. Quatro POST e dois GET novos; listas de associação/período expõem revisão, sucessora e situação. Nenhuma operação removida. Os 70 hashes coincidem nos ledgers DEV/TEST; migrations históricas preservadas. [Evidência de integridade](evidencias/c16-integridade.json).

## Validação

**68 testes aprovados:** cinco unitários e 63 integrados — 15 novos, 17 de diárias, 19 financeiros e 12 de correção clínica. Comando: `pnpm check:daily-corrections`. [Evidência do recorte](evidencias/checks-c16-focused.json). Suíte geral não executada.

Cobertos histórico imutável, cadeia, cancelamento sem sucessora, rollback, retry concorrente, decisões incompatíveis, RLS/RBAC, outro episódio, confirmação literal, limites/classificação e consultas. Disputas exercitadas: correção/cancelamento, criação de intervalo por API e SQL, cancelamento/reserva, associação/período e cancelamento/documentação financeira. Cobertura revertida exige reavaliação explícita; documento financeiro de valor zero também exige reversão.

TypeScript, lint, formatação, migrations e OpenAPI passaram. O recorte trouxe duas sugestões informativas de estilo, uma preexistente no teste C11 e outra no novo seed; esta última foi corrigida, com nova conferência TypeScript/lint, sem repetir a suíte aprovada. Seed executado duas vezes com as mesmas chaves: exatamente duas revisões de período e duas de associação, saldo físico 20, sem duplicação. Referências privadas em `.local/daily-corrections-demo.json`.

## Continuidade

A parte resolvida da pendência M4 foi retirada da descrição ativa e arquivada em [PENDENCIAS-RESOLVIDAS-C16.md](PENDENCIAS-RESOLVIDAS-C16.md). Correção de classificação, restauração, migração em lote, regularização comercial após cancelamento e decisões hospitalares permanecem específicas em [PENDENCIAS-HVB.md](PENDENCIAS-HVB.md). Próxima frente do inventário: correção de depósito/extrato e reabertura de conciliação do financeiro do cliente.

C8–C16 continuam locais; último commit publicado C7, `789ee1f26241be9e636ea0ad328d03a1cea6f04b`. Git não foi acionado para escrita. [Revisão final](evidencias/c16-revisao-final.json). Publicação, instalação vazia, carga, homologação e verificação geral permanecem adiadas. Terminal, demais pastas/branches, serviços externos, infraestrutura paga e dados reais não foram alterados.
