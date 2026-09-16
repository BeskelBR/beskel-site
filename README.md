# HVB Terminal — Terminal de Acesso

Protótipo de desenvolvimento do Terminal físico do Hospital Veterinário Brasília.

> **Arquitetura funcional vigente:** o Terminal é um **Terminal de Acesso**. Seu papel é identidade, autenticação, autorização, confirmação de contexto da retirada e participação no controle de acesso físico. O picking item a item continua no **HVB Mobile** e a escrituração continua sendo responsabilidade da **API do HVB Sistema**.

## Status atual

A migração funcional para a arquitetura v2 foi iniciada em 16/09/2026 em modo exclusivamente DEV/mock.

Já estão representados no protótipo:

- `Controle de Materiais` → `Terminal de Acesso`;
- credencial DESFire simulada + face 1:1/PAD simulados;
- challenge curto e de uso único;
- evidência biométrica/PAD referenciada por `evidence_id`;
- vínculo da evidência a terminal/dispositivo DEV confiável;
- consulta de Ordens de Retirada pendentes;
- **lista de materiais visível no próprio Terminal após autenticação**;
- **seleção simultânea de uma ou várias Ordens de Retirada**;
- confirmação do conjunto de ordens antes da criação da `AccessSession`;
- `AccessSession` N:N com ordens no contrato do protótipo;
- diferenciação de ordem comum e ordem com item sensível;
- sequência simulada de porta/entrada/armário sensível;
- comandos com `command_id` para idempotência;
- `source_occurred_at` separado do instante recebido no servidor;
- auditoria append-only de identidade e acesso;
- dataset sintético com pelo menos dez Ordens de Retirada simultâneas;
- preparação de mensagem WhatsApp com lista de materiais em modo DEV, sem envio automático;
- depreciação das telas legadas de picking;
- ausência de escrita de consumo/estoque pelo Terminal.

Ainda não estão implementados de forma real:

- DESFire físico;
- câmera/biometria/liveness reais;
- assinatura/attestation criptográfica real;
- controlador de porta/armário e sensores reais;
- HVB Mobile real;
- API real do HVB Sistema;
- PostgreSQL real neste protótipo;
- contingência offline/edge;
- provedor/API oficial de WhatsApp;
- movimentação real de estoque, custo ou faturamento.

Nenhum dado ou sistema real do HVB é acessado.

## Separação de responsabilidades

```text
HVB SISTEMA / CONSULTÓRIO
→ cria Ordem de Retirada

TERMINAL DE ACESSO HVB
→ identifica/autentica
→ mostra ordens e materiais
→ permite selecionar uma ou várias ordens
→ confirma contexto da sessão
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
→ TERMINAL AUTENTICA E MOSTRA A LISTA
→ PROFISSIONAL CONFIRMA AS ORDENS
→ SALA LIBERA
→ MOBILE GUIA O PICKING
→ API ESCRITURA
```

A presença da lista no Terminal **não devolve o picking detalhado ao Terminal**. O equipamento confirma visualmente o contexto e o conjunto de ordens que motivam o acesso.

## Fluxo DEV atual

```text
repouso
→ credencial simulada
→ challenge
→ face 1:1 + PAD simulados
→ AuthSession
→ 10+ ordens pendentes com materiais visíveis
→ seleção de 1..N ordens
→ confirmação do conjunto
→ AccessSession idempotente
→ porta autorizada
→ porta aberta [DEV]
→ entrada confirmada [DEV]
→ todas as ordens da sessão → EM_SEPARACAO
→ porta fechada [DEV]
→ armário sensível [se aplicável, DEV]
→ acesso ativo
```

`DOOR_AUTHORIZED` não altera o estado das ordens. A transição para `EM_SEPARACAO` ocorre apenas em `ENTRY_CONFIRMED`.

## Rotas v2

- `/` — repouso/credencial;
- `/auth/:token` — identificação/autenticação simulada;
- `/ordens` — consulta, lista de materiais e seleção múltipla;
- `/acesso/:id` — sessão, materiais vinculados e eventos físicos simulados;
- `/admin/auditoria` — auditoria somente leitura.

Rotas legadas continuam apenas como aviso de migração:

- `/atendimentos`;
- `/atendimento/:id`;
- `/materiais`;
- `/retirada`;
- `/sucesso`.

## WhatsApp em DEV

O WhatsApp continua complementar:

```text
WHATSAPP NOTIFICA
HVB MOBILE OPERA
API ESCRITURA
```

O protótipo **não envia mensagens automaticamente** e não possui provedor oficial configurado. Ele apenas abre `wa.me` com a lista pré-preenchida para que o operador confirme manualmente o envio.

O número de teste é armazenado apenas no `localStorage` do navegador. Não deve ser hardcoded no repositório.

Há duas formas de configurar:

1. campo `WhatsApp • DEV` na interface; ou
2. abrir uma vez o Terminal com `?whatsapp=<numero_em_formato_internacional>`.

O parâmetro é removido da URL após ser salvo localmente.

A mensagem contém ordem e materiais/quantidades. Evitar dados clínicos desnecessários.

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

O `IntegrationAdapter` permanece como fronteira para substituição posterior pelo HVB Sistema.

## Autenticação alvo

```text
DESFire EV3
→ face 1:1
→ PAD/liveness
→ evidência autenticada do dispositivo
→ validação da API
→ AuthSession
```

A UI não é raiz de confiança. Em DEV, a evidência é simulada; em produção deverá haver attestation/assinatura e proteção anti-replay.

## Estoque sensível

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

Selecionar várias ordens cria uma única sessão de acesso. Se **qualquer** uma das ordens contiver item sensível, toda a sessão exige permissão de acesso sensível.

Offline + estoque sensível permanece `FAIL_CLOSED` por padrão.

## Testes do núcleo DEV

```bash
node --test tests/store.test.js
```

A suíte cobre:

- pelo menos dez ordens sintéticas pendentes;
- presença da lista de materiais no contrato das ordens;
- sessão vinculada a múltiplas ordens;
- idempotência;
- `ENTRY_CONFIRMED → EM_SEPARACAO` para todas as ordens da sessão;
- bloqueio de item sensível sem permissão;
- ausência de `STOCK_CONSUMED` no Terminal.

## Segurança do DEV

- dados 100% fictícios;
- nenhum segredo real;
- nenhum número pessoal hardcoded no repositório;
- nenhum banco real no frontend;
- nenhum acesso ao SimplesVet;
- `noindex`, `nofollow`, `noarchive`;
- challenges e sessões temporárias;
- eventos append-only no mock;
- nenhum movimento real de estoque.

## Documentação vigente

- `docs/TERMINAL-ARQUITETURA-V2.md`
- `docs/DELTA-IMPLEMENTACAO-V2.md`
- `docs/AUTH-EVIDENCE-CONTRACT-V1.md`
- `docs/TERMINAL-CORE-CONTRACT-V1.md`
- `docs/OFFLINE-EDGE-V1.md`
- `docs/INTEGRACAO-HVB-SISTEMA-DELTA-V2.md`
- `docs/HANDOFF-HVB-SISTEMA-TERMINAL-V2.md`
- `docs/TESTE-MULTI-ORDEM-WHATSAPP-DEV.md`

## Limites

Não avançar sem autorização específica para hardware real, dados reais, deploy de produção, domínio/DNS, provedor de WhatsApp ou integração com sistemas externos.