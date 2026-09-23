# Pendências — HVB Sistema M0/M1 + M2 + M3 + M4 + M5 + M6A + M6B + M6C

Atualização de publicação em 22/09/2026: C8–C18 e o frontend MVP 8 foram publicados em `hvb-sistema-dev`, SHA remoto confirmado `bea6df2c8c1d4d6f741e965fe6a1726c62bda4fa`. As menções anteriores a lotes locais/bloqueio Git são registros históricos superados, não pendências ativas. Evidência e baixa específica em [PENDENCIAS-RESOLVIDAS-C18.md](PENDENCIAS-RESOLVIDAS-C18.md). Validações operacionais continuam pendentes. A sequência vigente está no [plano da semana](PLANO-ENTREGA-SEMANA.md).

M0/M1 foi limitado à fundação local com dados fictícios. As decisões abaixo não bloqueiam o desenvolvimento independente já validado.

| Item | Classificação | Quando precisa fechar |
|---|---|---|
| Papéis, poderes e unidades reais | PENDENTE, configuração hospitalar | Antes de contas e operação reais; perfis do seed são PROPOSTOS |
| Login humano, emissão/renovação/recuperação de credenciais, MFA/step-up e limites de abuso | PENDENTE, etapa de autenticação operacional | Antes de expor a API; M1 usa tokens opacos provisionados por administrador DEV |
| Retificação de cadastros/fatos encerrados e governança | PARCIAL: C13 entrega cadastros básicos, revogação de atribuições e capacidade; C15 entrega correção/anulação clínica no mesmo episódio | Restam limites específicos dos lotes C13/C15 e correções de outros módulos; antes de uso assistencial, sem SQL manual para contornar preservação |
| Regra de episódios simultâneos do mesmo paciente | PENDENTE | Antes de operação clínica; episódios não são fechados/unificados por inferência |
| Catálogo completo de espécies, raça e dados cadastrais mínimos | PROPOSTO/PENDENTE | Próximo refinamento; catálogo atual é sintético e reduzido |
| Matriz física de locais, capacidade e vagas | PENDENTE | Antes de ocupação real; capacidade é informada explicitamente |
| Consumidores externos, recuperação manual de outbox e dono operacional da pendência | PENDENTE | Antes de integrações; consumidor atual é local, sem envio |
| Anexos, gestão de metadados, retenção, autorização de leitura e verificação de conteúdo | PENDENTE | Módulo documental; M1 entrega somente contrato/adaptador privado |
| Linux/Docker e GitHub Actions | NÃO VALIDADO NESTE HOST | Configuração entregue; runner não disparado; caminho Windows nativo validado |
| PostgreSQL sob OneDrive | LIMITAÇÃO DO DEV | Todos os arquivos ficam em SISTEMA conforme autorização. Não usar sincronização de pasta como backup consistente de banco ativo; revisar local de dados e backup antes de homologação |
| Governança de logs, retenção, testes de restauração, RPO/RTO e contingência | PENDENTE | Antes de produção; metas do pacote não viraram SLA |
| Diárias, medicamentos incluídos, limites, tempo, preços e exceções | PENDENTE, fora de M0/M1 | Não ativar regra comercial ambígua; validar com equipe responsável |
| Inventário, lotes, apresentações, conversões, custos e material do tutor | PENDENTE, M2 | Exige próximo lote; não presumir informação pelo nome |
| Migração real, exportação de legado, integrações e dados hospitalares | EXIGE NOVA AUTORIZAÇÃO | Nenhuma atividade desse tipo foi executada |
| Nuvem paga, DNS, site, produção, fiscal, pagamentos, mensageria | EXIGE NOVA AUTORIZAÇÃO | Não provisionado nem acionado |

Plano próprio e Petlove permanecem fora do escopo. O modelo histórico não é regra operacional aprovada. Nenhuma pendência foi resolvida automaticamente a partir dos nomes dos perfis, produtos, pessoas ou documentos observados na auditoria.

## Continuação M2 — 13/09/2026

Registro histórico M2: as linhas foram inicialmente preservadas para resolução conjunta. C14 retira da lista ativa apenas pendências afetadas comprovadamente resolvidas, com histórico separado. O mecanismo técnico de inventário, lotes, conversão, reservas, custos declarados e custódia do tutor foi entregue no recorte M2; seus dados e políticas operacionais continuam pendentes. C14 entrega a fronteira backend do Terminal de Acesso, sem autorizar alterações naquela pasta ou branch.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Catálogo real, fatores, dimensões, concentração e saldo inicial | PENDENTE; somente exemplos fictícios, conversão declarada na mesma dimensão; concentração/dose não modelada | Antes de cadastrar materiais reais ou migrar estoque |
| Validade por data, fuso e regra após abertura | PROPOSTO DEV; retirada exige validade conhecida/isenta e recipiente utilizável; nenhum prazo inferido | Validar critério operacional de vencimento e responsáveis antes de uso real |
| Transferência entre unidades hospitalares | PENDENTE; movimento atual exige mesma unidade | Antes de logística entre unidades e autorização em ambas |
| Abertura/fracionamento, troca de recipiente ou de custódia | PENDENTE; recipiente aberto pode ser declarado na entrada, mas não há transformação de posição existente | Antes de fracionar estoques já recebidos ou transferir propriedade |
| Expiração automática e efetivação parcial de reservas fora do Terminal | PARCIAL: C18 resolve reserva física protegida, parcial e conclusão após lease no Terminal; M2 genérico mantém expiração explícita/efetivação integral | Definir automação e parciais dos demais fluxos; vencimento não libera saldo de sessão com presença |
| Reserva após reversão de efetivação | PROPOSTO; compensação física não reativa a reserva | Confirmar necessidade de uma nova reserva e fluxo operacional |
| Recontagem, cancelamento de sessão e dupla aprovação | PENDENTE; versão obsoleta bloqueia ajuste e requer nova sessão/contagem, sem apagar a anterior | Antes de inventário operacional; sessão com contagem pendente não pode ser encerrada |
| Retificação de lote, validade, custo e cadastros de estoque | PENDENTE; identidades e snapshots preservados, sem edição destrutiva | Definir fatos compensatórios e autoria antes de corrigir catálogo real |
| Critério de custo médio/FIFO, impostos e valoração contábil | PENDENTE; custo unitário declarado no lote, snapshot no movimento; desconhecido permanece nulo | Antes de relatórios financeiros; custo do material do tutor sempre nulo para o hospital |
| Devolução de material ao tutor e descarte autorizado | PENDENTE; devolução atual compensa movimento entre posições da mesma custódia | Definir saída ao proprietário e evidência de entrega, sem assumir mudança de propriedade |
| Execução, consumo clínico e vínculo com ordem | PENDENTE M3; retirada é somente transferência física identificada | Próximo marco clínico do backlog, mantendo a separação de cobrança |
| Desempenho sob carga representativa, conflitos e rede | PENDENTE; medição local com mil posições, sem SLA | Antes de homologação e dimensionamento; testar diversidade de produtos/lotes e concorrência hospitalar |

Permanecem abertas também as decisões anteriores de autenticação operacional, papéis reais, retenção, backup/restauração, Docker/CI, regras comerciais e integrações. Nenhuma delas foi encerrada apenas porque os testes técnicos do M2 passaram.

## Continuação M3 — 13/09/2026

