# Changelog

## 0.2.0 — 2026-09-13

- M2: catálogo dimensional, apresentações versionadas, lotes, recipientes, custódia hospital/tutor, posições e reservas.
- Movimentação física com lançamentos balanceados, saldos protegidos, retirada separada de consumo, devolução parcial vinculada e reversão compensatória.
- Inventário com versão observada, contagem, confirmação sem diferença e ajuste rastreável; conflitos não sobrescrevem contagens.
- Cinco migrations novas (006–010), sete permissões e 33 operações HTTP de estoque; contrato total de 74 operações em 50 caminhos.
- 35 testes aprovados em PostgreSQL real, incluindo instalação em TEST vazio; benchmark com mil posições e reconciliação sem divergências.
- Transferência reduzida de 18 para 13 statements SQL, preservando autorização, locks, idempotência, auditoria e outbox.
- Seed M2 fictício idempotente, evidências e pendências cumulativas; M3 não iniciado e nenhuma infraestrutura externa provisionada.

## 0.1.0 — 2026-09-13

- M0: árvore própria `hvb-sistema-dev`, stack documentada, PostgreSQL DEV/TEST local, scripts reprodutíveis, migrations com hash, qualidade e CI manual, health/readiness e OpenAPI.
- M1: identidade/acesso, credenciais/revogação, dispositivos, responsáveis/pacientes/vínculos, episódios e ocupação, idempotência, auditoria, outbox/inbox e IDs externos sintéticos.
- Constraints por organização/unidade, RLS, menor privilégio, capacidade por vaga, intervalos, alta/saída independentes e motivos preservados.
- Testes PostgreSQL de concorrência, isolamento, rollback, retry, credenciais e worker; correções de lock por vaga, preservação temporal e recuperação limitada da outbox.
- Smoke HTTP real local e benchmarks sintéticos com planos de execução; índices redundantes removidos.
- Sem avanço para M2+, sem alteração de site/Terminal e sem provisionamento externo.
