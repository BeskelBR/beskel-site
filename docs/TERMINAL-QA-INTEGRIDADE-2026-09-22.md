# HVB Terminal — Relatório de QA e integridade

Data: 22/09/2026  
Branch: `hvb-terminal-dev`  
Status: **18/18 cenários de simulação aprovados após correções**

## Correções aplicadas

1. Idempotência com canonicalização recursiva do payload antes do hash.
2. Bloqueio de mais de uma AccessSession ativa para a sala/Terminal.
3. Reserva lógica de lotes considera sessões ativas.
4. AccessSession protegida por `session_token`; leitura e mutações sem token são rejeitadas.
5. Auditoria exige AuthSession válida e permissão `terminal.audit`.
6. Picking somente enquanto a sessão está em `ENTRY_CONFIRMED`.
7. Novo marco `PICKING_READY` exige checklist integralmente resolvido.
8. Saída física passa por `PRESENCE_CLEARED` antes de `DOOR_CLOSED`.
9. Sessão ocupada não expira de forma destrutiva; gera `ACCESS_SESSION_TIMEOUT_ALERT`.
10. Sessão ainda não utilizada continua expirando em fail-closed.
11. Realocação de lote rejeita alternativa sem saldo suficiente para a tarefa.
12. Retirada parcial/indisponível não promove a OR a retirada completa.
13. Confirmação final é derivada do estado do servidor; payload de resultado do cliente não é autoridade.
14. Resultado final preserva `stock_lot_id`, lote, coordenada e quantidade efetiva.
15. Runtime web recebeu CSP e headers de hardening; dependência externa do Google Fonts foi removida.

## Máquina de estados física vigente

```text
DOOR_AUTHORIZED
→ DOOR_OPEN
→ ENTRY_CONFIRMED
→ PICKING_READY
→ EXIT_CONFIRMED
→ READY_TO_CONFIRM
→ WITHDRAWAL_CONFIRMED
→ CLOSED
```

Eventos principais:

```text
DOOR_OPENED
PRESENCE_CONFIRMED
PICKING_READY
PRESENCE_CLEARED
DOOR_CLOSED
WITHDRAWAL_CONFIRMED
ACCESS_CLOSED
```

## Cenários executados

- FEFO e divisão entre lotes;
- ausência de coordenada fixa no produto;
- conflito idempotente com alteração aninhada;
- replay idempotente exato;
- tentativa de segunda sessão simultânea;
- leitura de sessão sem token;
- mutação de sessão com token incorreto;
- fechamento da porta antes do fim do picking;
- tentativa de alterar picking após fechamento;
- `PICKING_READY` com checklist pendente;
- timeout durante ocupação;
- timeout antes da entrada;
- realocação para lote com saldo insuficiente;
- retirada parcial/indisponível;
- tentativa de forjar resultado final no cliente;
- permissão de estoque sensível;
- permissão de auditoria;
- replay de biometria/challenge;
- origem de dispositivo incorreta;
- headers de hardening e ausência de dependência externa de fontes.

Resultado consolidado da bateria executada: **18 aprovados / 18 executados / 0 falhas**.

## Limites deste QA

Esta bateria valida o núcleo lógico e contratos do branch atual. Ainda não substitui:

- teste E2E em dois tablets;
- NFC Android real;
- câmera/biometria/liveness reais;
- controlador, relés e sensores reais;
- PostgreSQL/API de produção;
- teste físico de queda/retorno de rede;
- comissionamento no HVB.

O próximo nível de QA deve ocorrer após a definição física da visita técnica e implementação dos adapters reais.
