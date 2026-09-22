# Eventos — Terminal v1

Backend canônico: `/v1/terminal/v1`. Todos os POSTs exigem Bearer da credencial API e `idempotency-key` (8–128 caracteres). Operações de dispositivo exigem também `x-device-id`, conferido contra credencial provisionada, unidade, sala, papel e dispositivo ativo.

O corpo comum contém `unidade_id` e `motivo`. `estado: confirmado` na resposta comum significa **comando registrado**, não permissão de abrir porta nem retirada concluída. Após o comando, o cliente usa o snapshot canônico e seus prazos. O controlador nunca transforma replay de comando em nova autorização física. Sem backend, novo acesso falha fechado.

## Envelope físico/picking

```json
{
  "unidade_id": "UUID",
  "motivo": "Evidência do controlador provisionado",
  "event_id": "UUID persistente do fato",
  "occurred_at": "timestamp ISO-8601",
  "type": "DOOR_CLOSED"
}
```

POST `/access-sessions/:id/physical-events` vincula a sessão pelo caminho e o dispositivo pela autenticação. Picking usa `/picking-events` e inclui `task_id`. A referência externa, chave original, horário ocorrido, recebimento, dispositivo e sessão são preservados na auditoria. Horários futuros, anteriores à sessão ou fora da ordem dos fatos externos são recusados. Sincronização é idempotente, sem implantar autorização offline permissiva.

Mesmo idempotency key + corpo canônico idêntico retorna o comando original. Conteúdo diferente, inclusive aninhado, dá 409. Uma referência `event_id` entregue de novo com outra chave só é aceita se sessão, dispositivo e corpo forem idênticos, sem criar outro efeito. Mudança dá 409. Revogação de credencial bloqueia inclusive replay HTTP.

## Fluxos e autores

| Gatilho / emissor autorizado | Eventos persistidos / resultado |
|---|---|
| ACCESS: `/nfc` | NFC_VALIDATED → BIOMETRIC_REQUESTED; challenge disponível a ACCESS/BIOMETRIC da sala |
| BIOMETRIC: `/biometric` | BIOMETRIC_VALIDATED → AUTH_SESSION_CREATED; desafio/evidência de uso único |
| ACCESS: `/withdrawal-contexts` | WITHDRAWAL_CONTEXT_CONFIRMED; ORs + ajustes tipados |
| ACCESS: `/access-sessions` | SENSITIVE_ACCESS_ELIGIBLE quando há itens sensíveis e autorização; DOOR_AUTHORIZED após reserva |
| CONTROLLER: DOOR_OPEN, ENTRY_CONFIRMED | Entrada física; exclusividade mantida |
| PICKING: CONFIRM, PARTIAL, UNAVAILABLE | PICKING_ITEM_*; quantidades derivadas de tarefa/tentativa/reserva |
| PICKING: NOT_FOUND | STOCK_LOCATION_DISCREPANCY; PICKING_LOT_REALLOCATED automático ou EXCEPTION, com eventual PICKING_PARTIAL_OFFERED |
| Todas as tarefas resolvidas | PICKING_READY automático, somente com fase sensível COMPLETED |
| PICKING: UNDO, antes de saída | PICKING_ITEM_UNDONE → PICKING_REOPENED → ENTRY_CONFIRMED |
| PICKING: `/sensitive-access` | SENSITIVE_ACCESS_REQUESTED → SENSITIVE_ACCESS_GRANTED; sem nova NFC/biometria |
| CONTROLLER: SENSITIVE_DOOR_OPENED | Janela válida + evidência de abertura; habilita picking sensível |
| CONTROLLER: SENSITIVE_DOOR_CLOSED | Preserva evidência de fechamento; ainda não comprova trava |
| CONTROLLER: SENSITIVE_LOCK_CONFIRMED | LOCKED se restarem sensíveis; SENSITIVE_ACCESS_COMPLETED caso contrário |
| CONTROLLER: PRESENCE_CLEARED | EXIT_CONFIRMED; bloqueia mudanças no checklist |
| CONTROLLER: DOOR_CLOSED após saída | READY_TO_CONFIRM; confirmação automática transacional → WITHDRAWAL_CONFIRMED → CLOSED |
| Falha na confirmação | WITHDRAWAL_CONFIRMATION_FAILED, READY_TO_CONFIRM e DOOR_CLOSED preservados |
| CONTROLLER: `/recover` | Reavalia timeout/janela ou repete somente a confirmação pendente |
| Timeout pré-entrada | EXPIRED, libera reservas e sala; não permite entrada |
| Timeout com presença | ACCESS_TIMEOUT_ALERTED uma vez; mantém sessão e saldo protegidos |
| Janela sensível vencida | SENSITIVE_UNLOCK_WINDOW_EXPIRED; aguarda evidências de fechamento/trava |

Eventos derivados têm `automatic: true`. Fatos transmitidos têm `automatic: false`. Não existe endpoint/botão de confirmar identidade, concluir separação ou confirmar retirada. `recover` pertence ao controlador e não representa uma nova retirada pelo funcionário.

## Consulta, reconexão e falhas

O kiosk usa GET `/rooms/:id/active-session`; somente PICKING provisionado da sala pode assumir a sessão. Snapshot pode ser consultado também por ACCESS/CONTROLLER provisionados. As consultas administrativas de eventos/fulfillment exigem RBAC e são auditadas. Nenhuma lista retorna tag bruta, assinatura biométrica, chave do simulador ou Bearer.

O cliente persistirá a mesma chave e corpo em resposta perdida. Nenhuma alteração posterior a PRESENCE_CLEARED é aceita. Falha de confirmação aparece na trilha com código sanitizado e permanece recuperável; não se exige retorno físico à sala. Políticas de intervenção humana, emergência, perda de sensor e Edge serão homologadas separadamente.