O usuário solicitou continuidade e informou indisponibilidade para resolver as pendências. Os mecanismos técnicos de ordem, programação, execução e consumo foram implementados com dados sintéticos; as decisões anteriores permanecem registradas acima. O registro de pendências clínicas no banco é um recurso do produto, distinto deste backlog de decisões de projeto.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Papéis clínicos, identificação profissional, assinatura e delegação | PENDENTE; autenticação DEV, autor da conta e confirmação explícita não constituem assinatura clínica operacional validada | Antes de qualquer ato ou prescrição real |
| Catálogo clínico, vias, unidades de dose, concentração e limites | PENDENTE; valores informados explicitamente; não há cálculo de dose ou escolha de tratamento | Antes de uso assistencial e aprovação do catálogo |
| Programação por frequência, suspensão e interrupção de ordem | PENDENTE; horários explícitos, versão nova e não execução individual com motivo | Definir recorrência, destino das programações existentes e limites de automação |
| Execução parcial, conclusão e desvios da quantidade prescrita | PROPOSTO DEV; parcial/integral declarados; uma conclusão ativa por programação; sem cálculo de adequação da dose | Validar semântica de parciais, totais, unidades e revisão profissional |
| Registro tardio, alta retroativa e exceções após alta | PROPOSTO DEV; aceita fato anterior à alta; nova execução posterior ao limite hospitalar é recusada; alta retroativa preserva fatos e gera revisão | Aprovar fluxo assistencial de exceção, sem confundir cuidado domiciliar e hospitalar |
| Sobreposição de ordens | PROPOSTO; alerta por mesmo item/episódio e interseção de vigências, sem excluir ordens | Refinar critérios clínicos; alerta atual não detecta interações medicamentosas |
| Confirmação integral do material efetivamente usado | PROPOSTO; até 20 posições distintas por consumo, um consumo ativo por execução; consumo avulso exige episódio/finalidade/motivo | Definir conciliação parcelada, acréscimos e correções; atual exige estorno integral e novo consumo |
| Evento de referência em clientes/offline | PENDENTE integração; UUID persistente do fato, distinto da chave do comando | Antes de clientes reais; identificadores diferentes não permitem reconhecer automaticamente o mesmo ato sob demanda |
| Validade/custo do material já utilizado | PENDENTE revisão; fato declarado pode conciliar posição com validade problemática, gerando alerta; custo desconhecido continua nulo | Aprovar tratamento da exceção e correção do dado; revisão não inventa validade nem valor |
| Responsável, prazo, prioridade e escalonamento de pendências clínicas | PENDENTE; fila consultável e resolução com autor/motivo, sem notificações externas | Antes de operação da equipe; não atribuir responsabilidade automaticamente |
| Material previsto e substituição de produto | PENDENTE política; associação aprovada/versionada serve como referência, sem seleção ou baixa automática | Validar equivalência clínica, unidades e conferência do material realmente usado |
| Concorrência e orçamento SQL do consumo | INVESTIGADO; lock único por posição no lote; um item vinculado usa 19 statements totais/16 funcionais no ensaio local | Avaliar lote com até 20 posições e carga real; lock de episódio serializa escrita clínica e alta daquele episódio |
| M4/diárias | PENDENTE próximo marco; nenhuma inclusão, franquia, limite ou cobrança presumida | Implementar somente modelo configurável até aprovação das regras reais |

Todas as pendências que dependem de decisão humana permanecem abertas. O seed M3 deixa uma execução simulada com conciliação pendente para exercitar o fluxo; não é uma solicitação operacional à equipe do hospital.

## Continuação M4 — 13/09/2026

As linhas históricas foram preservadas. O mecanismo de diária configurável foi entregue apenas para simulação, sem promover nenhuma proposta a regra hospitalar. O usuário cuidará da configuração de Vercel/Cloudflare; o código segue no GitHub em `hvb-sistema-dev`. O backend atual usa PostgreSQL local; adaptação de hospedagem, banco, worker e autenticação operacional permanece necessária antes de publicação funcional.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Classes, critérios clínicos, faixas de peso e suporte ventilatório | PENDENTE; classificação explicitamente informada, sem cálculo ou recomendação; peso referenciado somente no mesmo episódio | Antes de classificar internações reais; definir validade e reutilização de medições anteriores |
| Janelas, tolerâncias, calendário, fuso e encerramento | PENDENTE; simulação usa intervalo explícito [início, fim), sem tolerância e limite escolhido explicitamente | Aprovar regras de entrada, alta clínica, saída física e permanência administrativa |
| Grupos, medicamentos simples/especiais, prioridades e exceções | PENDENTE; membros tipados e prioridade explícita; empate vira pendência | Conciliar redações divergentes do legado com a equipe, sem associação pelo nome |
| Aprovação de regras operacionais | PENDENTE; endpoint aprova SOMENTE simulação com autoria e confirmação | Definir aprovação hospitalar, papéis, vigência, revisão e ativação segura |
| Administração parcial, unidade clínica e unidade física | PENDENTE; parciais ficam pendentes, administração integral conta uma execução; quantidade física exige produto e unidade base | Validar semântica de parciais/acúmulo, dose e conversões; não inferir equivalência |
| Cobertura física de material do tutor | PENDENTE; fato físico e custo preservados, cobertura permanece pendente | Definir propriedade, serviços associados e efeito comercial sem custo hospitalar inventado |
| Correção de classificação e migração retroativa de diárias | PARCIAL: C16 resolveu associação/período; classificação original só admite encerramento único | Implementar correção de classificação se necessária; definir migração/reavaliação em lote e divisão/fusão sem recalcular efeitos implicitamente; parte resolvida em PENDENCIAS-RESOLVIDAS-C16.md |
| Reservas de diária | PROPOSTO DEV; somente evento já identificado, cobertura integral, até 24h, liberação/expiração explícitas | Definir reserva de planejamento, efetivação parcial e expiração automática; reserva vencida ainda compromete capacidade |
| Revisão de origem/período alterado | PENDENTE fluxo operacional; consulta sinaliza revisão, sem liberação automática da capacidade | Definir responsável, prazo, fila dedicada e efeito sobre outras avaliações; revisar/reverter explicitamente |
| Orçamento SQL e concorrência M4 | INVESTIGADO; avaliação 17/14 statements totais/funcionais e reavaliação 19/16; compromisso é agregado do histórico por uso | Medir histórico longo, muitos grupos/regras e concorrência por episódio antes de homologação; sem SLA local |
| M5 comercial/financeiro | PENDENTE próximo marco; M4 não gera preço, conta, título ou recebimento | Implementar modelo sem ativar políticas ambíguas; validar fontes de preço, exceções e permissões reais |

As pendências antigas e novas serão resolvidas em conjunto. Testes de integridade e aprovação de simulação não encerram decisões clínicas, comerciais ou operacionais.

## Continuação M5 — 13/09/2026

O núcleo comercial/financeiro foi implementado com registros fictícios. As linhas anteriores foram preservadas; mecanismos técnicos não aprovam preços, descontos, cobranças ou poderes reais. Não houve transação bancária, envio, conciliação externa ou emissão fiscal.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Catálogo comercial, tabelas e aprovação de preços | PENDENTE; serviço/produto e preço versionados por unidade, vigência explícita, sem sobreposição | Antes de cadastrar preços reais; composição de conjuntos, materiais previstos e múltiplas tabelas comerciais continuam futuros |
| Origem e quantidade comercial | PROPOSTO DEV; um evento por execução, item de consumo ou período; serviço informado explicitamente, produto confere quantidade física e período conta uma unidade | Validar mapeamentos, frações, preços por peso e faturamento de composições; não associar por nome |
| Moeda, arredondamento, juros, taxas e impostos | PENDENTE; BRL, centavos exatos; produto quantidade/preço inexato é recusado | Aprovar regra de arredondamento e ajustes antes de valores reais; não calcular imposto ou juros por inferência |
| Pagador, responsabilidade e desconto | PENDENTE; pagador referencia responsável cadastrado; até 20 responsabilidades explícitas por item; motivo e autorização DEV | Validar poderes, aceite de dívida, descontos e eventual terceiro pagador; sem plano próprio/Petlove |
| Diária comercial | PENDENTE regra real; inclusão simulada preserva item zero sem título; conflito, parcial/excedente, tutor e execução parcial permanecem pendentes | Conciliar regras HVB e precificação; não há cobrança automática de excedente |
| Correção de documentos e origem substituta | PROPOSTO DEV; reverter liquidações/título/item antes de reavaliar ou faturar substituto; histórico preservado | Definir documentos de ajuste, cancelamento fiscal e correções de consumo avulso sem execução compartilhada; origens novas sem linhagem não são deduplicadas por semelhança |
| Título, vencimento e parcelamento | PENDENTE política; até 20 alocações explícitas por título, sem duplicar responsabilidade | Definir calendário, juros, renegociação, abatimento e cobrança; títulos não bloqueiam alta |
| Formas de recebimento e evidências reais | PENDENTE; dinheiro, transferência e cartão declarados, referência UUID persistente; sem integração ou forma versionada de provedor | Antes de receber pagamentos; idempotência de referência depende de o cliente preservar o ID do mesmo fato |
| Crédito de cliente | PROPOSTO DEV; somente saldo não alocado de recebimento do mesmo pagador/unidade; aplicação imediata atômica | Definir crédito reconhecido sem recebimento, reserva futura, devolução efetiva, transferência e tratamento de legado |
| Caixa e conferência | PENDENTE processo; abertura, entradas em dinheiro, contagem e diferença explícitas; uma sessão aberta | Definir suprimento, sangria, saídas, ajustes de sessão fechada, revisão/dupla aprovação e responsáveis |
| Adquirente, taxas e parcelas | PENDENTE regras; bruto/taxa/líquido e datas informados por parcela; repasse separado da quitação do tutor | Validar taxas reais, antecipação, chargeback, estorno e diferença de repasse; recebimento com parcela registrada não pode ser revertido pelo fluxo simples |
| Depósito, extrato e conciliação: operação real | PARCIAL: C17 entregou revisão/cancelamento de origem e refazer conciliação/alocação com predecessor após reversão; dados continuam fictícios/manuais | Homologar fonte bancária, importação, evidências, alçadas e divergências; parte técnica resolvida em PENDENCIAS-RESOLVIDAS-C17.md |
| Despesas, compras, contas a pagar, comissões e fiscal | PENDENTE refinamento posterior; este recorte entrega recebíveis e repasses | Validar processos reais; nenhuma obrigação fiscal ou contábil inferida |
| Relatórios e revisão comercial | PENDENTE apresentação operacional; consultas mostram valores originais, reversão, saldos e revisão por origem/cobertura | Definir indicadores, regime, período, fila agregada e responsáveis; filtrar reversões explicitamente, não somar saldos históricos como dívida atual |
| Concorrência e desempenho financeiro | INVESTIGADO; advisory lock por organização/unidade; avaliação usa 14 statements totais/11 funcionais no benchmark | Medir muitas unidades/pagadores, história longa, muitos rateios e contenção; metas locais não são SLA |

