# ADR 0003 — Estoque físico, exatidão e concorrência

Data: 13/09/2026. Estado: implementado para DEV sintético no recorte M2; políticas hospitalares continuam pendentes.

## Decisão

Manter PostgreSQL e a arquitetura modular de M1, sem dependências adicionais. Separar produto, unidade de medida, apresentação versionada, lote, recipiente, custódia e posição física. Uma posição pertence a local/unidade hospitalar e não muda de identidade. Transferência e retirada movimentam entre posições da mesma unidade, lote, recipiente e custódia. Retirada não representa execução, consumo ou cobrança.

Representar quantidade e custo por decimal exato no banco e strings na API. Não aceitar números JSON de quantidade, nem arredondar conversões silenciosamente. Cada apresentação declara conteúdo, unidade e fator compatível com a dimensão do produto; nomes não determinam conversão, concentração ou validade. Entradas preservam apresentação/fator usados. O custo declarado no lote é preservado como snapshot; custo desconhecido e custo hospitalar de material do tutor ficam nulos.

Cada movimento grava cabeçalho e dois lançamentos cuja soma é zero. Entradas, perdas e ajustes usam uma contrapartida virtual explícita; transferências usam duas posições físicas. Triggers projetam o saldo e constraints diferidas exigem um par completo no commit. Correções físicas são novos movimentos compensatórios; os lançamentos anteriores não são editados. Devolução parcial referencia uma retirada/transferência, respeita o total original e pode ser revertida. Reversão é integral e única; devoluções ativas devem ser revertidas antes da origem.

Bloquear posições em ordem determinística de UUID. Serializar devoluções e reversões também pela raiz do movimento. Preservar as tentativas limitadas para deadlock/serialização da fundação. Reserva ativa reduz disponível; efetivação encerra a reserva e transfere a quantidade integral na mesma transação. Reserva vencida mantém proteção até comando de expiração, sem worker automático neste recorte. Reversão não reativa a reserva original.

No inventário, exigir a versão que o cliente observou. Registrar quantidade contada, saldo e versão como snapshot; aplicar somente se o snapshot continuar atual e a sessão estiver aberta. Qualquer movimento ou mudança de reserva invalida a versão. Diferença zero confirma sem criar lançamento artificial. Ajuste negativo não pode comprometer reservas. Contagens antigas são preservadas; cancelamento/recontagem operacional será definido posteriormente.

## Acesso e atomicidade

Manter RLS por organização, FKs compostas e autorização por unidade no servidor. Sete permissões distinguem leitura, catálogo, movimento, reserva, inventário, ajuste e reversão. Efetivar reserva, ajustar saldo e reverter movimento também exigem permissão de movimentação. Catálogos organizacionais exigem permissão sem escopo restrito a uma unidade.

O privilégio `UPDATE(versao)` permite `SELECT FOR UPDATE` no PostgreSQL, mas um trigger recusa update direto de posição; a projeção ocorre apenas por triggers internos. Não conceder update de saldo. A view de lançamentos executa sob os privilégios do chamador.

O comando idempotente, domínio, auditoria, outbox e resultado compartilham o commit. Auditoria/outbox/resultado são persistidos por uma única instrução SQL com CTEs. A mudança economiza duas idas ao banco e preserva os testes de rollback e repetição M1. Consultas repetidas de metadados e autorização foram reduzidas sem retirar o controle de acesso efetivo.

## Validação e consequências

35 testes passaram com PostgreSQL real, incluindo concorrência, tentativas repetidas, saldo insuficiente, precisão, reservas, devoluções, reversões, inventário, custódia do tutor, isolamento e resistência a alteração SQL direta. A sequência 001–010 também foi executada em TEST vazio.

O benchmark local de mil posições mediu 7 statements totais/4 funcionais para listagem e 13/10 para transferência. O total inclui BEGIN, contexto e COMMIT; a medição conta statements enviados pelo cliente, não consultas internas de triggers. Planos e reconciliação foram registrados. Latência local não constitui SLA ou dimensionamento de produção.

Limitações deliberadas: mesma unidade e identidade física no movimento; recipiente aberto declarado na entrada, sem transformação de estoque existente; reserva integral com validade DEV de até 24 horas; expiração explícita; sessões obsoletas preservadas sem cancelamento; custo por lote sem política contábil aprovada. Validar essas decisões com a equipe antes de operação real. Ver `docs/PENDENCIAS-HVB.md`.
