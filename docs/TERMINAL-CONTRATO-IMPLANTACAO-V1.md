# HVB Terminal — Contrato de Implantação v1

Status: **CANDIDATO / depende do projeto executivo físico**

Este documento define a fronteira entre o software funcional já fechado e os adapters que serão implementados após a visita técnica.

## 1. Terminal de Acesso Android

Responsabilidades:

- leitura da NFC TAG simples;
- captura de face 1:1 + liveness;
- exibição de ORs;
- criação/recuperação da AccessSession;
- exibição do estado físico;
- operação em Android Dedicated Device / Kiosk.

A TAG identifica apenas uma credencial revogável. Permissões não residem na TAG.

## 2. Controlador local

O controlador é a autoridade sobre I/O físico. O navegador/tablet não aciona relé diretamente.

Entradas mínimas previstas:

- sensor da porta principal;
- sensor de presença;
- sensor do compartimento sensível;
- entrada de saída/emergência conforme solução física.

Saídas mínimas previstas:

- comando da porta principal;
- comando do compartimento sensível, acionado somente sob demanda durante AccessSession autorizada.

## 3. Eventos físicos

Contrato mínimo:

```text
ACCESS_GRANTED
DOOR_OPENED
PRESENCE_CONFIRMED
DOOR_CLOSED
```

Para sensíveis, o projeto físico deve distinguir autorização/comando de abertura do evento comprovado por sensor. O armário não é destravado junto com a porta principal.

## 4. Terminal de Retirada

Responsabilidades:

- recuperar a AccessSession;
- obter checklist do servidor;
- guiar por coordenada;
- registrar confirmação, divergência, redirecionamento, parcial ou indisponível;
- confirmar retirada após fechamento da porta.

O estado do checklist deve ser persistido na API, nunca apenas no navegador.

## 5. Conectividade

Novo acesso sem autorização central: `FAIL_CLOSED`.

Sessão já autorizada:

- controlador deve manter somente o estado mínimo necessário para concluir de forma segura a sessão conforme política Edge;
- eventos offline devem possuir UUID/idempotência, `occurred_at` e origem;
- sincronização posterior não pode duplicar efeitos.

A política detalhada depende do levantamento de rede do HVB e do hardware escolhido.

## 6. API real

O `MockAdapter` será substituído por implementação compatível com o contrato do HVB Sistema. A API real deve persistir pelo menos:

- credenciais;
- evidências de autenticação;
- AccessSession;
- ORs associadas;
- itens/posições;
- picking_state;
- divergências;
- eventos físicos;
- confirmação final.

## 7. Critério de freeze

`TERMINAL_V1_FROZEN` somente após:

- adapters reais integrados;
- persistência PostgreSQL;
- teste de perda/retorno de rede;
- teste de reinício dos tablets;
- teste de porta/sensores;
- teste de credencial revogada;
- teste de usuário sem permissão sensível;
- teste de material não encontrado;
- teste de recuperação da sessão;
- homologação presencial do fluxo completo.


## 8. Contrato de estoque e alocação

A API real deve tratar coordenada como atributo da **ocupação do lote**, nunca do cadastro do produto.

Modelo mínimo:

```text
product
→ stock_lot
→ stock_position_occupancy
→ stock_location
```

No recebimento:

```text
novo lote
→ conferência de produto/lote/validade/quantidade
→ sistema oferece posições livres compatíveis
→ responsável do estoque confirma a coordenada usada
→ ocupação fica vinculada ao lote
```

Na retirada:

```text
demanda de produto
→ lotes elegíveis
→ FEFO
→ FIFO em empate
→ tarefas físicas por lote/coordenada
```

A alocação pode fragmentar uma solicitação em mais de uma tarefa quando o primeiro lote não possuir saldo suficiente.

Cada tarefa deve carregar no mínimo:

- `picking_task_id`;
- `product_id`;
- `stock_lot_id`;
- `lot_code`;
- `expires_at`;
- `location_code`;
- `quantity`;
- `sources[]` preservando OR/ajuste de origem.

A implementação real deve reservar saldo transacionalmente para impedir dupla alocação concorrente. O mock atual valida a semântica FEFO/FIFO, mas não substitui a reserva PostgreSQL de produção.


