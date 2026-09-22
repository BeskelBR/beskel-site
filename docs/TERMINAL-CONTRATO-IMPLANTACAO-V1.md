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
- comando do compartimento sensível.

## 3. Eventos físicos

Contrato mínimo:

```text
ACCESS_GRANTED
DOOR_OPENED
PRESENCE_CONFIRMED
DOOR_CLOSED
```

Para sensíveis, o projeto físico deve distinguir autorização/comando de abertura do evento comprovado por sensor.

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