Vercel/Cloudflare continuam a cargo do usuário; banco, autenticação, worker e hospedagem funcional ainda dependem das decisões já registradas. M6 é o próximo marco do backlog, sem encerrar as pendências M0–M5.

## Continuação M6A — 14/09/2026

Primeiro recorte M6 entregue em simulação: exames e resultados. As linhas históricas e decisões anteriores foram preservadas para resolução conjunta. Nenhum catálogo, referência ou poder profissional real foi aprovado por esta implementação.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Catálogo técnico, laboratório, método e material | PENDENTE; estrutura versionada, imutável e aprovada somente em simulação | Validar catálogo real, associação clínica e versões por unidade; identificação externa é declarada |
| Atributos, unidade e referência clínica | PENDENTE; tipo e unidade textual explícitos; até 100 atributos, referências versionadas | Aprovar fonte, método, laboratório, limites e unidades; sem interpretação automática ou conversão |
| Espécie, idade e seleção de referência | PROPOSTO DEV; associação explícita; espécie confere e faixa etária exige idade informada compatível | Definir fonte/instante da idade, tratamento de estimativas e referências sobrepostas; nenhuma referência é escolhida automaticamente |
| Coleta interna e material usado | PROPOSTO DEV; execução integral ativa identificada do mesmo episódio/horário | Validar associação semântica do procedimento ao exame; não cria execução, consumo ou cobrança |
| Coleta externa e proveniência | PENDENTE validação; coletor e evidência declarados, sem usuário fictício | Definir confirmação externa, importação documental e integridade de anexos |
| Amostra, rejeição e correção | PROPOSTO DEV; decisão única, nova coleta preserva rejeição | Definir correção da aceitação/rejeição, amostra compartilhada e cadeia de custódia; o fluxo atual não altera decisão antiga |
| Resultado não obtido ou referência pendente | PENDENTE política clínica; ausência explícita e confirmação das pendências para liberar | Aprovar quem pode liberar e como comunicar limitações; campo obrigatório omitido bloqueia liberação |
| Correção, cancelamento e invalidação | PROPOSTO DEV; versão esperada, rascunho separado da publicação e hash anterior preservado | Definir invalidação de laudo publicado e sua comunicação; cancelamento simples só antes da primeira liberação |
| Assinatura profissional e documento | PENDENTE; autoria DEV e hash técnico, sem assinatura profissional validada | Validar poderes, identificação profissional, assinatura exata por versão e verificação; declaração legada não vira assinatura |
| Laudo visual, anexos e entrega | PENDENTE; consulta restrita de JSON técnico por resultado | Criar apresentação, armazenamento privado de anexos e fluxo de entrega aprovado; nenhum envio ou portal ativado |
| Desempenho M6A | INVESTIGADO; três valores usam 15/12 statements totais/funcionais; trava de episódio e item | Medir painéis de 100 valores, histórico longo e carga concorrente; números locais não são SLA |
| Demais recortes M6 | PENDENTE; protocolos preventivos, documentos gerais, agenda, portal/comunicação e interface | Seguir backlog sem assumir políticas hospitalares; migração real/M7 exige autorização específica |

Vercel, Cloudflare, hospedagem funcional, banco, autenticação e worker continuam com as pendências anteriores. Não houve infraestrutura externa paga, acesso ao SimplesVet, dados reais ou alteração de outras pastas/branches.

## Continuação M6B — 14/09/2026

Protocolos preventivos entregues em simulação. Pendências anteriores preservadas. Nenhuma regra clínica, produto, dose, equivalência ou poder profissional foi aprovado implicitamente.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Protocolos e etapas reais | PENDENTE; versão e etapas imutáveis, espécie confere, aprovação somente simulação | Validar elegibilidade, produtos, doses, intervalos, contraindicações e responsáveis profissionais |
| Recorrência em dias e calendário | PROPOSTO DEV; âncora original, mês curto ajusta ao último dia válido; sem acumular deslocamento | Aprovar regra hospitalar, fuso, datas especiais e alteração de âncora; não inferir equivalência entre dias/meses |
| Geração de próximas ocorrências | PROPOSTO DEV; comando explícito por etapa/sequência/data, validação no banco, limite 1.000 sequências e horizonte 2020–2100 | Definir lote, agenda automática, gatilho após aplicação e deslocamento por atraso; nenhum agendamento externo foi criado |
| Adesões simultâneas e substituição | PENDENTE política; adesões distintas coexistem; sucessor ativo do mesmo paciente com motivo | Detectar duplicidade clínica e definir migração de ocorrências; nenhum protocolo é equivalente por nome |
| Atraso, tarefas e reabertura | PROPOSTO DEV; situação derivada por fuso, revisão e resolução explícitas, uma por ocorrência | Definir responsável/prazo, varredura automática, reabertura e escalonamento; revisão não cria aplicação |
| Reprogramação, suspensão e não realização | PENDENTE; planejamentos preservados, encerramento da adesão impede novos | Definir fatos compensatórios e cancelamento individual sem apagar histórico |
| Aplicação interna e identidade profissional | PROPOSTO DEV; mesmo ID da execução integral ativa; confere item, paciente e horário | Validar adequação clínica, assinatura profissional e atribuição de autoria; confirmação DEV não é assinatura assistencial |
| Aplicação externa | PENDENTE verificação; profissional, lote e fabricante declarados, sem execução/consumo HVB | Aprovar evidências, anexos e reconhecimento de aplicações externas; declaração não é verificação do prestador |
| Correção e invalidação preventiva | C15 permite anular origem clínica interna; aplicação perde vigência sem ser apagada. Correções externas ainda exigem sucessora | Restam invalidação externa sem sucessor, ajuste de metadados mantendo execução e mudança de origem; não fabricar aplicações compensatórias |
| Lote/fabricante e consumo físico | PROPOSTO DEV; consumo identificado da mesma execução, lote vem da posição, sem segunda baixa | Conciliar divergência entre texto declarado e lote físico; manter custódia do tutor e revisão de estornos |
| Encerramento retroativo conflitante | PENDENTE política; encerramento anterior a aplicação registrada é recusado | Aprovar tratamento da exceção sem apagar aplicações |
| Concorrência/desempenho preventivo | INVESTIGADO; lock por paciente, episódio antes quando há fato clínico; 7/9/9 statements no ensaio | Medir múltiplos pacientes, histórico longo e até 50 etapas por versão; ensaio local não é SLA |
| Documentos gerais, agenda, portal/comunicação e interface | PENDENTE próximos recortes M6 | Seguir backlog, preservando assinatura real, hospedagem e comunicação como decisões específicas |

