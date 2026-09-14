# Changelog

## 0.7.0 — 2026-09-14

- M6B: protocolos e etapas versionados, aprovação em simulação, adesão e ocorrências por dias ou calendário com âncora explícita.
- Aplicação interna estende a execução identificada; externa preserva profissional/lote/fabricante declarados. Correções mantêm linhagem e vínculo físico não duplica baixa.
- Revisão de atraso, resolução humana e encerramento com sucessor explícito, sem aplicação ou comunicação automática.
- Migrations 026–029, 11 tabelas e quatro views; 21 operações novas, total de 223 operações em 138 caminhos. Sem dependências novas.
- 115 testes aprovados, seed repetido sem duplicação, instalação vazia e ensaio de mil ocorrências com HTTP idempotente.
- Roteiro para discussões no chat e testes locais; pendências cumulativas preservadas. M6 segue em andamento, sem dados reais, deploy ou infraestrutura paga.

## 0.6.0 — 2026-09-14

- M6A: catálogo técnico e referências versionados, solicitação, coleta interna/externa, avaliação da amostra e resultados estruturados.
- Valores exatos, texto original e booleanos preservados; correção por versão esperada e liberação humana DEV com hash verificável do conteúdo.
- Migrations 024–025, 14 tabelas e três views; 26 operações novas, total de 202 operações em 127 caminhos. Sem dependências novas.
- 102 testes aprovados, instalação vazia, seed idempotente, benchmark de mil resultados e HTTP local com SHA-256 conferido.
- M6 permanece em andamento. Pendências anteriores preservadas e ampliadas; sem assinatura profissional validada, interpretação clínica, integração, deploy ou DNS.

## 0.5.0 — 2026-09-13

- M5: catálogo/preço versionados, conta, evento de origem tipada, avaliação comercial, responsabilidade por pagador e título com rateio atômico.
- Recebimentos, liquidações, créditos/aplicações, sessão/conferência de caixa e reversões vinculadas; valores exatos em centavos, sem transferência real.
- Parcelas da adquirente, taxas informadas, depósito, extrato fictício e conciliação humana com limites dos dois lados.
- Diária ambígua, material do tutor e execução parcial permanecem pendentes; valor zero documentado sem dívida. Origem substituta exige reverter documento anterior para evitar duplicação.
- Migrations 017–023, 24 tabelas e 15 views; 46 operações financeiras novas, total de 176 operações em 112 caminhos. Sem dependências novas.
- 88 testes aprovados em PostgreSQL, inclusive instalação vazia; seed idempotente, benchmark com mil recebimentos, HTTP real local e zero saldos negativos.
- Pendências cumulativas preservadas. Sem deploy, DNS, integração bancária ou fiscal; M6 ainda não iniciado.

## 0.4.0 — 2026-09-13

- M4: classificação, medição de peso, grupos, pacotes e regras versionados; aprovação restrita à simulação e períodos explícitos.
- Avaliação não monetária por quantidade física, administrações ou itens distintos; limites concorrentes, reserva, reversão e reavaliação com histórico.
- Origem retificada, estorno, mudança de classificação e encerramento sinalizam revisão; cobertura não altera consumo, custo ou saldo.
- Migrations 014–016, 16 tabelas e quatro views; 33 operações de diária, total de 130 operações em 88 caminhos. Sem dependências novas.
- 69 testes aprovados, incluindo instalação em banco vazio; seed repetido e benchmark com mil avaliações, HTTP idempotente e zero limites ultrapassados.
- Pendências anteriores preservadas e ampliadas. M5/cobrança não iniciado; Vercel e Cloudflare ficam a cargo do usuário.

## 0.3.0 — 2026-09-13

- M3: item clínico, prescrição, ordem/versão, programação, execução confirmada e retificação; fatos planejados, ocorridos e registrados separados.
- Material previsto versionado, consumo em posições identificadas, múltiplos lotes, custo exato, custódia do tutor e estorno integral com pendência reaberta.
- Pendências clínicas persistentes, revisão de sobreposição/alta e conciliação sem inferir lote, dose, validade ou cobrança.
- Migrations 011–013, 23 operações clínicas; contrato total de 97 operações em 66 caminhos. Sem dependências novas.
- 52 testes aprovados, benchmark de mil programações e smoke HTTP real; consulta repetida de lock removida por item de consumo.
- Seed clínico simulado idempotente e pendências cumulativas. M4/diárias e demais decisões operacionais continuam pendentes.

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
