# HVB Terminal — Terminal de Acesso

Protótipo de desenvolvimento do Terminal físico do Hospital Veterinário Brasília.

> **Arquitetura funcional vigente:** o Terminal é um **Terminal de Acesso**. Seu papel é identidade, autenticação, autorização e participação no controle de acesso físico. O picking será realizado pelo **HVB Mobile** e a escrituração será responsabilidade da **API do HVB Sistema**.

## Status atual

A migração funcional para a arquitetura v2 **foi iniciada em 16/09/2026** em modo exclusivamente DEV/mock.

Já foram migrados no protótipo:

- papel da UI: `Controle de Materiais` → `Terminal de Acesso`;
- autenticação em duas etapas: credencial DESFire simulada + face 1:1/PAD simulados;
- consulta de Ordens de Retirada pendentes;
- criação de `AccessSession` temporária;
- diferenciação de ordem comum e ordem com item sensível;
- sequência simulada de porta/entrada/armário sensível;
- auditoria append-only de eventos de identidade e acesso;
- depreciação das telas legadas de picking;
- remoção da escrita de consumo/estoque do contrato funcional do Terminal.

Ainda **não** estão implementados neste protótipo:

- DESFire físico;
- câmera/biometria/liveness reais;
- assinatura/attestation de evidência biométrica;
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
- `docs/DELTA-IMPLEMENTACAO-V2.md` — impacto sobre o MVP anterior e plano de migração.

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
→ face 1:1 + PAD simulados
→ ordens pendentes
→ seleção da ordem
→ AccessSession
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

O `IntegrationAdapter` agora abstrai operações de identidade e acesso:

- `identifyCredential`;
- `verifyIdentity`;
- `getPendingOrders`;
- `startAccessSession`;
- `registerAccessEvent`;
- `getAccessSession`;
- `listAudit`.

O mock **não é fonte de verdade** e não deve evoluir para banco definitivo. A persistência real pertence ao HVB Sistema/PostgreSQL e será acessada apenas pela API.

## Autenticação alvo

```text
DESFire EV3
→ face 1:1
→ PAD/liveness
→ evidência autenticada do dispositivo
→ validação da API
→ AccessSession
```

O processamento biométrico deve preferencialmente ocorrer localmente. A implementação real não poderá confiar em uma simples flag `face_match=true`; o mock usa flags apenas para demonstrar o fluxo de estados.

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

## Segurança do DEV

- dados 100% fictícios;
- nenhum segredo real;
- nenhum banco real no frontend;
- nenhum acesso ao SimplesVet ou sistemas do hospital;
- `noindex`, `nofollow`, `noarchive`;
- sessões temporárias;
- eventos append-only no mock;
- nenhum movimento real de estoque.

## Identidade visual

- Azul HVB: `#0A3983`;
- Ciano HVB: `#25B0E6`;
- Branco: `#FFFFFF`;
- Tipografia operacional: Nunito.

Legibilidade e segurança operacional prevalecem sobre ornamentação.

## Próximo marco

A próxima etapa do Terminal depende da estabilização dos contratos do HVB Sistema para substituir o `MockAdapter` por uma integração real. Até lá, o desenvolvimento permitido nesta branch deve permanecer limitado ao **protótipo v2 isolado**, sem hardware real, dados reais ou escrita em sistemas externos.
