# Cobertura do núcleo — C3

Conferência em 15/09/2026 contra a lista de capacidades do documento 10-ESCOPO-ATUAL.md fornecido pelo usuário. A fonte local permanece em .local/reference, fora do Git. Instruções históricas de acesso ao fornecedor não foram tratadas como pedidos de acesso. Esta matriz relaciona capacidade, implementação e falta conhecida; não aprova política hospitalar nem substitui homologação.

**DEV** significa que há comandos/entidades e testes no recorte descrito. **Parcial** indica falta funcional ou operacional explícita. As evidências M0–C2 são históricas; somente a jornada indicada abaixo foi exercitada novamente em C3.

| Capacidade do escopo | Base e evidência no repositório | Cobertura e falta conhecida |
|---|---|---|
| Identidade e acesso individual | foundation, schemas; tests/integration.test.ts; DADOS-M1 | DEV: usuário, papel, unidade, credencial e revogação. Parcial operacional: login, recuperação e MFA |
| Responsáveis e pacientes | foundation; tests/integration.test.ts | DEV: cadastro e vínculo temporal. Deduplicação e saneamento de legado ficam para migração autorizada |
| Prontuário | medical-record; tests/medical-record.test.ts | DEV C2: evolução, autoria, versões, invalidação e linha do tempo de metadados. Parcial: modelos clínicos, anexos, busca e coautoria |
| Episódios | foundation; tests/integration.test.ts | DEV: admissão, alta clínica e saída distintas, versão esperada e contexto de unidade |
| Internação | foundation, daily; tests/daily.test.ts | DEV: ocupação/capacidade, classe e período. Regras assistenciais/diária real ainda não aprovadas |
| Prescrições e versões | clinical; tests/clinical.test.ts | DEV: prescrição, ordem/sucessão, vigência e autor. Assinatura operacional permanece separada |
| Programação e execução | clinical; tests/clinical.test.ts | DEV: previsto, parcial, integral, retificação e conciliação material; nenhum ato inferido de NFC ou agenda |
| Produtos e apresentações | inventory; tests/inventory.test.ts | DEV: produto, apresentação versionada e recipiente. Catálogo hospitalar e abertura real não carregados |
| Unidades e conversões | inventory; tests/unit.test.ts, tests/inventory.test.ts | DEV: quantidade/fator decimal exatos; conversão não deduzida de nome |
| Lote, validade, local, custódia e movimentos | inventory; tests/inventory.test.ts | DEV: hospital/tutor, reserva, retirada/transferência, consumo, devolução, perda e reversão separados |
| Compras e recebimentos | purchases; tests/purchases.test.ts | Parcial C1: fornecedor/pedido/aprovação/recebimento parcial e mesmo movimento físico. Faltam preço negociado, obrigação a pagar e liquidação ao fornecedor |
| Contagem, perdas e ajustes | inventory; tests/inventory.test.ts | DEV: contagem com versão esperada e ajuste rastreável. Inventário de abertura real exige evidência/aprovação |
| Custo | inventory, clinical; tests/core-journeys.test.ts | DEV: snapshot físico de custo; C3 confirma consumo hospitalar de duas unidades a 1,25 = 2,50. Parcial: custo contábil da aquisição, frete/tributos/rateio |
| Cobertura de diárias | daily; tests/daily.test.ts, tests/core-journeys.test.ts | DEV configurável: regra/limite/reserva/revisão. Ambiguidade não libera cobrança; política real pendente |
| Comercial/financeiro | financial; tests/financial.test.ts | DEV do lado do cliente: preço, avaliação, conta, responsabilidade e título. Parcial do lado fornecedor/despesas |
| Créditos e liquidações | financial; tests/financial.test.ts | DEV: recebimento, saldo disponível, crédito/aplicação e reversão explícita. Dinheiro real e integração bancária não ativados |
| Caixa e conciliação | financial; tests/financial.test.ts | DEV: sessão, fechamento, adquirente, repasse, extrato e conciliação. Processo real e canais bancários pendentes |
| Exames e resultados | exams; tests/exams.test.ts | DEV: versões, valores estruturados, coleta e liberação humana simulada. Emissor/laboratório real e assinatura não integrados |
| Protocolos preventivos | preventive; tests/preventive.test.ts | DEV: versão/adesão/ocorrência, aplicação interna com execução original e declaração externa. Regras clínicas não presumidas |
| Documentos e assinatura | documents; tests/documents.test.ts | Parcial: modelo, autorização, conteúdo/hash, versão, aprovação e declaração de assinatura não verificada. Assinatura válida ainda não implementada |
| Agenda | schedule; tests/schedule.test.ts | DEV: recursos, disponibilidade, conflito, reprogramação e transições. Parcial: interface e vínculos explícitos com atendimento/episódio |
| Portal/comunicação | portal; tests/portal.test.ts, tests/core-journeys.test.ts | DEV simulado: credencial própria, concessão, preferências e entrega/revogação. Parcial: login operacional, interface e canais reais |
| Trilha auditável | core, persistence, worker; tests/integration.test.ts | DEV: comandos idempotentes, auditoria, outbox/inbox. Parcial: auditoria de todas as leituras, retenção e operação de suporte |
| Dispositivos e terminais NFC | foundation; tests/integration.test.ts | Parcial: dispositivo/autorização e rejeição de NFC como credencial. Falta fluxo de terminal simulado ponta a ponta em SISTEMA; pasta/branch Terminal não autorizadas para edição |
| Proveniência e migração futura | foundation; DADOS-M1 | Parcial: lote sintético, IDs externos e FKs. Obtenção/importação de dados reais, anexos e conciliação operacional M7 não autorizadas |

## Jornada consolidada em C3

Um paciente e episódio de internação compartilhados entre módulos. Execução explícita, consumo hospitalar com custo, cobertura da execução, item comercial de valor zero, evolução e documento autorizado. O documento usa texto de teste informado; não extrai diagnóstico da evolução nem representa um laudo automático. O portal recebe somente a versão documental autorizada.

A jornada pode ser repetida com a mesma referência sem duplicar efeitos. Cada requisição é atômica; a sequência inteira não é uma transação distribuída. Falha intermediária preserva comandos já confirmados e permite retomada. Não há compensação automática da jornada, fila de execução do fluxo ou decisão clínica derivada.

Estorno de material devolve saldo e reabre conciliação da execução; a cobertura da execução permanece, pois o ato não foi desfeito. Retificar a execução sinaliza revisão no item comercial. Documento e evolução históricos são preservados; não são corrigidos ou reenviados automaticamente.

## Ordem das próximas entregas

1. **C4: financeiro de aquisição/despesas em simulação.** Completar obrigação identificada do fornecedor e sua liquidação/reversão, separadas do recebimento físico. Preço e valores explícitos, sem presumir política fiscal, rateio ou alçada.
2. **C5: contrato e fluxo de terminal simulado dentro de SISTEMA.** Reutilizar identidade, dispositivo, comando e confirmação humana; leitura NFC nunca confirma execução. Demais pastas e branches preservadas.
3. Consolidar as faltas de vínculos e correção identificadas nesta matriz, mantendo separadas funções técnicas de políticas e integrações que dependem de decisão humana. Atualizar a cobertura antes de declarar o núcleo encerrado.

Assinatura válida, autenticação operacional, interfaces, canais reais, homologação, infraestrutura e migração continuam etapas próprias. A verificação geral, carga e instalação vazia serão realizadas depois, conforme o usuário. A existência de uma API ou de teste aprovado não fecha toda a capacidade operacional.
