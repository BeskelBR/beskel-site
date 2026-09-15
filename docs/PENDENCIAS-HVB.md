# Pendências — HVB Sistema M0/M1 + M2 + M3 + M4 + M5 + M6A + M6B + M6C

M0/M1 foi limitado à fundação local com dados fictícios. As decisões abaixo não bloqueiam o desenvolvimento independente já validado.

| Item | Classificação | Quando precisa fechar |
|---|---|---|
| Papéis, poderes e unidades reais | PENDENTE, configuração hospitalar | Antes de contas e operação reais; perfis do seed são PROPOSTOS |
| Login humano, emissão/renovação/recuperação de credenciais, MFA/step-up e limites de abuso | PENDENTE, etapa de autenticação operacional | Antes de expor a API; M1 usa tokens opacos provisionados por administrador DEV |
| Retificação de cadastros/fatos encerrados, remoção de atribuições e alteração de capacidade/local com histórico | PENDENTE, casos de uso posteriores | Antes de uso assistencial; não executar SQL manual para contornar preservação |
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
| Contratos mínimos para retomar Terminal | PENDENTE após recorte de M2 | Terminal permanece congelado; Fundação não autoriza sua alteração |
| Migração real, exportação de legado, integrações e dados hospitalares | EXIGE NOVA AUTORIZAÇÃO | Nenhuma atividade desse tipo foi executada |
| Nuvem paga, DNS, site, produção, fiscal, pagamentos, mensageria | EXIGE NOVA AUTORIZAÇÃO | Não provisionado nem acionado |

Plano próprio e Petlove permanecem fora do escopo. O modelo histórico não é regra operacional aprovada. Nenhuma pendência foi resolvida automaticamente a partir dos nomes dos perfis, produtos, pessoas ou documentos observados na auditoria.

## Continuação M2 — 13/09/2026

As linhas anteriores foram preservadas para resolução conjunta, conforme solicitado. O mecanismo técnico de inventário, lotes, conversão, reservas, custos declarados e custódia do tutor foi entregue no recorte M2; seus dados e políticas operacionais continuam pendentes. Os contratos persistentes de estoque permitem avaliar futuramente a retomada do Terminal, sem autorizar alterações naquela pasta ou branch.

| Item novo ou refinado | Estado atual | Quando precisa fechar |
|---|---|---|
| Catálogo real, fatores, dimensões, concentração e saldo inicial | PENDENTE; somente exemplos fictícios, conversão declarada na mesma dimensão; concentração/dose não modelada | Antes de cadastrar materiais reais ou migrar estoque |
| Validade por data, fuso e regra após abertura | PROPOSTO DEV; retirada exige validade conhecida/isenta e recipiente utilizável; nenhum prazo inferido | Validar critério operacional de vencimento e responsáveis antes de uso real |
| Transferência entre unidades hospitalares | PENDENTE; movimento atual exige mesma unidade | Antes de logística entre unidades e autorização em ambas |
| Abertura/fracionamento, troca de recipiente ou de custódia | PENDENTE; recipiente aberto pode ser declarado na entrada, mas não há transformação de posição existente | Antes de fracionar estoques já recebidos ou transferir propriedade |
| Expiração automática e efetivação parcial de reservas | PENDENTE; expiração explícita, efetivação integral e limite provisório DEV de 24 horas | Antes de depender de liberação automática; reserva vencida continua protegendo saldo até comando |
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
| Retificação de executor, versão ou programação incorretos e anulação de ato registrado por engano | PENDENTE; retificação atual preserva versão/programação e exige estornar consumo ativo antes | Antes de documentação clínica real; não apagar fatos nem inventar aplicação compensatória |
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
| Cancelamento/correção de associação, período e classificação | PENDENTE; associação e período imutáveis; classificação só admite encerramento único; reavaliação preserva histórico | Definir fatos compensatórios, mudanças retroativas e migração entre pacotes |
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
| Depósito, extrato e conciliação | PROPOSTO DEV; dados fictícios manuais, mesma conta/adquirente, alocação parcial/múltiplas parcelas, evidência humana | Integração/extrato real exige autorização; divergência permanece saldo aberto; um vínculo por par, reabertura do mesmo par após reversão e correção de depósito/extrato exigem fluxo futuro |
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
| Correção e invalidação | PROPOSTO DEV; sucessor único, interna segue retificação clínica | Definir invalidação sem sucessor, ajuste de metadados mantendo execução e mudança de origem; não fabricar eventos compensatórios |
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
| Terminal/NFC | FALTA FUNCIONAL em SISTEMA para C5 | Consolidar contrato/simulação de leitura e confirmação; não editar Terminal ou assumir leitor/rede reais |
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
