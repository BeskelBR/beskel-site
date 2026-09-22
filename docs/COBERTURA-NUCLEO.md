# Cobertura do núcleo — atualização C18

Conferência em 16/09/2026 contra a lista de capacidades do documento 10-ESCOPO-ATUAL.md fornecido pelo usuário. A fonte local permanece em .local/reference, fora do Git. Instruções históricas de acesso ao fornecedor não foram tratadas como pedidos de acesso. Esta matriz relaciona capacidade, implementação e falta conhecida; não aprova política hospitalar nem substitui homologação.

Atualização de 22/09/2026: C18 incorpora o contrato N1 Terminal v1 como evolução aditiva dos baselines C5/C14. O backend agora possui NFC/biometria DEV, vínculo de dispositivo, sessão exclusiva, coordenadas/ocupações, FEFO/FIFO, picking, divergências, sensível, saída recuperável, fulfillment e transferência M2. A descrição histórica de picking/fulfillment futuro está supersedida nesse recorte. Clientes, hardware, políticas reais e correções após encerramento continuam separados. Ver [matriz C18](DADOS-C18.md) e [78 testes pontuais](evidencias/checks-c18-focused.json).

**DEV** significa que há comandos/entidades e testes no recorte descrito. **Parcial** indica falta funcional ou operacional explícita. As evidências M0–C2 são históricas; C3 exercitou a jornada abaixo, e C4 verificou pontualmente compras/contas a pagar; C5 verificou terminal simulado/fundação; C6 verificou preços/conciliação e contas a pagar; C7 verificou compras, preços e custo de aquisição; C8 verificou parcelas e contas a pagar; C9 verificou crédito, parcelas e contas a pagar; C10 verificou conciliação de saídas e contas a pagar; C11 verificou complementos do prontuário e narrativa existente; C12 verificou vínculos/auditoria, fundação, agenda e portal; C13 verificou cadastros/acesso, fundação e auditoria.

