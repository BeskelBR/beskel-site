# HVB Terminal — Terminal de Acesso

Protótipo de desenvolvimento do Terminal físico do Hospital Veterinário Brasília.

> **Arquitetura funcional vigente:** o Terminal é um **Terminal de Acesso**. Seu papel é identidade, autenticação, autorização e participação no controle de acesso físico. O picking será realizado pelo **HVB Mobile** e a escrituração será responsabilidade da **API do HVB Sistema**.

## Status atual

A migração funcional para a arquitetura v2 **foi iniciada em 16/09/2026** em modo exclusivamente DEV/mock.

Já foram migrados no protótipo:

- papel da UI: `Controle de Materiais` → `Terminal de Acesso`;
- autenticação em duas etapas: credencial DESFire simulada + face 1:1/PAD simulados;
- challenge curto e de uso único para autenticação;
- evidência biométrica/PAD referenciada por `evidence_id`;
- vínculo da evidência a terminal/dispositivo DEV confiável;
- consulta de Ordens de Retirada pendentes;
- criação de `AccessSession` temporária;
- diferenciação de ordem comum e ordem com item sensível;
- sequência simulada de porta/entrada/armário sensível;
- comandos de sessão/eventos com `command_id` para idempotência;
- registro separado de `source_occurred_at` e horário recebido pelo servidor;
- auditoria append-only de eventos de identidade e acesso;
- depreciação das telas legadas de picking;
- remoção da escrita de consumo/estoque do contrato funcional do Terminal.

Ainda **não** estão implementados neste protótipo:

- DESFire físico;
- câmera/biometria/liveness reais;
- assinatura/attestation criptográfica real da evidência biométrica;
- controlador de porta/armário e sensores reais;
- HVB Mobile;
- API real do HVB Sistema;
- PostgreSQL real;
- contingência offline/edge;
- WhatsApp;
- movimentação real de estoque, custo ou faturamento.

Nenhum dado ou sistema real do HVB é acessado.

## Documentação vigente

- `docs/TERMINAL-ARQUITETURA-V2.md` — protocolo funcional aprovado;
- `docs/DELTA-IMPLEMENTACAO-V2.md` — impacto sobre o MVP anterior e plano de migração;
- `docs/AUTH-EVIDENCE-CONTRACT-V1.md` — contrato conceitual de evidência de autenticação;
- `docs/TERMINAL-CORE-CONTRACT-V1.md` — fronteira funcional Terminal ↔ HVB Sistema.

## Separação de responsabilidades

```text
HVB SISTEMA / CONSULTÓRIO
→ cria Ordem de Retirada

TERMINAL DE ACESSO HVB
→ identifica/autentica
→ consulta ordens
→ cria sessão de acesso
→ participa do controle físico

HVB MOBILE
→ guia picking
→ captura exceções
→ confirma resultado

API HVB
→ valida regras
→ escritura estoque/custo/auditoria

POSTGRESQL
→ fonte oficial dos dados
```

Princípio operacional:

```text
CONSULTÓRIO SOLICITA
→ TERMINAL AUTENTICA
→ SALA LIBERA
→ MOBILE GUIA
→ API ESCRITURA
```

## Fluxo DEV atual

```text
repouso
→ credencial simulada
→ challenge
→ face 1:1 + PAD simulados
→ evidence_id vinculado ao dispositivo DEV
→ AuthSession
→ ordens pendentes
→ seleção da ordem
→ AccessSession idempotente
→ porta autorizada
→ porta aberta [DEV]
→ entrada confirmada [DEV]
→ porta fechada [DEV]
→ armário sensível [se aplicável, DEV]
→ acesso ativo
```

A transição da ordem para `EM_SEPARACAO` ocorre apenas em `ENTRY_CONFIRMED`, não na mera autorização da porta.

## Rotas v2

- `/` — repouso/credencial;
- `/auth/:token` — identificação da credencial e autenticação simulada;
- `/ordens` — consulta de ordens pendentes;
- `/acesso/:id` — sessão de acesso e simulação de eventos físicos;
- `/admin/auditoria` — auditoria somente leitura.

### Rotas legadas