## 9. Sessão de medicação sensível

Quando a AccessSession contém medicação sensível e o funcionário possui permissão, a API registra elegibilidade, não abertura antecipada.

Contrato mínimo:

```text
SENSITIVE_ACCESS_ELIGIBLE
SENSITIVE_ACCESS_REQUESTED
SENSITIVE_ACCESS_GRANTED
SENSITIVE_DOOR_OPENED
SENSITIVE_DOOR_CLOSED
SENSITIVE_LOCK_CONFIRMED
SENSITIVE_ACCESS_COMPLETED
```

Regras:

- sem segunda autenticação NFC/biométrica;
- solicitação parte do Terminal de Retirada;
- abertura física deve vir de controlador/sensor confiável;
- autorização de abertura possui janela curta;
- picking sensível só é permitido enquanto o sensor indicar armário aberto;
- picking comum fica suspenso durante a sessão sensível ativa;
- fechar o armário com pendências permite nova abertura posterior na mesma AccessSession;
- `PICKING_READY` exige o armário fechado e a trava confirmada;
- a abertura da porta principal jamais implica abertura do armário sensível;
- cada abertura deve ser auditável por AccessSession, usuário, dispositivo, instante e número da abertura.

A duração definitiva da janela de destravamento será parâmetro do controlador no projeto executivo. O mock usa 15 segundos apenas como contrato DEV.


## 10. Automação de interação do operador

O contrato de implantação deve eliminar três interações que pertencem apenas ao protótipo:

### Autenticação

```text
NFC_VALIDATED
→ iniciar câmera/biometria automaticamente
→ BIOMETRIC_VALIDATED
→ carregar contexto de retirada
```

Não deve existir botão intermediário para iniciar biometria.

### Terminal de Retirada

O tablet interno deve operar como dispositivo dedicado. Após provisionamento, ele consulta a AccessSession ativa da sala e assume a sessão sem pareamento manual.

A implementação de produção deve autenticar o dispositivo por mecanismo próprio do hardware/app. O segredo DEV embutido no mock **não é aceitável em produção**.

### Finalização

```text
PICKING_READY
→ PRESENCE_CLEARED
→ DOOR_CLOSED
→ validações server-side
→ WITHDRAWAL_CONFIRMED
```

Nenhum botão de confirmação final deve ser apresentado ao operador. Se a finalização automática falhar, o evento físico de `DOOR_CLOSED` deve permanecer registrado e a sessão ficar em estado técnico recuperável, sem exigir que o funcionário repita a retirada.

## 11. Auto-ready e recuperação logística automática

### Encerramento do picking

A produção não deve apresentar botão **Concluir separação**.

O servidor promove automaticamente:

```text
ENTRY_CONFIRMED
+ todas as picking_tasks resolvidas
+ nenhuma EXCEPTION aberta
+ sensitive_state = COMPLETED, quando aplicável
→ PICKING_READY
```

Até o sensor emitir `PRESENCE_CLEARED`, é permitido `PICKING_ITEM_UNDONE` exclusivamente como correção do checklist já concluído. Essa ação deve registrar `PICKING_REOPENED` e retornar a `ENTRY_CONFIRMED`. Após a saída, alterações de picking são rejeitadas.

### `Não encontrei`

Ao receber `STOCK_LOCATION_DISCREPANCY`, o Sistema deve:

1. preservar lote/coordenada divergentes na auditoria;
2. excluir lotes já falhos naquela tarefa;
3. consultar os demais lotes elegíveis;
4. aplicar FEFO, FIFO em empate e desempate determinístico;
5. selecionar automaticamente a primeira alternativa com saldo suficiente para a tarefa;
6. registrar `PICKING_LOT_REALLOCATED` com `automatic=true`;
7. apresentar ao Terminal somente a nova coordenada/lote.

O funcionário não escolhe manualmente qual lote usar.

Se nenhuma alternativa individual possuir saldo suficiente, o sistema não improvisa divisão tardia da tarefa no Terminal: mantém `EXCEPTION` e oferece somente `PICKING_PARTIAL` ou `PICKING_UNAVAILABLE`. Uma eventual recomposição transacional entre múltiplos lotes deve ser tratada pelo HVB Sistema/API, não pela UI do Terminal.
