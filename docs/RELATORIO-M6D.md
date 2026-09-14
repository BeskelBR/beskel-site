# Relatório M6D — Agenda

Data: 14/09/2026. Continuidade somente em SISTEMA e hvb-sistema-dev, dados fictícios e código no GitHub. Pendências anteriores preservadas; sem Vercel/Cloudflare, produção ou serviços externos.

## Entrega

Backend de recursos tipados, disponibilidade/bloqueios com revogação, agendamentos com múltiplos recursos, reprogramação versionada e transições operacionais. Mapa por intervalo limitado, paciente e recurso. Migrations 034–035, oito tabelas e três views; total de 130 tabelas, 37 views e 261 operações HTTP em 159 caminhos. Sem dependências novas.

Reservas concorrentes do mesmo recurso não coexistem. Falha em um recurso desfaz a criação inteira; reprogramação conflitante preserva a versão vigente. Revogação não libera silenciosamente compromissos ativos: indica revisão e impede confirmação/chegada enquanto faltar disponibilidade. Cada transição preserva autoria e histórico; não cria execução clínica, cobrança ou baixa de estoque.

Seed repetido duas vezes sem duplicação: recurso institucional, disponibilidade, agendamento e confirmação fictícia. Referências privadas em `.local/schedule-demo.json`, ignorado pelo Git.

## Verificação

138 testes aprovados: cinco unitários e 133 integrações PostgreSQL, incluindo 12 cenários de agenda e os 126 testes anteriores. Casos incluem concorrência multirrecurso em ordens opostas, retry, versão esperada, estados, fronteiras de horários, revogação, RLS/RBAC e rejeição SQL de cabeçalho sem versão ou versão sem recursos.

TypeScript estrito, lint, formatação e OpenAPI verificados. Migrations 001–035 e suíte completa executadas em TEST vazio no cluster adicional; a base anterior foi preservada por renomeação. O cluster adicional foi encerrado após a verificação, preservando os dados. Node 24.19.0, PostgreSQL 17.10, Windows. Docker/Linux e workflow manual não executados.

HTTP real local confirmou criação e retry com o mesmo ID, além de consulta do mapa. Ensaio com mil agendamentos fictícios preservou saldo físico em 20 unidades, sem execução clínica ou item de cobrança. Evidências: [checks](evidencias/checks-m6d.json) e [benchmark](evidencias/benchmark-m6d.json); evidências anteriores preservadas.

| Operação | p50 | p95 | Statements totais |
|---|---:|---:|---:|
| Mapa de até 50 versões | 7,29 ms | 11,49 ms | 7 |
| Agendar com um recurso | 4,05 ms | 4,63 ms | 12 |
| Reprogramar com um recurso | 4,53 ms | 5,49 ms | 13 |

Mil compromissos preparados por comandos, um recurso, horários de 30 minutos, dez aquecimentos e cem medições por operação. Preparação do compromisso a reprogramar fora da janela medida. Contagem inclui transação/contexto e exclui SQL interno dos triggers. Valores locais não são SLA; histórico longo, múltiplas unidades e carga concorrente precisam de ensaio próprio.

## Limites e continuidade

As regras são propostas DEV. Ainda faltam política real de escala, composição de equipes, habilitação, capacidade/encaixes, conflito entre unidades, conflito do paciente, retrospectividade, reabertura e cancelamento tardio. A trava atual serializa a unidade inteira. Intervalos disponíveis adjacentes não são unidos automaticamente.

Recurso institucional não é profissional; confirmação/chegada/conclusão são declarações operacionais. Não há vinculação automática a execução, protocolo preventivo, exame ou episódio. Responsável não ganha acesso por constar no agendamento. A revisão usa a disponibilidade atual, inclusive ao consultar histórico, sem representar um snapshot passado.

Interface/calendário visual e integrações externas permanecem pendentes. M6 continua em andamento; próximo recorte é portal/comunicação em ambiente simulado, sem enviar mensagens ou ativar serviços externos. M7/migração real não iniciado.

Referências: [ADR 0010](adr/0010-agenda.md), [dicionário](DADOS-M6D.md) e [pendências](PENDENCIAS-HVB.md).