| Capacidade do escopo | Base e evidência no repositório | Cobertura e falta conhecida |
|---|---|---|
| Identidade e acesso individual | foundation, schemas; tests/integration.test.ts; DADOS-M1 | DEV: usuário, papel, unidade, credencial e revogação; C13 acrescenta revisão cadastral e revogação/restauração de atribuições. Parcial operacional: login, recuperação e MFA |
| Responsáveis e pacientes | foundation; tests/integration.test.ts | DEV: cadastro, vínculo temporal e revisão de dados básicos com antes/depois em C13. Deduplicação/fusão e saneamento de legado continuam separados |
| Prontuário | medical-record, medical-complements; tests/medical-record.test.ts e medical-complements.test.ts | DEV C2/C11: narrativa, modelos versionados, anexos privados pequenos, busca textual e coautoria pessoal. Formulários reais, arquivos maiores/antivírus, assinatura válida e interface continuam posteriores |
| Episódios | foundation; tests/integration.test.ts | DEV: admissão, alta clínica e saída distintas, versão esperada e contexto de unidade |
| Internação | foundation, daily; tests/daily.test.ts | DEV: ocupação/capacidade, classe e período; C13 revisa nome/capacidade protegendo vagas ocupadas. Regras assistenciais/diária real ainda não aprovadas |
| Prescrições e versões | clinical; tests/clinical.test.ts | DEV: prescrição, ordem/sucessão, vigência e autor. Assinatura operacional permanece separada |
| Programação e execução | clinical, clinical-corrections; testes clínicos e C15 | DEV: previsto, parcial, integral, conciliação material, correção de contexto e anulação com histórico; nenhum ato inferido de NFC ou agenda |
| Produtos e apresentações | inventory; tests/inventory.test.ts | DEV: produto, apresentação versionada e recipiente. Catálogo hospitalar e abertura real não carregados |
| Unidades e conversões | inventory; tests/unit.test.ts, tests/inventory.test.ts | DEV: quantidade/fator decimal exatos; conversão não deduzida de nome |
| Lote, validade, local, custódia e movimentos | inventory; tests/inventory.test.ts | DEV: hospital/tutor, reserva, retirada/transferência, consumo, devolução, perda e reversão separados |
| Compras e recebimentos | purchases; tests/purchases.test.ts | Parcial C1: fornecedor/pedido/aprovação/recebimento parcial e mesmo movimento físico. C4 acrescenta obrigação, pagamento declarado, liquidação parcial, reversão e correção. C6 acrescenta preços negociados e conciliação parcial/reversível com obrigação. C7 acrescenta rateio e custo explícito por recebimento. C9 acrescenta crédito comercial explícito; fiscal/devolução física real permanecem separados |
| Contagem, perdas e ajustes | inventory; tests/inventory.test.ts | DEV: contagem com versão esperada e ajuste rastreável. Inventário de abertura real exige evidência/aprovação |
| Custo | inventory, clinical; tests/core-journeys.test.ts | DEV: snapshot físico de custo; C3 confirma consumo hospitalar de duas unidades a 1,25 = 2,50. C7 registra rateio explícito de componentes e custo analítico por recebimento. Política contábil/fiscal e método de valorização real permanecem pendentes |
| Cobertura de diárias | daily; tests/daily.test.ts, tests/core-journeys.test.ts | DEV configurável: regra/limite/reserva/revisão. Ambiguidade não libera cobrança; política real pendente |
| Comercial/financeiro | financial; tests/financial.test.ts | DEV do lado do cliente: preço, avaliação, conta, responsabilidade e título. C4 acrescenta contas a pagar de fornecedor/despesas; C8 acrescenta plano de parcelas e alocação explícita de liquidações. C9 acrescenta crédito comercial, aplicação e reversões. C10 acrescenta conciliação declarada de saídas; canal bancário, evidência real e homologação continuam pendentes |
| Créditos e liquidações | financial; tests/financial.test.ts | DEV: recebimento, saldo disponível, crédito/aplicação e reversão explícita. Dinheiro real e integração bancária não ativados |
| Caixa e conciliação | financial; tests/financial.test.ts | DEV: sessão, fechamento, adquirente, repasse, extrato e conciliação. Processo real e canais bancários pendentes |
| Exames e resultados | exams; tests/exams.test.ts | DEV: versões, valores estruturados, coleta e liberação humana simulada. Emissor/laboratório real e assinatura não integrados |
| Protocolos preventivos | preventive; tests/preventive.test.ts | DEV: versão/adesão/ocorrência, aplicação interna com execução original e declaração externa. Regras clínicas não presumidas |
| Documentos e assinatura | documents; tests/documents.test.ts | Parcial: modelo, autorização, conteúdo/hash, versão, aprovação e declaração de assinatura não verificada. Assinatura válida ainda não implementada |
| Agenda | schedule, links-audit; tests/schedule.test.ts e links-audit.test.ts | DEV: recursos, disponibilidade, conflito, transições e vínculo agenda–episódio revogável. Correção de estados terminais e vínculos diretos com exame/protocolo/executor permanecem refinamentos; interface é posterior |
| Portal/comunicação | portal; tests/portal.test.ts, tests/core-journeys.test.ts | DEV simulado: credencial própria, concessão, preferências e entrega/revogação. Parcial: login operacional, interface e canais reais |
| Trilha auditável | core, links-audit, persistence, worker; tests/integration.test.ts e links-audit.test.ts | DEV: comandos, outbox/inbox e consultas GET/HEAD identificadas, inclusive portal e recusas de domínio. Limites: tentativas anônimas/validação prévia/infraestrutura ficam em logs minimizados; retenção, monitoramento e suporte são posteriores |
| Dispositivos e Terminal de Acesso | foundation, terminal, terminal-access, terminal-v1; testes C5/C14/C18 | C18: backend de NFC/biometria DEV, sessão exclusiva, alocação, picking, sensível, saída recuperável e fulfillment com transferência M2. C5/C14 preservados; retirada C5 bloqueada. Parcial: clientes, biometria/hardware reais, compensações pós-saída e offline; branch Terminal preservada |
| Proveniência e migração futura | foundation; DADOS-M1 | Parcial: lote sintético, IDs externos e FKs. Obtenção/importação de dados reais, anexos e conciliação operacional M7 não autorizadas |

## Jornada consolidada em C3

Um paciente e episódio de internação compartilhados entre módulos. Execução explícita, consumo hospitalar com custo, cobertura da execução, item comercial de valor zero, evolução e documento autorizado. O documento usa texto de teste informado; não extrai diagnóstico da evolução nem representa um laudo automático. O portal recebe somente a versão documental autorizada.

A jornada pode ser repetida com a mesma referência sem duplicar efeitos. Cada requisição é atômica; a sequência inteira não é uma transação distribuída. Falha intermediária preserva comandos já confirmados e permite retomada. Não há compensação automática da jornada, fila de execução do fluxo ou decisão clínica derivada.

Estorno de material devolve saldo e reabre conciliação da execução; a cobertura da execução permanece, pois o ato não foi desfeito. Retificar a execução sinaliza revisão no item comercial. Documento e evolução históricos são preservados; não são corrigidos ou reenviados automaticamente.

## Ordem das próximas entregas

