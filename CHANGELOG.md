# Changelog

## 0.16.0 — 2026-09-15

- C7: rateio versionado dos componentes de aquisição por item, fechado contra a precificação original.
- Custo explícito por recebimento parcial, com limites de valor/quantidade, reversões e preservação do custo físico histórico.
- Alteração de preço sinalizada; entrada revertida torna custo analítico inativo sem apagar avaliação.
- Migrations 051–052; quatro tabelas, três views, duas permissões e sete operações; total 328 operações em 198 caminhos.
- 32 testes pontuais aprovados e seed repetível. Próximo grupo: complementos financeiros de fornecedores.

## 0.15.0 — 2026-09-15

- C6: preços negociados versionados por item, frete/acréscimo/desconto explícitos e centavos exatos.
- Conciliação parcial/reversível entre pedido e obrigação existente, com limites agregados entre versões; dívida, pagamento e custo físico separados.
- Migrations 049–050; quatro tabelas, três views, duas permissões e oito operações; total 321 operações em 194 caminhos.
- 23 testes pontuais aprovados e seed repetível. Fiscal, rateio de aquisição e demais pendências preservados.

## 0.14.0 — 2026-09-15

- C5: etiquetas fictícias, leitura com contexto explícito, revogação, retirada confirmada e consulta do próprio comando por chave.
- Retirada compartilha o ID físico M2; uma leitura por intenção, sem execução clínica inferida.
- Dispositivo travado durante o comando para revalidar desativação concorrente.
- Migrations 047–048; quatro tabelas, duas views, três permissões e nove operações novas; total de 313 operações em 189 caminhos.
- 28 testes pontuais aprovados e seed local; nenhum leitor físico, cliente Terminal, offline ou serviço externo.

## 0.13.0 — 2026-09-15

- C4: obrigações de fornecedor/despesa, pagamentos declarados, liquidações parciais e reversões em simulação.
- Correção documental após reversão preserva origem e admite uma sucessora; concorrência respeita os saldos dos dois lados.
- Estoque/pedido não geram nem compensam dívida por inferência. Cancelamento sinaliza revisão.
- Migrations 044–046; quatro tabelas, três views, cinco permissões e oito operações novas. Total: 304 operações em 184 caminhos.
- 24 testes pontuais aprovados; seed de obrigação 100/pagamento 60/saldo 40, sem operação bancária. Próximo C5: terminal simulado em SISTEMA.

## 0.12.1 — 2026-09-15

- C3: jornada sintética reutiliza paciente e episódio entre clínica, diária, custo, cobrança, prontuário, documento e portal.
- Seed integrado e retomada idempotente, sem entrega externa. Cenários aceitam contexto clínico existente.
- Matriz de cobertura por capacidade explicita faltas funcionais e decisões humanas; próximos recortes C4 aquisição/despesas e C5 terminal simulado em SISTEMA.
- Nove testes pontuais aprovados; nenhuma nova rota, dependência ou migration. Verificação geral e pendências seguem para depois.

## 0.12.0 — 2026-09-15

- C2: evolução clínica com autoria, texto exato, hash, retificação e invalidação versionadas.
- Linha do tempo por paciente/unidade com permissões por fonte, IDs originais e cursor temporal com microssegundos.
- Revisão temporal derivada quando alta/saída retroativa diverge de relato preservado.
- Migrations 041–043; duas tabelas, uma view, quatro permissões e seis operações novas; total de 296 operações em 180 caminhos.
- 34 testes pontuais aprovados, seed sintético, TypeScript, lint, formato e OpenAPI. Verificação geral e pendências mantidas para depois.
- Núcleo ainda em consolidação; próximos trabalhos: cobertura funcional e jornadas integradas.

## 0.11.0 — 2026-09-14

- C1: fornecedor, pedido com itens, aprovação/cancelamento e recebimentos parciais em simulação.
- Cada linha recebida compartilha o ID da entrada física M2; atomicidade, teto do pedido, custódia hospitalar e apresentação exata.
- Reversão preserva recibo e recalcula quantidade recebida ativa; não cria crédito/pagamento.
- Migrations 039–040; seis tabelas e três views; dez operações novas, total de 290 em 176 caminhos.
- Verificação pontual: 29 testes de unidades/estoque/compras, TypeScript, lint, formato e OpenAPI. Suíte geral, instalação vazia e desempenho adiados conforme a orientação atual.
- Pendências preservadas; próximo recorte é prontuário longitudinal. Sem envio de pedido, documentos fiscais reais ou infraestrutura externa.

## 0.10.0 — 2026-09-14

- M6E: contas/credenciais próprias do portal, concessões por paciente, revogações e preferências versionadas.
- Mensagens com versão documental/agenda exata, tentativas e retornos simulados; resultado incerto exige conciliação antes de repetir.
- Caixa e conteúdo isolados por conta, sem reaproveitar permissões da equipe; leitura não confirma aceite ou estado lido.
- Migrations 036–038, dez tabelas e três views; 19 operações novas, total de 280 em 170 caminhos.
- 152 testes, seed repetido, instalação vazia, mil mensagens e HTTP local com hash documental. Predicados reutilizam planos após timeout identificado no ensaio.
- Roteiro de consolidação do núcleo antes da discussão das pendências, conforme pedido. Sem interface, mensagem externa, deploy ou serviços pagos.

## 0.9.0 — 2026-09-14

- M6D: recursos tipados, disponibilidade/bloqueios com revogação, agendamentos multirrecurso, reprogramação e histórico de transições.
- Conflitos concorrentes recusados; retirada de disponibilidade sinaliza revisão sem liberar reserva ativa. Planejamento e chegada não geram execução clínica.
- Migrations 034–035, oito tabelas e três views; 16 operações novas, total de 261 operações em 159 caminhos e 78 permissões.
- 138 testes aprovados, seed idempotente, instalação vazia e mil agendamentos no ensaio com HTTP local. Sem dependências novas.
- Pendências cumulativas preservadas. Próximo recorte: portal/comunicação simulados; sem interface, mensagens externas, deploy ou serviços pagos.

## 0.8.0 — 2026-09-14

- M6C: modelos/campos versionados, solicitação com protocolo, autorização/revogação, conteúdo privado, aprovação e registro de entrega em simulação.
- Preenchimento textual sem recursão, versão esperada, hash exato e histórico preservado. Declaração de assinatura sempre não verificada.
- Permissão própria para conteúdo; documento interno não admite entrega a responsável. Papéis comportam as 72 permissões existentes, sem novas concessões implícitas.
- Migrations 030–033; 11 tabelas e três views; 22 operações novas, total de 245 operações em 150 caminhos.
- 126 testes aprovados, seed idempotente, instalação vazia e ensaio de mil documentos com HTTP e hash conferidos. Teste de lease usa evento novo identificado para não depender do histórico de TEST.
- Pendências anteriores preservadas e ampliadas; agenda é o próximo recorte. Sem PDF/DOCX, assinatura validada, envio externo, deploy ou infraestrutura paga.

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