O usuário pediu economia de cota: [roteiro de chat e testes](ROTEIRO-CHAT-E-TESTES.md) registra a divisão sugerida. Modelo não alterado e nenhum reset de cota consumido. Código segue no GitHub; Vercel/Cloudflare e decisões humanas anteriores continuam pendentes.

## Continuação M6C — 14/09/2026

Documentos gerais em simulação, preservando todas as linhas anteriores. Aprovação técnica não confirma consentimento, identidade profissional, assinatura válida ou entrega real.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Modelos e textos reais | PENDENTE; modelo e campos imutáveis, aprovação somente DEV | Homologar textos, identificação, linguagem, campos e obrigatoriedade por documento; tipo termo não prova consentimento |
| Preenchimento e vínculo ao prontuário | PROPOSTO DEV; campos informados, paciente/episódio tipados, sem inferência clínica | Definir dados automáticos, conferência humana e snapshot de identidade; texto digitado não é validado semanticamente contra o paciente |
| Solicitante e autorização | PENDENTE poderes reais; usuário ou responsável identificado, autorização explícita e prazo | Validar representante, relação, finalidade e evidência; vínculo cadastral não concede acesso automaticamente |
| Renovação, negativa, revogação e cancelamento | PROPOSTO DEV; uma autorização por solicitação e revogação preservada | Definir renovação, reconsideração, cancelamento e delegação sem sobrescrever decisões |
| Público e acesso de operadores | PROPOSTO DEV; interno/responsável na versão, conteúdo tem permissão própria | Homologar escopos, minimização e trilha de leitura; revogação do solicitante não revoga automaticamente RBAC dos operadores |
| Assinatura profissional e aceite | PENDENTE; apenas declaração não verificada com versão/hash/signatário | Validar mecanismo, certificado, identidade, poderes, evidências e verificação; não promover declaração legada a assinatura criptográfica |
| Política de assinatura por modelo | PENDENTE; aprovação de conteúdo não exige assinatura declarada para todos os tipos | Definir documentos que exigem assinatura/aceite antes de entrega e responsáveis pela conferência |
| Arquivos e apresentação | PENDENTE; texto privado no PostgreSQL | Implementar PDF/DOCX, anexos, arquivo privado, verificação de conteúdo e download autorizado; UI deve mostrar texto sem interpretar HTML |
| Entrega e comunicação | PROPOSTO DEV; registro manual simulado, versão e destinatário exatos, autorização vigente | Definir comprovantes reais, múltiplos destinatários, falhas/reenvio e canal; nenhum envio ou integração ativado |
| Correção, prazo e entrega histórica | PROPOSTO DEV; nova versão preserva evidências; rascunho posterior bloqueia nova entrega obsoleta | Definir reabertura de prazo, comunicação de correção e registro tardio anterior à aprovação; não reabrir ou comunicar automaticamente |
| Escala e limites documentais | INVESTIGADO; 50 campos, texto base até 20 mil e final até 120 mil caracteres; trava por solicitação | Medir documentos extensos, histórico e carga concorrente; benchmark local não é SLA |
| Agenda, portal/comunicação e interface | PENDENTE próximos recortes M6 | Seguir backlog sem iniciar produção, migração real ou serviços pagos |

Código segue no GitHub, em hvb-sistema-dev. Vercel/Cloudflare e demais decisões humanas continuam pendentes. Nenhuma pasta externa a SISTEMA ou outra branch foi alterada.

## Continuação M6D — 14/09/2026

Agenda em simulação. Todas as pendências anteriores permanecem registradas; propostas técnicas não aprovam regras hospitalares.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Profissional, equipe, sala e instituição | PROPOSTO DEV; vínculos tipados e usuário ativo | Validar habilitação, membros de equipe, equivalência de recursos e tipo físico do local; instituição não substitui autor clínico |
| Disponibilidade e escala | PROPOSTO DEV; intervalos explícitos e bloqueios revogáveis | Definir escala real, recorrência, feriados, fuso e união de intervalos adjacentes |
| Capacidade e encaixes | PROPOSTO DEV; um compromisso ativo por recurso/intervalo | Aprovar capacidade, sobreposição autorizada, prioridade, fila e conflito do mesmo paciente |
| Recursos entre unidades | PENDENTE; conflito atual dentro da unidade | Definir deslocamento e impedir profissional compartilhado de receber agendas simultâneas em unidades distintas |
| Reprogramação e revisão | PROPOSTO DEV; versões preservadas, disponibilidade retirada não libera reserva | Definir responsáveis/prazos da revisão, reconfirmação e notificações; flag histórica usa disponibilidade atual |
| Transições e retrospectividade | PROPOSTO DEV; sequência, instante ocorrido e autor; passado aceito na simulação | Aprovar registro tardio, correção de chegada, cancelamento após chegada e reabertura de estados terminais |
| Responsável e acesso | PENDENTE poderes reais; responsável indicado não recebe acesso | Homologar vínculo, representação, confirmação e autorização do portal |
| Planejamento versus atendimento | SEPARADO; chegada/conclusão não criam episódio, presença física ou execução | Definir vínculos explícitos com episódio, exame, protocolo e profissional executor |
| Concorrência e desempenho | INVESTIGADO; trava por unidade, mil agendamentos medidos | Medir histórico longo e múltiplas unidades; avaliar trava mais granular sem perder atomicidade |
| Interface e comunicações | PENDENTE; somente API e mapa paginado | Implementar calendário visual e portal; homologar canal e conteúdo antes de qualquer envio |

Código no GitHub; Vercel/Cloudflare ficam com o usuário. Migração real, SimplesVet, dados reais, serviços externos e infraestrutura paga não iniciados.

## Continuação M6E — 14/09/2026

Portal e comunicação em simulação. O usuário prefere concluir o núcleo funcional antes de revisar estas decisões. As pendências anteriores são preservadas; o [roteiro técnico](NUCLEO-FUNCIONAL.md) distingue capacidades ainda a implementar das políticas humanas.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Identidade de portal e poderes reais | PROPOSTO DEV; token próprio, vínculo e concessão explícita por paciente | Homologar identidade, representação, escopo por finalidade/documento, validade e evidência; vínculo cadastral não autoriza sozinho |
| Login, convite e recuperação | PENDENTE; credencial local por hash, validade de sete dias no seed | Implementar autenticação operacional, MFA, emissão/revogação individual, recuperação e limites de abuso antes da exposição |
| Reativação e renovação | PENDENTE; conta/concessão revogada permanece no histórico | Definir sucessor, renovação, reativação e troca de unidade sem sobrescrever fatos |
| Preferências e consentimentos | PROPOSTO DEV; histórico por finalidade, registrado por operador | Validar autoatendimento, evidência e finalidades reais; não converter preferência de canal em consentimento clínico/imagem |
| Contatos e canais | PENDENTE; somente portal_dev, sem contato real | Versionar contato/destinatário, validar canal e custos; não reescrever destinatário de mensagens anteriores |
| Publicação documental | PROPOSTO DEV; versão aprovada exata, público responsável e acesso vigente | Definir assinatura obrigatória, conteúdo permitido e retirada/correção; mensagem antiga fica oculta quando há versão posterior |
| Mensagem de agenda | PROPOSTO DEV; versão exata de paciente e responsável | Definir lembrete, cancelamento e notificação de reprogramação; não copiar observação interna automaticamente |
| Tentativa, retorno e resultado incerto | PROPOSTO DEV; até cinco tentativas, retry só depois de falha conhecida | Integrar consulta/conciliação autenticada com provedor antes de permitir envio real; enviado não implica lido |
| Leitura e auditoria | PROPOSTO DEV; GET não marca lido; logs minimizados | Homologar recibos, trilha detalhada de leitura, retenção e finalidade; leitura não prova aceite |
| Integração documental e worker | PENDENTE; entrega simulada não cria entrega_documento; outbox segue local | Definir fluxo idempotente entre canais/documentos e consumidor real, sem envio implícito pelo worker |
| Desempenho do portal | INVESTIGADO; plano corrigido, mil mensagens com p95 de caixa 15,80 ms | Medir múltiplos responsáveis, cinco documentos extensos, concessões históricas e concorrência; benchmark local não é SLA |
| Interface e publicação | PENDENTE; apenas API local | Implementar experiência visual e homologação após consolidação; Vercel/Cloudflare continuam com o usuário |

