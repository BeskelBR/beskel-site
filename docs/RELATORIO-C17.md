# Relatório C17 — Correções do financeiro do cliente

Concluído em 22/09/2026, versão 0.26.0. Trabalho somente em SISTEMA/hvb-sistema-dev. A etapa fecha antes do delta intermediário solicitado pelo usuário; nenhum módulo seguinte foi iniciado.

Depósitos e linhas de extrato admitem correção com sucessora ou cancelamento, preservando valores, identidade histórica, comando e autor. Dependências ativas exigem reversão explícita. Conciliações e alocações revertidas podem ser refeitas pelo último vínculo do mesmo par, com valor/evidência novos e limites revalidados. Não há movimentação bancária ou nova quitação do cliente.

Migrations 071–072: duas tabelas de revisão, duas views novas, duas projeções atualizadas, anterior_id nos vínculos e guardas transacionais de identidade/reabertura. Totais: **198 tabelas, 75 views, 128 permissões, 416 operações em 259 caminhos**. Seis POST e dois GET novos, cinco GET ampliados; nenhuma operação removida. Todos os 72 hashes coincidem nos bancos DEV/TEST; 001–052 também coincidem com o último commit. [Integridade](evidencias/c17-integridade.json). Contratos e decisão: [DADOS-C17](DADOS-C17.md) e [ADR 0027](adr/0027-correcao-financeiro-cliente.md).

## Validação

**56 testes aprovados:** cinco unitários e 51 integrados — 17 específicos, 19 financeiros e 15 de correção de diárias. `pnpm check:financial-corrections`. [Evidência](evidencias/checks-c17-focused.json). TypeScript, lint, formatação, migrations e OpenAPI passaram. Apenas a informação de estilo preexistente no teste C11 permanece. Suíte geral, instalação vazia e carga continuam adiadas.

Cobertos história imutável, revisão/cancelamento, referência preservada ou corrigida, prevenção de duplicação entre cadeias, retorno a referência ancestral, dependências, valores exatos, datas/unidade, rollback, retry, RLS/RBAC e permissão adicional para corrigir. Refazer preserva o par e permite um sucessor após reversão. Disputas verificadas na API e em SQL pelo papel da aplicação, sem depender da trava antecipada do serviço. Banco recusa predecessor de outro par, comando fechado e revisão sem sucessora no commit.

Seed executado duas vezes: quatro revisões, duas conciliações e duas alocações, sem duplicação; parcela disponível 97 e recebimento disponível 100 preservados. Referências privadas em .local/financial-corrections-demo.json, sem segredos publicados.

## Retomada e ajustes de verificação

Na retomada em 22/09, foi corrigida a anotação string do prefixo do cenário; o UUID inferido pelo TypeScript recusava seed-c17. Os dois testes SQL novos tinham um parâmetro ambíguo entre UUID/texto no helper de comando; a conversão explícita corrigiu o teste, sem relaxar guardas do domínio. Antes da pausa, uma variável do bloco de migration conflitou com alias SQL e um cenário usou referência de recebimento sem formato UUID: ambos foram corrigidos antes da validação final, sem reescrever migration já aplicada.

O PostgreSQL estava parado. O processo local existente foi reiniciado com a elevação necessária ao executável no Windows; a recuperação automática do cluster terminou e os ledgers foram conferidos. Não foi criado banco novo. A credencial administrativa sintética estava expirada; uma nova credencial local de sete dias foi criada, preservando a anterior e cópia privada do acesso. Isso não substitui recuperação administrativa operacional, ainda pendente.

A revisão orientada pela skill de boas práticas PostgreSQL conferiu RLS forçada, índices das referências/cadeias e transações limitadas ao banco sob a trava financeira existente. Não houve conexão ao Supabase nem alegação de desempenho de produção.

## Pendências e ponto de parada

Parte técnica M5 resolvida foi arquivada em [PENDENCIAS-RESOLVIDAS-C17.md](PENDENCIAS-RESOLVIDAS-C17.md). Limites e decisões restantes foram atualizados em [PENDENCIAS-HVB.md](PENDENCIAS-HVB.md).

C8–C17 permanecem locais. Último commit publicado C7: 789ee1f26241be9e636ea0ad328d03a1cea6f04b. Não houve tentativa de escrita no Git, deploy, alteração de outra branch/pasta, infraestrutura paga ou dado real. [Revisão final](evidencias/c17-revisao-final.json). O próximo trabalho é receber e avaliar o delta intermediário, conforme [ponto de parada](PONTO-DE-PARADA-C17.md); o inventário posterior permanece preservado.