1. **Entregue em C4:** obrigação de fornecedor/despesa, pagamento declarado, liquidação, reversão e correção documental, separadas do recebimento físico. C7 entrega rateio explícito e C8 plano de parcelas; C9 entrega crédito comercial; C10 entrega conciliação declarada de saídas; fiscal e operação real continuam pendentes, sem presumir políticas.
2. **Atualizado em C14:** contrato de acesso V2 dentro de SISTEMA, com ordens, autenticação DEV, sessões e barreiras; etiqueta/leitura e comando C5 preservados como legado. Nova retirada C5 bloqueada. Cliente, Mobile/fulfillment e hardware permanecem etapas próprias.
3. **Entregue em C6:** preços negociados e vínculo explícito entre compra e obrigação. C7 entrega composição/rateio explícito e avaliação por recebimento, preservando histórico e sem presumir tratamento fiscal.
4. **Entregue em C11/C12:** complementos do prontuário, agenda–episódio e auditoria de consultas identificadas. A conferência de pendências antigas revelou refinamentos de correção/vínculos ainda abertos; continuar pelo [inventário consolidado](FECHAMENTO-CICLO-BASICO.md), antes de declarar completude integral. C13 entrega cadastros/acesso, C15 entrega o recorte de correção clínica e C16 o de diárias; C17 concluiu o recorte de correções no financeiro do cliente. Aguardar o delta intermediário conforme pedido de 22/09.

Assinatura válida, autenticação operacional, interfaces, canais reais, homologação, infraestrutura e migração continuam etapas próprias. A verificação geral, carga e instalação vazia serão realizadas depois, conforme o usuário. A existência de uma API ou de teste aprovado não fecha toda a capacidade operacional.


## Estimativa de fechamento do core

C7 entrega a composição explícita de compras/custos prevista no primeiro grupo. C10 conclui a base técnica planejada do grupo financeiro de fornecedores. C11 conclui o grupo de complementos do prontuário. C12 entrega agenda–episódio e auditoria de consultas identificadas. Os grupos planejados têm entregas, mas isso não encerra todos os fluxos funcionais. Casos antigos de correção/vínculos estão no inventário consolidado; a contagem anterior por grupos não era um critério suficiente para declarar o núcleo completo. Método contábil/fiscal real, decisões humanas e operação seguem separados; a conferência geral posterior deverá confirmar essa cobertura.

## Atualização C14: Terminal de Acesso V2

O contrato C5 de nova retirada foi substituído. Ordens/itens, evidência assinada DEV, autenticação, acesso, múltiplas ordens e barreiras têm 13 testes próprios, além de oito legados e 15 da fundação (41 com unitários). 399 operações/242 caminhos. Só ENTRY_CONFIRMED inicia separação; acesso não cria estoque/clínica/cobrança. Picking/fulfillment, correções de movimentos pelo Mobile, identidade real e hardware permanecem funcionais/operacionais futuros, não considerados entregues. [Relatório C14](RELATORIO-C14.md).

## Atualização C15: correção clínica

Correção de executor/versão/programação dentro do mesmo episódio e anulação sem sucessora estão entregues em DEV. Fato imutável, autoria, idempotência, RLS e proteção contra consumo ativo; efeitos derivados sinalizados para revisão sem reescrever documentos ou valores. 12 testes próprios e regressões de clínica/diárias/financeiro/exames/protocolos/prontuário, total 109 com unitários. Transferência entre pacientes, restauração, identidade/assinatura profissional e decisões operacionais continuam pendentes. [Relatório C15](RELATORIO-C15.md).


## Atualização C16: correção de diárias

Associação e período admitem cancelamento ou correção por sucessora no mesmo episódio. Reservas, cobertura e documentos financeiros ativos exigem compensações explícitas; sobreposição entre intervalos vigentes é protegida no banco e na API. 15 testes próprios, total de 68 no recorte, e demonstração repetida sem duplicação. Classificação, restauração, migração retroativa em lote e regularização comercial após cancelamento continuam pendentes. Próxima frente: correções no financeiro do cliente. [Relatório C16](RELATORIO-C16.md).


## Atualização C17: correções do financeiro do cliente

Depósito/extrato admitem cancelamento e correção por sucessora na mesma unidade, após reversão explícita das dependências. Conciliação/alocação podem ser refeitas pelo último vínculo revertido do mesmo par; referências históricas continuam protegidas. 17 testes próprios e regressões de financeiro/correções de diárias, total de 56 com unitários; seed repetido sem duplicação. Integração bancária, estorno real, chargeback, correção de parcelas, restauração e políticas operacionais continuam pendentes. [Relatório C17](RELATORIO-C17.md). Parada para delta intermediário, sem iniciar a próxima frente.