Somente SISTEMA e hvb-sistema-dev. Nenhum serviço externo, dado real, SimplesVet, migração ou infraestrutura paga foi acionado.

## Consolidação C1 — 14/09/2026

Compras e recebimento físico integrados em simulação. Pendências anteriores preservadas; a resolução conjunta e a verificação geral permanecem posteriores à consolidação do núcleo.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Identidade e cadastro do fornecedor | PROPOSTO DEV; nome/referência por unidade, imutável | Validar cadastro fiscal, contatos, correção e fornecedores compartilhados entre unidades |
| Pedido e alçadas | PROPOSTO DEV; itens atômicos e aprovação/cancelamento explícitos | Definir orçamento, cotação, alçadas, edição/sucessão e segregação de funções |
| Recebimento parcial e excesso | PROPOSTO DEV; teto por apresentação exata e custódia hospitalar | Aprovar tolerância, substituição, divergência de embalagem e recebimento sem pedido; não inferir conversão |
| Custo e financeiro da aquisição | A IMPLEMENTAR/VALIDAR; custo vem do lote M2, sem título ou pagamento | Completar capacidades de preço/tributos/frete/desconto/contas a pagar conforme escopo e regras; entrada não comprova quitação |
| Documento fornecedor | DECLARADO DEV; referência textual, sem validação fiscal | Definir arquivo, identificadores, duplicidade documental e vínculo fiscal antes de uso real |
| Reversão e devolução comercial | PROPOSTO DEV; reversão física integral libera quantidade, sem crédito | Definir devolução parcial ao fornecedor, compensação financeira e pedido substituto |
| Datas e cancelamento após parcial | PROPOSTO DEV; data ocorrida separada do registro, saldo recebido preservado | Aprovar registro tardio, correções e reabertura sem apagar histórico |
| Volume e verificação geral | ADIADO conforme orientação; recorte pontual aprovado | Medir até 50 itens por pedido/20 entradas por lote, concorrência entre pedidos e executar suíte geral/instalação vazia posteriormente |

Nenhum envio ao fornecedor, pagamento, nota fiscal real, migração ou serviço externo foi acionado.

## Consolidação C2 — 15/09/2026

Pendências anteriores preservadas. A implementação segue antes da discussão conjunta e da verificação geral, conforme o usuário.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Narrativa e responsabilidade profissional | PROPOSTO DEV; tipos simples, autor autenticado e texto completo versionado | Homologar campos, coautoria, profissão habilitada, supervisão e segregação de funções |
| Retificação, invalidação e reativação | PROPOSTO DEV; sucessão explícita sem apagar conteúdo | Definir justificativas, poderes, revisão e política de visibilidade do histórico |
| Datas e registro tardio | PROPOSTO DEV; admissão até saída física, ou alta na ausência de saída, com limites inclusivos | Validar retrospectividade, relato após alta e correção; divergência posterior é sinalizada sem apagar fatos |
| Assinatura e auditoria de leitura | PENDENTE; hash de conteúdo e auditoria dos comandos não equivalem a assinatura válida ou trilha de todas as leituras | Homologar assinatura, retenção, acesso ao texto e auditoria de consulta antes de uso assistencial |
| Linha do tempo e vínculos | PARCIAL; metadados e IDs originais, sem duplicar execução interna | Completar jornadas, vínculos explícitos com episódio e cobertura das transições; não inferir vínculo por proximidade temporal |
| Busca, anexos e modelos clínicos | A IMPLEMENTAR/VALIDAR em recortes próprios | Definir formatos, privacidade, pesquisa e modelos sem transformar proposta em regra |
| Portal e múltiplas unidades | NÃO LIBERADO pelo prontuário; somente permissões da equipe por unidade | Homologar escopos e finalidade antes de qualquer exposição |
| Carga e verificação geral | ADIADO; 34 testes pontuais passaram | Verificar histórico longo, planos de consulta, paginação sob novas inserções, instalação vazia e suíte geral depois da consolidação |

Nenhuma assinatura profissional, execução clínica real, mensagem externa ou configuração Vercel/Cloudflare foi realizada.

## Consolidação C3 — 15/09/2026

Pendências anteriores preservadas. A [matriz de cobertura](COBERTURA-NUCLEO.md) distingue falta funcional de decisão humana, evitando considerar uma capacidade concluída apenas por existir uma entidade.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Retomada de jornadas | PROPOSTO DEV; comandos idempotentes com referência estável | Definir interface de progresso, falha parcial e retomada operacional; não compensar atos clínicos automaticamente |
| Cobertura da execução e material | SEPARADO; custo físico persiste e a cobertura testada é da execução | Homologar o que cada regra inclui; cobertura de serviço não autoriza presumir cobertura de todo insumo |
| Correção clínica e documento já entregue | HISTÓRICO preservado; revisão comercial sinalizada | Definir revisão humana, documento substituto e comunicação autorizada; não alterar nem reenviar por inferência |
| Aquisição/despesas | FALTA FUNCIONAL explícita para C4 | Construir obrigação/pagamento simulado com valores informados; processo real, fiscal e alçadas seguem pendentes |
| Verificação global | ADIADA; nove testes pontuais C3 aprovados | Executar suíte geral, carga, instalação vazia e homologação quando chegar a etapa acordada |

Nenhuma mensagem externa ou assinatura válida foi emitida; Vercel/Cloudflare continuam com o usuário.

## Consolidação C4 — 15/09/2026

Pendências anteriores preservadas; a existência de comandos financeiros simulados não aprova operação, política fiscal ou valores reais.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Documento e correção de obrigação | PROPOSTO DEV; origem textual exata, sucessão após reversão | Homologar identificação fiscal, duplicidade documental, anexos e alteração de fornecedor/origem |
| Reconhecimento de dívida e pedido cancelado | PROPOSTO DEV; dívida explícita, cancelamento sinaliza revisão | Definir poderes e revisão do documento; cancelamento não comprova ausência de obrigação |
| Pagamento e adiantamento | SIMULADO; conta interna e evidência declarada, aplicação separada | Homologar conta/canal real, segregação, disponibilidade, autorização e conciliação bancária |
| Reversões | PROPOSTO DEV; desfazer liquidações antes dos documentos | Distinguir correção de registro, devolução real de dinheiro e cancelamento comercial |
| Preço, fiscal e custo contábil | A IMPLEMENTAR/VALIDAR; valor da obrigação é explícito | Completar preço negociado por item, frete/tributos/desconto/rateio sem inferir custo do lote |
| Parcelas e crédito de fornecedor | A IMPLEMENTAR/VALIDAR; pagamentos parciais existem, sem plano de parcelas ou crédito comercial | Definir cronograma, juros, devolução parcial e compensações |
| Desempenho e operação | ADIADO; 24 testes pontuais passaram | Verificar carga concorrente por unidade, suíte geral, instalação vazia e homologação posteriormente |

Nenhum pagamento real, débito bancário, nota fiscal ou envio ao fornecedor foi executado.

## Consolidação C5 — 15/09/2026

Pendências anteriores preservadas. Terminal físico, hardware e sua branch continuam fora deste lote; a implementação reside apenas em SISTEMA.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Etiquetas e identidade | UUID fictício identifica alvo, sem autenticar | Definir suporte físico, emissão, perda, clonagem, renovação e reassociação; não confiar no UID como segredo |
| Operador e sessão reais | C18 entrega NFC revogável + biometria DEV, dispositivos separados e sessão canônica exclusiva; C14 fica como baseline | Homologar identificação, login/troca de usuário, bloqueio de tela e prazos reais; no contrato v1 NFC simples não é Bearer nem prova biométrica |
| Contexto e retrospectividade | Episódio escolhido e validado no servidor; leitura passada explícita DEV | Aprovar validade temporal da seleção e política de registro tardio |
| Repetição e resposta perdida | Retry/consulta por mesma chave, corpo, operador e dispositivo | Implementar experiência de estado desconhecido e reconciliação; 404 não garante que uma transação concorrente terminou |
| Offline/cache | C14 não concede autorização offline; sensível fail_closed; ocorrida_em e recebimento separados | Projetar Edge/reconciliação e política formal antes de qualquer operação desconectada; não reutilizar confirmação histórica como abertura física |
| Auditoria consultiva | Operador consulta comandos e sessões; auditoria persistente de leituras entregue em C12 e verificada em C14 | Restam suporte/supervisão, consulta de dispositivo desativado, retenção e exportação; auditoria de leitura não permanece falta técnica |
| Equipamento e verificação geral | NÃO EXERCITADOS; 28 testes pontuais de API/banco passaram | Homologar leitor, rede, energia, cliente visual e carga quando chegar a etapa acordada |

