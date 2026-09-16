# HVB Terminal — Contrato de Evidência de Autenticação v1

Status: **APROVADO COMO DIREÇÃO ARQUITETURAL / implementação DEV simulada**.

Este documento define como o Terminal deve provar à API HVB que uma autenticação multifator ocorreu, sem depender de um simples booleano enviado pela UI.

## 1. Princípio

A autenticação padrão combina:

```text
DESFire EV3
→ identidade alegada
→ face 1:1
→ PAD/liveness
→ evidência vinculada a dispositivo confiável
→ validação da API
→ AuthSession
```

A UI web/PWA não é uma raiz de confiança. Ela não pode declarar de forma autoritativa `face_match=true` ou `liveness=true` em produção.

## 2. Challenge

Após identificação da credencial, a API emite um challenge curto e de uso único:

```json
{
  "challenge_id": "chl_...",
  "credential_id": "cred_...",
  "employee_id": "emp_...",
  "terminal_id": "HVB-T01",
  "expires_at": 0
}
```

Regras:

- uso único;
- TTL curto;
- vinculado ao terminal;
- vinculado à identidade alegada;
- não reutilizável após autenticação concluída.

## 3. Evidência biométrica/PAD

O componente local confiável deve produzir uma evidência associada ao challenge.

Campos conceituais mínimos:

```json
{
  "evidence_id": "bio_...",
  "challenge_id": "chl_...",
  "terminal_id": "HVB-T01",
  "device_id": "HVB-T01-BIO-01",
  "engine": "...",
  "engine_version": "...",
  "captured_at": "2026-09-16T...",
  "nonce": "...",
  "attestation": "..."
}
```

A produção deve garantir que a API consiga verificar, direta ou indiretamente:

- dispositivo autorizado;
- challenge correto;
- frescor;
- anti-replay;
- face 1:1 aprovada;
- PAD/liveness aprovado;
- integridade da evidência;
- vínculo com o terminal e a identidade alegada.

## 4. O que não deve ser enviado rotineiramente à nuvem

Preferência vigente:

- não enviar imagem facial bruta;
- não enviar vídeo de liveness;
- não enviar template biométrico salvo;
- não usar reconhecimento 1:N para descobrir a identidade.

A API recebe o resultado verificável e metadados mínimos necessários para segurança/auditoria.

## 5. Templates biométricos

Ainda pendente de decisão definitiva:

- storage local/seguro;
- criptografia;
- provisionamento;
- revogação;
- rotação;
- recuperação/substituição de terminal;
- engine/licença comercial;
- threshold operacional;
- PAD homologado.

Esses pontos não devem ser inventados no código antes da escolha de hardware/software.

## 6. Mock DEV atual

O protótipo implementa um componente simulado por `createBiometricEvidence()`.

Ele serve apenas para testar o contrato:

```text
UI solicita simulação local
→ mock cria evidence_id
→ UI entrega evidence_id à API mock
→ API valida vínculo challenge/terminal/device
→ AuthSession
```

O marcador `DEV_TRUSTED_COMPONENT_SIMULATION` não é mecanismo de segurança real e deve desaparecer na integração de produção.

## 7. Níveis de autenticação previstos

```text
STANDARD
DESFire + face 1:1 + PAD + device evidence

DEGRADED
credencial física ausente + face 1:1 + política permitida

BREAK_GLASS
face + segundo autorizador/fator + justificativa + auditoria destacada
```

A implementação atual cobre apenas `STANDARD` em modo simulado.

## 8. Anti-replay

Requisitos:

- challenge de uso único;
- evidence de uso único;
- nonce;
- TTL curto;
- terminal/device binding;
- `command_id` idempotente nos comandos de efeito.

## 9. Resultado

A autenticação concluída produz `AuthSession`, não movimentação de estoque, não execução clínica e não acesso físico automático.

```text
AuthSession
≠ AccessSession
≠ StockTransaction
≠ ClinicalExecution
```
