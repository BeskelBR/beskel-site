# ADR 0027 — Correções do financeiro do cliente

Status: aceita para simulação DEV. Conclusão: 22/09/2026. Complementa M5; não autoriza movimentação bancária real.

## Contexto

Depósito da adquirente e linha de extrato eram imutáveis, sem revisão. As unicidades de conciliação e alocação por par também impediam nova decisão depois da reversão. A correção deve preservar evidências e referências, sem alterar recebimentos, quitação do cliente ou parcelas da adquirente implicitamente.

## Decisão

Migrations 071–072 criam revisao_deposito_adquirente e revisao_item_extrato. Cada origem admite uma revisão final: cancelamento sem sucessora ou correção com novo registro. A sucessora pode receber outra revisão. Origem, sucessora, organização/unidade, autoria e comando são ligados por FKs tipadas; a sucessora é conferida no commit e deve pertencer ao mesmo comando/autor da revisão. As tabelas têm RLS forçada e bloqueio de UPDATE/DELETE.

Revisar depósito exige reverter todas as suas alocações e conciliações ativas. Revisar extrato exige reverter suas conciliações; não reverte a alocação do depósito. Sucessoras são inseridas atomicamente com a revisão e obedecem às regras originais de valores exatos, datas, conta e unidade. Conta, adquirente, referência, valor, data e evidência podem ser corrigidos dentro da mesma unidade, explicitamente. Transferência entre unidades é recusada.

As referências naturais continuam reservadas ao longo do histórico. A nova validação permite repetição somente por descendentes da mesma cadeia de correção, inclusive retorno a referência anterior. Cancelar uma origem não libera sua identidade para criação de outra cadeia. Índices das referências foram preservados como índices não únicos e a validação usa a trava financeira existente por organização/unidade, inclusive em INSERT SQL direto.

Refazer conciliação ou alocação cria novo vínculo com anterior_id, mantendo exatamente o mesmo par. Exige que o predecessor esteja revertido e ainda não tenha sucessor. Cada predecessor só admite um sucessor; saldo, conta, adquirente e vigência das origens são revalidados. Os endpoints antigos de criação continuam recusando pares históricos: a reabertura requer a rota explícita refazer. Valores e evidência são informados novamente; não se restaura o fato antigo nem se apaga sua reversão.

Correção/cancelamento usam financeiro:reverter; correção exige também financeiro:conciliar. Refazer exige financeiro:conciliar. Nenhuma permissão nova foi criada. Escopo vem da origem e a unidade declarada deve coincidir. Comandos mantêm idempotência, auditoria e outbox transacionais.

## Consultas e limites

O valor original permanece intacto. Nas projeções, origens revisadas têm disponibilidade zero e situação explícita; registros vigentes continuam descontando vínculos ativos. Listas de vínculos expõem anterior_id e revertido, permitindo distinguir história de efeitos atuais. As consultas de avaliações financeiras também passam a aceitar filtro anterior_id, sem alterar conteúdo.

Cancelamento é final; não há restauração ou transferência entre unidades. Correção bancária real, importação, autenticação do comprovante, chargeback, antecipação, correção de parcela, estorno de recebimento com parcelas e ajustes de caixa fechado continuam fora do recorte. A operação não move dinheiro nem quita novamente o cliente.

## Evidência

17 testes específicos, 19 financeiros, 15 de correção de diárias e cinco unitários: 56 aprovados. Demonstração repetida preserva quatro revisões, dois vínculos de conciliação e duas alocações, com parcela disponível de 97 e recebimento de 100. [Relatório C17](../RELATORIO-C17.md).