Nenhuma etiqueta física gravada, segredo salvo no terminal ou serviço externo acionado.


## Consolidação C6 — 15/09/2026

Pendências anteriores preservadas. Valores comerciais DEV não aprovam política fiscal ou operação hospitalar.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Preço e aprovação | DEV versionado, com autoria e centavos exatos | Definir alçadas, aceite do fornecedor e arredondamento; hoje frações de centavo são rejeitadas |
| Documento divergente | Obrigação preserva valor declarado; vínculo explícito limitado | Homologar revisão de divergência, excedente e documento complementar sem corrigir dívida por inferência |
| Fiscal e rateio | Componentes comerciais informados; sem regra tributária/rateio de aquisição | Próximo recorte técnico de composição de custo; política fiscal e método real exigem decisão posterior |
| Versões e reversões | Agregado ativo entre versões; reversão da dívida inativa vínculos | Homologar correção e reconciliação com documento sucessor; sem transferência automática |
| Leitura de saldos | Saldo histórico pode ser negativo; despesas sem pedido não elegíveis | Interface deve distinguir orçamento atual, saldo comercial, dívida e despesa sem vínculo |
| Operação e verificação geral | ADIADAS; 23 testes pontuais passaram | Retomar carga, suíte geral, instalação vazia e homologação após consolidação |

Nenhum pagamento real, alteração fiscal, contato com fornecedor ou serviço externo foi executado.


## Consolidação C7 — 15/09/2026

Pendências anteriores preservadas. O rateio DEV é explícito; não aprova tratamento fiscal, valorização contábil real ou recálculo de consumo.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Critério de rateio | DEV: descrição e valores por item, componentes fechados | Homologar critério, alçadas, natureza dos acréscimos, tributos recuperáveis e documentos comprobatórios |
| Custo analítico versus físico | Separados; movimentos e consumos históricos preservados | Definir método contábil de estoque, corte temporal, ajustes e eventual integração com valorização real |
| Recebimento parcial | Valor explícito por entrada; última quantidade fecha saldo do item | Aprovar distribuição, arredondamento e apresentação da razão valor/quantidade na interface |
| Correção do rateio | Nova versão exige reverter avaliações ativas; histórico preservado | Homologar revisão em lote, ergonomia, responsabilidade e retomada após falha parcial |
| Mudança de preço e estorno físico | Preço posterior sinalizado; entrada revertida inativa custo analítico | Definir revisão fiscal/comercial e crédito/devolução, sem inferência financeira |
| Pedido cancelado ou incompleto | Custos anteriores podem ser registrados; restante continua pendente | Homologar encerramento residual e diferença de aquisição sem apagar fatos |
| Verificação geral e operação | ADIADAS; 32 testes pontuais passaram | Retomar suíte geral, instalação vazia, carga e homologação após consolidação |

Nenhum custo histórico sobrescrito, documento fiscal emitido, pagamento ou contato externo executado.


## Consolidação C8 — 15/09/2026

Pendências anteriores preservadas. O cronograma DEV não aprova condições financeiras nem agenda pagamentos reais.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Plano e alçadas | DEV: valor integral, datas/parcelas explícitas e histórico | Homologar aceite, autorização, número máximo operacional, dia útil, juros/multas e arredondamento |
| Vencimento documental e cronograma | Vencimento original preservado; plano acrescenta datas | Definir data operacional de exigibilidade e apresentação na interface sem apagar o documento |
| Liquidação sem parcela | Visível e sem alocação automática | Definir fila de revisão, importação futura e responsáveis; soma dos saldos de parcelas pode exceder dívida pelo valor ainda sem vínculo |
| Reprogramação | Nova versão exige reverter alocações e depois realocar liquidações | Homologar ergonomia em lote, retomada de falha parcial e evidência do acordo |
| Correção/reversão | Histórico preservado; estorno da liquidação inativa alocações | Distinguir correção de registro, devolução monetária real e renegociação; obrigação corrigida inicia sem plano |
| Complementos financeiros | Crédito comercial e conciliação de saídas ainda faltam | Implementar os próximos recortes sem presumir canal bancário ou compensação automática |
| Operação e verificação geral | ADIADAS; 25 testes pontuais passaram | Retomar suíte geral, instalação vazia, carga e homologação após consolidação |

Nenhum débito agendado, juros calculados, pagamento real ou contato com fornecedor executado.


## Consolidação C9 — 15/09/2026

Pendências anteriores preservadas. Crédito declarado DEV não comprova devolução física, direito ao abatimento ou reconhecimento fiscal.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Origem e documento do crédito | DEV explícito; referência opcional à obrigação e correção encadeada | Homologar documentação, aceite do fornecedor, fiscalização e alçadas |
| Compensação | Apenas aplicação explícita no mesmo fornecedor/unidade | Homologar condições de uso, prazos/expiração e devolução de dinheiro; sem regra presumida |
| Devolução física/comercial | Separada do crédito declarado | Definir evidência e vínculo com retorno material; emissão de crédito não movimenta estoque |
| Fonte da liquidação | Pagamento ou crédito, exclusivamente; mesmo ID nas parcelas | Clientes devem distinguir credito_id e pagamento_id nulo, sem chamar crédito de débito bancário |
| Indicadores booleanos | Corrigidos quatro campos antes serializados como texto | Adaptar consumidores de aquisição/parcelas e validar na interface futura |
| Conciliação de saídas | Próximo recorte técnico | Relacionar pagamento e evidência de extrato sem integração bancária ou baixa inferida |
| Publicação C8/C9 | BLOQUEADA por erro interno da revisão automática, mesmo após autorização | Retomar git add/commit/push somente quando o mecanismo de aprovação estiver disponível; autorização do usuário já registrada |
| Verificação geral e operação | ADIADAS; 37 testes pontuais passaram | Retomar suíte geral, instalação vazia, carga e homologação após consolidação |

Nenhum pagamento real, crédito fiscal emitido, retorno físico automático ou contato externo executado.


## Consolidação C10 — 15/09/2026

Pendências anteriores preservadas. O usuário adiou a resolução de pendências e bloqueios até o fechamento do ciclo básico, com verificações pontuais e sem repetir tentativas de publicação.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Extrato e origem bancária | DEV declarado, separado do extrato de entradas M5 | Homologar fonte real, importação, identificador externo, evidência e retenção |
| Agrupamento e datas | Vínculos explícitos por conta; parcial e múltiplos pagamentos/saídas | Validar critérios operacionais e diferenças entre datas de pagamento, lançamento e valor |
| Tarifas e diferenças | Residual visível, sem atribuição automática | Definir classificação e vínculo a despesa, devolução ou correção com evidência |
| Reversão do pagamento | Inativa vínculo; extrato permanece sem conciliação | Distinguir correção de registro de estorno bancário real e homologar revisão |
| Autorização financeira | Permissões DEV separadas; nenhum débito externo | Aprovar alçadas, segregação, aceite e acesso bancário antes da operação |
| Publicação C8–C10 | ADIADA pelo usuário; erro da revisão automática registrado | Tratar após ciclo básico, sem novas tentativas repetidas agora |
| Verificação geral | ADIADA; 26 testes pontuais passaram | Conferir matriz e executar suíte geral/instalação/carga na etapa consolidada |

### Ordem de resolução após o ciclo básico

1. Bloqueio técnico de publicação e preservação/versionamento dos lotes locais.
2. Decisões de domínio que afetem critérios de aceite (clínica, fiscal, custo, financeiro, acesso e assinatura).
3. Integrações, infraestrutura e experiência operacional, observando dependências e autorizações existentes.
4. Verificação consolidada e homologação, com correções focadas nos resultados.

Esta ordem organiza o trabalho futuro; não autoriza infraestrutura paga, mensagens externas, dados reais ou M7. Nenhum pagamento ou acesso bancário foi executado neste recorte.


## Consolidação C11 — 16/09/2026

