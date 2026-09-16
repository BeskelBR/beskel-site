# HVB Terminal ↔ HVB Sistema — Contrato funcional v1

Status: **PROPOSTO COMO CONTRATO DE INTEGRAÇÃO / endpoints definitivos ainda não congelados**.

Objetivo: permitir que o `hvb-terminal-dev` substitua o `MockAdapter` por uma API real sem trazer regras de negócio para o Terminal.

## 1. Autoridade

### HVB Sistema / API

É autoridade para:

- identidade institucional;
- credenciais e revogação;
- permissões;
- Ordens de Retirada;
- classificação de item sensível;
- AuthSession;
- AccessSession;
- idempotência;
- auditoria;
- vínculo com episódio/paciente;
- regras de estoque, custo, cobertura e faturamento.

### Terminal

É responsável por:

- capturar identidade alegada via credencial;
- acionar componente local de face 1:1/PAD;
- apresentar ordens pendentes/autorizadas;
- iniciar sessão de acesso;
- transmitir eventos físicos do controlador/sensores;
- exibir o estado retornado pela API.

O Terminal não acessa PostgreSQL diretamente.

## 2. Operações mínimas

Os nomes HTTP abaixo são ilustrativos. O contrato semântico é mais importante que a URL neste estágio.

### 2.1 Identificar credencial

Entrada:

```json
{
  "credential_token": "opaque",
  "terminal_id": "HVB-T01"
}
```

Saída:

```json
{
  "credential_id": "...",
  "employee": {
    "employee_id": "...",
    "name": "...",
    "role": "..."
  },
  "challenge_id": "...",
  "challenge_expires_at": 0
}
```

### 2.2 Verificar identidade

Entrada:

```json
{
  "challenge_id": "...",
  "evidence_id": "...",
  "terminal_id": "HVB-T01"
}
```

Saída:

```json
{
  "auth_session_id": "...",
  "employee": {},
  "auth_level": "STANDARD",
  "factors": [],
  "expires_at": 0
}
```

### 2.3 Consultar ordens pendentes

Critério inicial:

- usuário autenticado;
- somente ordens que possam participar do fluxo de retirada;
- API aplica permissões e escopo.

Resumo mínimo por ordem:

```json
{
  "order_id": "OR-...",
  "episode_id": "ATD-...",
  "status": "AGUARDANDO_RETIRADA",
  "item_count": 5,
  "total_units": 6,
  "has_sensitive_items": true,
  "patient": {
    "patient_id": "...",
    "name": "Thor"
  }
}
```

O Terminal não precisa receber detalhes clínicos desnecessários.

### 2.4 Iniciar AccessSession

Entrada:

```json
{
  "command_id": "uuid",
  "auth_session_id": "...",
  "order_ids": ["OR-..."],
  "terminal_id": "HVB-T01"
}
```

Saída:

```json
{
  "access_session_id": "...",
  "state": "DOOR_AUTHORIZED",
  "sensitive_access": true,
  "order_ids": ["OR-..."],
  "expires_at": 0
}
```

`command_id` deve ser idempotente.

## 3. Eventos físicos

Exemplos de eventos:

- `DOOR_OPENED`
- `ENTRY_CONFIRMED`
- `DOOR_CLOSED`
- `SENSITIVE_CABINET_OPENED`
- `SENSITIVE_CABINET_CLOSED`
- `ACCESS_CLOSED`

Envelope mínimo:

```json
{
  "command_id": "uuid",
  "access_session_id": "...",
  "event_type": "ENTRY_CONFIRMED",
  "source_occurred_at": "2026-09-16T...",
  "source_device_id": "HVB-T01",
  "metadata": {}
}
```

Requisitos:

- idempotência;
- ordem de transição validada no servidor;
- device trust;
- server received time separado de source occurred time;
- evento append-only.

## 4. Máquina de acesso

```text
DOOR_AUTHORIZED
→ DOOR_OPEN
→ ENTRY_CONFIRMED
→ [porta fecha]
→ SENSITIVE_CABINET_AUTHORIZED | ACCESS_ACTIVE
→ SENSITIVE_CABINET_OPEN
→ ACCESS_ACTIVE
→ CLOSED
```

A ordem muda para `EM_SEPARACAO` em `ENTRY_CONFIRMED`, não na simples autorização da porta.

## 5. Relação com Ordem de Retirada

A sessão de acesso pode referenciar uma ou mais ordens.

Não assumir estruturalmente `1 AccessSession = 1 WithdrawalOrder`.

O Terminal atual pode apresentar uma ordem por vez no MVP, mas o contrato deve manter `order_ids[]`.

## 6. Idempotência

Comandos que produzem efeito devem carregar `command_id` único.

Se o mesmo `command_id` for repetido com o mesmo payload:

- retornar o resultado original;
- não duplicar evento/sessão.

Se for repetido com payload diferente:

- rejeitar como conflito de idempotência.

Isso é requisito para rede instável e futuro modo offline.

## 7. Offline

Este contrato não autoriza ainda acesso offline sensível.

Direção:

- eventos locais com UUID;
- fila local;
- `source_occurred_at`;
- `source_device_id`;
- idempotência na sincronização;
- estado explícito `PENDING_SYNC` quando aplicável.

Estoque sensível: `FAIL_CLOSED` por padrão.

## 8. Erros semânticos relevantes

A API deve ser capaz de distinguir pelo menos:

- credencial inválida/revogada;
- autenticação expirada;
- evidence inválida/expirada;
- terminal/device não confiável;
- ordem indisponível;
- acesso sensível negado;
- sessão expirada;
- sequência física inválida;
- conflito de idempotência.

Não depender exclusivamente de mensagens de texto para tratamento de erro.

## 9. Versão

O mock atual declara:

```text
auth_contract_version = 1
access_contract_version = 1
```

Ao integrar com `hvb-sistema-dev`, comparar o OpenAPI real com este documento antes de trocar o adapter.
