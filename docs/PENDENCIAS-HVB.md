# Pendências — HVB Sistema M0/M1 + M2 + M3

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