As rotas abaixo continuam roteadas temporariamente apenas para informar que o fluxo mudou de lugar:

- `/atendimentos`;
- `/atendimento/:id`;
- `/materiais`;
- `/retirada`;
- `/sucesso`.

Elas não devem voltar a concentrar picking ou escrituração de estoque.

## Arquitetura técnica do protótipo

```text
UI
↓
API /api/mock
↓
IntegrationAdapter
↓
MockAdapter
↓
store mock em memória
```

O `IntegrationAdapter` abstrai operações de identidade e acesso:

- `identifyCredential`;
- `createBiometricEvidence`;
- `verifyIdentity`;
- `getPendingOrders`;
- `startAccessSession`;
- `registerAccessEvent`;
- `getAccessSession`;
- `getTerminalDescriptor`;
- `listAudit`.

O mock **não é fonte de verdade** e não deve evoluir para banco definitivo. A persistência real pertence ao HVB Sistema/PostgreSQL e será acessada apenas pela API.

## Autenticação alvo

```text
DESFire EV3
→ face 1:1
→ PAD/liveness
→ evidência autenticada do dispositivo
→ validação da API
→ AuthSession
```

O processamento biométrico deve preferencialmente ocorrer localmente. A UI não deve ser raiz de confiança.

No DEV, `createBiometricEvidence()` representa um componente local confiável **simulado**. Em produção, o marcador DEV deverá ser substituído por mecanismo real de attestation/assinatura e proteção anti-replay.

## Idempotência e rede instável

Comandos de efeito usam `command_id`:

- criação de `AccessSession`;
- registro de evento físico.

Repetição exata do mesmo comando deve devolver o resultado original sem duplicar sessão/evento. Reutilização do mesmo `command_id` com payload diferente deve ser rejeitada.

O cliente deve persistir o envelope original ao fazer retry; recriar timestamps/metadados com o mesmo `command_id` é conflito de idempotência.

## Estoque sensível

Fluxo alvo:

```text
autenticação
→ porta autorizada
→ porta abre
→ sensor confirma entrada
→ porta fecha
→ armário sensível autorizado [se necessário]
→ armário abre/fecha
→ acesso ativo
```

Porta e armário não devem ser liberados simultaneamente sem necessidade.

Offline + estoque sensível permanece `FAIL_CLOSED` por padrão até existir procedimento formal de contingência aprovado pelo HVB.

## Teste do núcleo DEV

Há cobertura sem dependências externas usando o runner nativo do Node:

```bash
node --test tests/store.test.js
```

O teste verifica:

- autenticação credencial → evidence → AuthSession;
- bloqueio de acesso sensível sem permissão;
- idempotência de criação de sessão;
- sequência física;
- mudança da ordem para `EM_SEPARACAO` apenas após entrada;
- ausência de escrituração de consumo no Terminal.

## Segurança do DEV

- dados 100% fictícios;
- nenhum segredo real;
- nenhum banco real no frontend;
- nenhum acesso ao SimplesVet ou sistemas do hospital;
- `noindex`, `nofollow`, `noarchive`;
- challenges e sessões temporárias;
- eventos append-only no mock;
- nenhum movimento real de estoque.

## Identidade visual

- Azul HVB: `#0A3983`;
- Ciano HVB: `#25B0E6`;
- Branco: `#FFFFFF`;
- Tipografia operacional: Nunito.

Legibilidade e segurança operacional prevalecem sobre ornamentação.

## Próximo marco

O P0 técnico do Terminal já contém a abstração de autenticação/evidência, sessões, eventos físicos e idempotência em modo DEV.

A próxima mudança estrutural relevante depende da estabilização dos contratos do **HVB Sistema** para substituir o `MockAdapter` por integração real. Até lá, ainda podem evoluir nesta branch, sem autorização externa adicional:

- testes locais do contrato mock;
- tratamento explícito de falha de conectividade/fail-closed;
- documentação de offline/edge;
- ergonomia do fluxo DEV;
- validações que não dependam de hardware ou dados reais.

Não avançar sem autorização específica para hardware real, dados reais, deploy de produção, domínio/DNS ou integração com sistemas externos.
