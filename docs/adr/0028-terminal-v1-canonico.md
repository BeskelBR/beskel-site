# ADR 0028 — Terminal v1 canônico, delta N1 C18

Data: 22/09/2026. Estado: aceito para implementação local do contrato N1 explicitamente autorizado pelo usuário.

## Supersessão

Esta ADR **supersede funcionalmente a ADR 0015 para o Terminal de Acesso v1** e a fronteira da ADR 0024 que deixava picking/fulfillment para uma API futura. ADRs 0015/0024, migrations 047/048 e 065/066 e seus fatos permanecem íntegros como histórico/legado. Não se converte `etiqueta_terminal` em credencial de funcionário nem se migram silenciosamente as antigas ordens para o novo fluxo.

A autorização N1 permite entidades, migrations, serviços, contratos e testes novos em SISTEMA/hvb-sistema-dev. Não autoriza outras branches/pastas, hardware, nuvem, deploy ou dados reais.

## Decisão

O namespace `/v1/terminal/v1` e as entidades `tv1_*` implementam o contrato atual. O primeiro `v1` versiona a API geral; o segundo identifica o contrato Terminal fornecido. As rotas antigas continuam independentes. O backend é autoridade para identidade, contexto, checklist, alocação, estado físico conhecido, fulfillment e razão de estoque.

O funcionário é identificado por uma NFC revogável e autenticado por desafio biométrico 1:1 com liveness. A leitura válida produz `NFC_VALIDATED` e `BIOMETRIC_REQUESTED` na mesma transação. Uma evidência válida produz `BIOMETRIC_VALIDATED` e AuthSession. O simulador HMAC local é injetado explicitamente; o servidor normal não o instala e recusa nova autenticação sem adaptador. Nenhuma imagem, template biométrico, assinatura completa ou tag bruta é persistida em eventos/listagens.

Cada dispositivo é vinculado a uma credencial API existente, sala e papel. `x-device-id` precisa corresponder à credencial autenticada. ACCESS, BIOMETRIC, PICKING e CONTROLLER são dispositivos distintos, com credenciais distintas. O tablet interno consulta automaticamente a sessão ativa da sala; IDs de sessão não são segredos nem conferem acesso.

A OR é logística e distinta de `ordem` clínica. Seus itens preservam produto, quantidade e, quando fornecidos, versão de ordem e programação do mesmo episódio. Ajustes ao vivo aceitam somente produto/quantidade. Sensibilidade vem de política de catálogo imutável, administrada separadamente. Políticas reais e sua futura revisão continuam pendentes; não se deduz sensibilidade do nome.

Coordenadas existem livres. A ocupação liga uma coordenada a uma posição M2 e, por ela, ao lote/recipiente/custódia. O responsável seleciona a coordenada oferecida pelo servidor. Neste recorte, a sala usa custódia hospitalar; material do tutor continua no M2 e não é automaticamente misturado à sala. A alocação usa validade, recebimento, UUID de lote e posição. A divisão inicial entre lotes produz tarefas com fontes e quantidades exatas.

No `Não encontrei`, a divergência preserva tentativa/lote/coordenada e libera a reserva daquela tentativa. O servidor exclui todos os lotes já falhos e procura um único candidato com saldo integral. Sem esse candidato, permanece EXCEPTION: pode oferecer a quantidade disponível de um único lote elegível, em FEFO/FIFO, para aceitação explícita PARTIAL, ou registrar UNAVAILABLE. Não soma alternativas menores em fragmentação tardia. O cliente não informa lote, posição ou quantidade final arbitrária. A distribuição parcial consome as fontes na ordem confirmada do contexto: ORs e seus itens, depois ajustes.

As reservas são as de M2. Durante sessão física ativa, endpoints M2 não podem liberar/expirar suas reservas. Timeout pré-entrada encerra e libera; timeout após entrada produz alerta e preserva presença, exclusividade e saldo. A avaliação ocorre em comandos físicos/picking/recovery e na tentativa de criar sessão; o controlador deverá chamar recovery periodicamente. GET é consultivo e não cria fatos. Nenhum worker offline ou abertura autônoma foi ativado.

A janela de desbloqueio sensível é configurável por sala (15 segundos somente no cenário DEV). Permissão não abre armário. Picking sensível exige evidência de abertura; picking comum fica suspenso enquanto a fase sensível está ativa. Fechamento e confirmação de trava são fatos separados. Vencimento de janela não comprova trava: recovery registra alerta e aguarda fechamento/trava do controlador.

Após PRESENCE_CLEARED, checklist é imutável. DOOR_CLOSED é persistido antes de um savepoint de confirmação automática. Sucesso registra transferências `retirada`, fulfillment, WITHDRAWAL_CONFIRMED e CLOSED na mesma transação. WITHDRAWAL_CONFIRMED é uma transição auditada; o snapshot terminal é CLOSED. Falha reverte somente a confirmação, preserva a evidência física e deixa READY_TO_CONFIRM para recovery. Não exige repetir a retirada.

Reserva original pode vencer durante presença prolongada. Sob locks das posições, a confirmação libera a original e cria/efetiva uma reserva do valor confirmado, sem alterar o prazo histórico. O movimento M2 referencia essa reserva; a associação da tarefa referencia a tentativa original. Não há segundo saldo ou razão paralelo.

## Garantias e limites

RLS forçada, FKs compostas, eventos imutáveis, locks, índice único de sessão ativa e guardas de composição/conservação protegem o modelo. Todos os comandos usam idempotência recursiva existente. Eventos externos possuem referência independente, corpo canônico, dispositivo e horário preservados; repetição não duplica efeitos.

RETIRAR continua distinto de EXECUTAR, CONSUMIR e COBRAR. Nenhuma retirada gera execução, consumo, débito, recebimento ou conciliação clínica/financeira.

Permanecem separados: implementação dos clientes em suas branches; adaptadores e atestação reais; contingência/saída de emergência; Edge/offline; parametrização hospitalar; correções após retirada encerrada; tutor na sala; revisão de políticas/provisionamento e homologação. Ver a lista ativa de pendências. Esses limites não são autorização implícita para infraestrutura nem alteração dos baselines.