Pendências anteriores preservadas. O grupo técnico de prontuário foi implementado em DEV; políticas assistenciais e operação continuam pendentes. Publicação C8–C11 e verificações gerais permanecem adiadas conforme o usuário.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Modelos clínicos | DEV versionado, campos/texto explícitos; versão histórica selecionável | Homologar formulários, aprovação, retirada e uso de versões antigas |
| Anexos pequenos | DEV privado e transacional, até 256 KiB; cabeçalho PDF/PNG/JPEG | Definir armazenamento de maiores, antivírus/sanitização, upload operacional, backup, criptografia e retenção |
| Revogação de anexos | Apenas autor, conteúdo bloqueado na API e bytes preservados | Definir alçada administrativa, retenção legal e eventual descarte autorizado |
| Coautoria | Declaração pessoal sobre versão/hash, sem validade de assinatura comprovada | Homologar papéis profissionais, aceite, coassinatura e assinatura válida |
| Retificações | Anexos/respostas/coautorias permanecem na versão histórica | Definir ergonomia de revisão e eventual novo vínculo explícito sem transferência silenciosa |
| Busca | Lexical em português, por paciente/unidade, sem OCR ou trechos de narrativa | Homologar filtros, volumes, desempenho e experiência de busca |
| Auditoria de leituras e vínculos | Próximo grupo de consolidação | Implementar rastreio e agenda–episódio; conferir faltas da matriz antes do fechamento básico |
| Publicação e verificação geral | ADIADAS; 31 testes pontuais e seed repetido passaram | Retomar na ordem pós-ciclo já registrada, sem retries de Git agora |

Nenhum dado clínico real, serviço externo, assinatura válida, envio de arquivo a terceiros ou infraestrutura paga foi utilizado.


## Consolidação C12 — 16/09/2026

Pendências anteriores preservadas. Relação agenda–episódio e trilha de consultas identificadas foram implementadas; as linhas históricas acima continuam como proveniência, com o estado atual refinado abaixo.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Agenda–episódio | DEV explícito, mesmo paciente/unidade, chegada/conclusão e versão esperada | Homologar alçadas, registro retrospectivo e ergonomia de correção |
| Cancelamento posterior | Inativa vínculo e sinaliza revisão, sem desfazer episódio | Definir responsável e prazo de revisão |
| Auditoria de consultas | DEV: GET/HEAD identificados internos/portal, metadados e recusas de domínio | Homologar finalidade, retenção, suporte, exportação e particionamento/carga |
| Tentativas anônimas e entrega HTTP | Fora da trilha de domínio; logs minimizados existentes | Implementar monitoramento operacional; evento de consulta não comprova leitura humana |
| Disponibilidade da trilha | Falha ao gravar impede liberar resultado | Definir observabilidade, capacidade, recuperação e operação de suporte |
| Correções funcionais antigas | Continuam faltas de software, detalhadas em FECHAMENTO-CICLO-BASICO.md | Consolidar cadastros/acesso, clínica, diárias, financeiro cliente, exames/protocolos e agenda sem presumir decisões hospitalares |
| Publicação C8–C12 | ADIADA, sem nova tentativa de Git | Retomar o bloqueio na etapa definida pelo usuário |
| Verificação geral | ADIADA; 58 testes pontuais e seed repetido passaram | Executar sobre versão consolidada, após fechar funções necessárias |

O inventário não autoriza serviços externos, dados reais, mensagens, assinatura válida ou infraestrutura paga. Nenhuma pendência anterior foi apagada.


## Consolidação C13 — 16/09/2026

Etapa de cadastros/acesso finalizada localmente. Pendências anteriores preservadas; as faltas históricas de correção básica, capacidade e remoção de atribuições têm agora o recorte abaixo implementado.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Dados básicos | DEV: revisão de paciente/responsável/usuário/unidade/dispositivo e nome/capacidade de local | Homologar alçadas, qualidade dos dados e apresentação do histórico |
| Espécie e estado vital | Correção explícita, sem reescrever fatos clínicos/documentos | Definir revisão de efeitos derivados e registro clínico correspondente quando aplicável |
| Capacidade | Redução bloqueada por vaga ainda ocupada; ocupações históricas preservadas | Homologar alterações planejadas e capacidades por vigência; sem recálculo retroativo |
| Atribuições | Revogar/restaurar com histórico; permissões vigentes consultadas sob trava | Aprovar segregação, último administrador, recuperação e mudança das permissões do próprio papel |
| Identidade e estrutura | IDs, pertencimento, fuso e hierarquia preservados | Fusão/deduplicação, transferência entre IDs e alteração estrutural exigem fluxo próprio |
| Contrato de consulta | GET /atribuicoes inclui ativo/versao e conserva concessões revogadas | Consumidores devem distinguir estado atual de origem histórica |
| Reinício local | Cluster existente recuperado pelo PostgreSQL; migrations verificadas | Operação, desligamento, backup/restauração e uso de OneDrive continuam pendentes |
| Continuidade do núcleo | Correção clínica C15, diárias C16 e financeiro do cliente C17 entregues no recorte | Parar após C17 para delta intermediário solicitado em 22/09; inventário posterior preservado |
| Publicação C8–C13 e verificação geral | ADIADAS; 43 testes pontuais e demonstração repetida passaram | Retomar conforme a ordem consolidada, sem novas tentativas de Git nesta etapa |

Nenhum dado real, recuperação de conta operacional, serviço externo ou infraestrutura paga foi utilizado.

## Adequação C14 — Terminal de Acesso V2 — 16/09/2026

Por pedido do usuário, os três registros afetados e resolvidos/substituídos saíram da lista ativa. Descrições anteriores e evidências estão em [PENDENCIAS-RESOLVIDAS-C14.md](PENDENCIAS-RESOLVIDAS-C14.md). Não foi feita baixa global das pendências históricas de outros módulos. A ADR 0024 substitui a fronteira de C5, preservando ADR 0015 e migrations 047/048.

| Pendência restante | Estado atual | Tratamento posterior |
|---|---|---|
| Clientes Terminal/Mobile e correções após retirada encerrada | C18 entrega backend de picking, fulfillment por OR/ajuste e transferência M2; parte técnica arquivada em PENDENCIAS-RESOLVIDAS-C18.md | Implementar clientes quando autorizados; definir compensações logísticas pós-saída e eventual inclusão de material do tutor na sala |
| Classificação hospitalar real e revisão de políticas sensíveis | C18 deriva sensibilidade do catálogo, valida RBAC e faz abertura sob demanda sem segunda autenticação | Aprovar catálogo/papéis reais e processo de revisão versionada das políticas; não há novo step-up dentro da AccessSession v1 |
| Adaptador real de identidade/biometria e provisionamento | C18 separa ACCESS/BIOMETRIC/PICKING/CONTROLLER e vincula cada dispositivo a credencial API; NFC simples revogável e evidência assinada somente DEV | Homologar leitura NFC, face 1:1/PAD, atestação, instalação/rotação/substituição de credenciais e dispositivos, limites de abuso e retenção; DESFire não é requisito presumido deste v1 |
| Intertravamento, sensores e emergência reais | C18 vincula sala/dispositivos, impede sessão física dupla e preserva presença/reserva após timeout; falha de confirmação mantém porta fechada recuperável | Implementar controlador, heartbeat de recovery, evidências reais de porta/trava/presença, perda de sensor, emergência e recuperação supervisionada |
| Abandono/cancelamento durante presença e contexto clínico alterado | C18 mantém reserva e fulfillment por origem; OR pré-entrada expirada pode ser retomada; saída física não é ato clínico | Definir cancelamento em presença, material já retirado, encerramento de episódio durante a sessão e correção posterior; não liberar saldo ou inferir consumo para contornar o caso |
| Correção de rascunho | Itens imutáveis por criação; cancelamento/recriação disponível | Se necessário, acrescentar revisão versionada sem reescrever solicitações ou ampliar autorização vigente |
| Consumidores do endpoint legado | Novas retiradas bloqueadas; GET/histórico e recuperação de comando confirmado preservados | Migrar clientes quando autorizada a etapa do Terminal/Mobile; avaliar remoção futura somente após inventário de uso |
| Homologação e publicação C8–C14 | 41 testes pontuais e demonstração local repetida aprovados; lotes locais | Verificação geral, instalação vazia, carga, cliente, rede/energia e resolução do bloqueio Git permanecem após consolidação do núcleo |

