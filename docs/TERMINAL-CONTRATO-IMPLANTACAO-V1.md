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