WhatsApp continua somente notificação futura; nenhum canal foi ativado. Sem mudança de pasta/branch Terminal, produção, infraestrutura paga ou dados reais. Continuidade atualizada por C16: correção clínica e associação/período entregues no recorte; próxima frente é o financeiro do cliente.

## Consolidação C15 — Correção clínica — 17/09/2026

A falta técnica M3 de correção de executor/versão/programação e anulação sem substituto foi resolvida no mesmo episódio e saiu da lista ativa. Histórico/evidências em [PENDENCIAS-RESOLVIDAS-C15.md](PENDENCIAS-RESOLVIDAS-C15.md). Demais pendências permanecem abaixo e nos lotes de origem.

| Pendência restante | Estado atual | Tratamento posterior |
|---|---|---|
| Troca de paciente/episódio ou unidade | C15 recusa; correção está confinada ao mesmo episódio | Projetar transferência referenciada com permissões dos dois contextos e revisão dos efeitos; não mover fatos por UPDATE |
| Executor inativo e atribuição profissional | C15 exige usuário ativo da mesma organização; autor da revisão não se confunde com executor declarado | Definir atribuição histórica, validação profissional, ciência, assinatura e alçadas; correção não é assinatura do executor indicado |
| Restauração de anulação e replanejamento | Anulação é fato final; programação sem execução vigente volta a prevista, sem nova tarefa/aplicação | Definir novo fato de restauração se necessário e decisão operacional sobre cancelar/reprogramar; não apagar anulação |
| Efeitos derivados | Cobertura, cobrança, coleta/resultado e aplicação interna indicam origem inválida; valores e documentos preservados | Usar revisões/compensações próprias; não confundir anulação clínica com devolução de estoque, perdão de dívida ou retirada de laudo |
| Revisões temporais e prescrição retroativa | Anulação resolve pendências materiais/temporais da própria execução; correção com sucessora resolve material, preservando outras revisões humanas | Refinar regularização temporal e prescrição quando necessário; não encerrar toda pendência por alteração de contexto |
| Verificação geral e publicação C8–C15 | 109 testes do recorte passaram; seed repetido sem duplicação; alterações locais | Instalação vazia, carga, homologação e bloqueio Git seguem após consolidação; continuidade avançou em C16; próxima frente técnica é o financeiro do cliente |


## Consolidação C16 — Correção de diárias — 17/09/2026

Parte técnica de associação/período resolvida, com histórico em [PENDENCIAS-RESOLVIDAS-C16.md](PENDENCIAS-RESOLVIDAS-C16.md). Não encerra a classificação nem as regras hospitalares reais.

| Pendência restante | Estado atual | Tratamento posterior |
|---|---|---|
| Classificação original e efeitos clínicos | Classificação continua admitindo só encerramento único; período sucessor referencia classificação válida explícita | Projetar retificação/invalidação da classificação com revisão dos efeitos, sem atualizar o fato original |
| Retroatividade e migração em lote | Correção pontual de datas passadas admite regras existentes; efeitos ativos precisam de compensação prévia | Definir divisão/fusão, sequenciamento em lote e reavaliação supervisionada; não copiar limites ou dívida automaticamente |
| Restauração e transferência | Cancelamento final e correção no mesmo episódio/unidade; sem restauração | Criar fatos próprios caso necessários, com permissão de todos os contextos e proteção de dependências |
| Cobrança após cancelar associação | Barreira financeira por histórico de diária/evento de cobertura permanece; não há conversão automática em serviço avulso | Definir decisão comercial explícita de regularização, sem retirar silenciosamente a obrigação de avaliar cobertura |
| Políticas e alçadas de correção | Permissão dedicada, confirmação literal, motivo e autoria em DEV; não equivale a aprovação hospitalar | Homologar prazos, alçadas, revisão humana, operação e apresentação de histórico |
| Verificação geral e publicação C8–C16 | 68 testes pontuais e seed repetido aprovados; lotes locais | Instalação vazia, carga, homologação e bloqueio Git seguem após consolidação; próxima frente: depósito/extrato e conciliação do cliente |


## Consolidação C17 — Financeiro do cliente — 22/09/2026

A parte técnica M5 resolvida saiu da descrição ativa, com histórico em [PENDENCIAS-RESOLVIDAS-C17.md](PENDENCIAS-RESOLVIDAS-C17.md). Etapa encerrada antes do delta intermediário; nenhum módulo seguinte foi iniciado.

| Pendência restante | Estado atual | Tratamento posterior |
|---|---|---|
| Fonte bancária e evidência | Depósito/extrato declarados manualmente em DEV; evidência textual, sem comprovação externa | Homologar importação, identificador do provedor, documentos, retenção e conferência; nenhuma conexão bancária ativada |
| Alçadas e referência histórica | Revisão exige reverter dependências; referência permanece reservada à cadeia, mesmo após cancelamento | Homologar segregação, revisão humana, validade dos documentos e eventual liberação supervisionada de referências |
| Restauração e transferência | Cancelamento final; correção pode mudar conta/adquirente/referência dentro da mesma unidade | Restauração ou transferência entre unidades exige fluxo específico e revisão dos dois contextos |
| Adquirente e caixa | Refazer vínculo não altera recebimento, parcela, taxa nem quitação; restrições M5 preservadas | Estorno real, chargeback, antecipação, correção de parcelas e ajuste de caixa fechado continuam próprios |
| Operação local e credenciais | Cluster existente recuperado; nova credencial administrativa sintética criada após expiração | Backup/restauração, operação em OneDrive, recuperação administrativa e rotação operacional continuam pendentes; não ampliar validade de tokens reais |
| Publicação e verificação geral C8–C17 | 56 testes pontuais e seed repetido aprovados; alterações locais | Retomar bloqueio Git, instalação vazia, carga e homologação na fase organizada já prevista |
| Próxima ação | C17 finalizada | Receber e auditar o delta intermediário antes de retomar exames/protocolos ou outra frente do inventário |

## Delta N1 C18 — Terminal v1 — 22/09/2026

O usuário esclareceu expressamente que o congelamento preserva baseline/histórico, mas permite este delta aditivo. Partes técnicas resolvidas/substituídas saíram das descrições ativas acima; histórico e evidências em [PENDENCIAS-RESOLVIDAS-C18.md](PENDENCIAS-RESOLVIDAS-C18.md). C5/C14 não foram apagados nem convertidos silenciosamente.

| Decisão ou trabalho restante | Estado atual | Tratamento organizado posterior |
|---|---|---|
| Parâmetros hospitalares | Catálogo, sensibilidade, papéis, salas, coordenadas, destino em trânsito e prazos explícitos; cenários sintéticos | Aprovação hospitalar antes de dados reais; 15 segundos é apenas janela DEV, não política definitiva |
| Infraestrutura real de identidade/controlador | Backend e vínculo de credencial entregues; servidor sem adaptador biométrico falha fechado | Escolher/homologar adaptador e provisionamento, sensores, atestação, renovação e operação do kiosk |
| Offline/Edge e emergências | Nenhuma autorização offline permissiva; envelopes e replay preservam fatos; presença não expira destrutivamente | Decisão humana sobre continuidade física segura, alimentação/rede, saída de emergência e supervisão |
| Evolução de configuração e correções logísticas | Configurações/fatos imutáveis no recorte; correção de último item antes da saída entregue | Revisões de política/provisionamento e compensação após sessão encerrada, incluindo retorno físico e tutor |
| Interface e consumidores | Frontend administrativo MVP 8 integrado; proxy e consultas verificados em HTTP; contrato Terminal publicado | Completar jornada de escrita e validar navegador no Sistema; clientes físicos continuam em autorização própria |
| Validação geral C8–C18 | Publicação resolvida; 78 testes pontuais C18 e 35 operações adicionadas preservando anteriores | Instalação vazia, carga, suíte geral e homologação continuam pendentes; priorizar verificação integrada da jornada da semana |
| Continuidade do núcleo | Delta Terminal v1 backend encerrado e publicado | Prioridade atual: jornada utilizável do plano da semana; não declarar todo o núcleo concluído nem reabrir faltas técnicas comprovadamente resolvidas |

Nenhuma decisão de hardware, infraestrutura paga, Supabase, Vercel, Cloudflare, migração real ou publicação foi tomada por inferência.
