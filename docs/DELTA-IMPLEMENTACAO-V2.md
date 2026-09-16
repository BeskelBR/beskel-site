# HVB Terminal — Delta de Implementação para Arquitetura v2

Status: **PLANO APROVADO / CÓDIGO AINDA NÃO MIGRADO**

Este documento registra o impacto da nova arquitetura funcional sobre o protótipo existente da branch `hvb-terminal-dev`.

## 1. Objetivo

Migrar o papel do Terminal de:

```text
NFC → atendimento → material → quantidade → confirmar retirada
```

para:

```text
NFC/DESFire → face 1:1 + PAD → autorização API → AccessSession → controle de acesso físico
```

O picking passa ao HVB Mobile e a escrituração ao HVB Sistema/API.

## 2. Componentes preservados

Os seguintes elementos atuais permanecem tecnicamente válidos:

- tela de repouso aguardando credencial;
- separação UI → API;
- padrão `IntegrationAdapter`/`MockAdapter`;
- credencial separada de funcionário;
- sessão temporária como conceito;
- IDs opacos/não sequenciais;
- auditoria append-only como direção;
- dados 100% fictícios em DEV;
- frontend sem acesso direto ao banco;
- `noindex`, `nofollow`, `noarchive` em DEV;
- assets e identidade visual HVB;
- desacoplamento completo do SimplesVet.

## 3. Componentes que mudam de responsabilidade

### `server/integration.js`

**Preservar o padrão de adapter**, substituir gradualmente o contrato orientado a estoque por contrato orientado a identidade/acesso.

Atual:

```text
getPatients
a getActiveAttendances
getAttendance
getProducts
getProduct
registerConsumption
```

Alvo conceitual:

```text
identifyCredential
submitAuthenticationEvidence
getPendingWithdrawalOrders
getWithdrawalOrder
createAccessSession
getAccessSession
requestBarrierAuthorization
registerAccessEvent
closeAccessSession
```

Os contratos finais devem vir do OpenAPI do HVB Sistema; não congelar nomes de endpoint sem integração com a API real.

### `server/store.js`

Preservar em DEV somente o papel de **mock sintético**.

Remover futuramente dele a autoridade local sobre:

- cálculo de estoque oficial;
- valor financeiro da retirada;
- `registerConsumption` como ação do Terminal.

Adicionar apenas para simulação futura:

- ordens pendentes sintéticas;
- autenticação multifator sintética;
- sessões de acesso;
- barreiras/sensores mock;
- eventos de acesso append-only.

O store mock nunca deve evoluir para banco definitivo.

### `api/mock.js`

Preservar como fachada DEV enquanto a API real do HVB Sistema não estiver disponível.

`auth` deverá evoluir para autenticação por evidências/fatores.

`registerConsumption` será depreciado e substituído por comandos de sessão/acesso no Terminal.

## 4. Rotas atuais

| Rota atual | Situação v2 | Destino |
|---|---|---|
| `/` | preservar | repouso/NFC |
| `/auth/[token]` | adaptar | identidade + face/PAD |
| `/atendimentos` | depreciar | ordem pendente/contexto automático |
| `/atendimento/[id]` | depreciar | não é fluxo normal do Terminal |
| `/materiais` | remover do Terminal | HVB Mobile/Sistema |
| `/retirada` | remover do Terminal | HVB Mobile/Sistema |
| `/sucesso` | substituir | acesso autorizado/sessão ativa |
| `/admin/auditoria` | DEV apenas | administração futura no HVB Sistema |

Nenhuma rota deve ser removida antes da etapa de migração de código aprovada.

## 5. Interface atual

### Preservar

- shell visual;
- topbar/relógio quando úteis;
- tela inicial e linguagem de credencial;
- estados visuais de sucesso/erro;
- assets HVB;
- acessibilidade básica já existente.

### Remover do fluxo definitivo

- busca de PET/tutor/atendimento no Terminal;
- seleção manual de material;
- exibição de catálogo de estoque para picking;
- incremento/decremento de quantidade;
- valor unitário/total como parte da confirmação do Terminal;
- botão `CONFIRMAR RETIRADA`;
- histórico detalhado de materiais como função operacional principal.

### Adicionar

- etapa facial 1:1/PAD;
- resumo de ordem(s) pendente(s);
- estado de autorização;
- estado físico da barreira;
- sessão de acesso ativa;
- mensagens de contingência/offline;
- indicação clara de continuar no HVB Mobile.

## 6. Modelo de dados futuro afetado

O HVB Sistema deverá oferecer conceitos equivalentes a:

- `WithdrawalOrder`;
- `WithdrawalOrderItem`;
- `AccessSession`;
- `AccessSessionOrder`;
- `AuthenticationEvidence`;
- `AccessEvent`;
- `PhysicalBarrier`;
- `Fulfillment`;
- `FulfillmentItem`;
- `StockTransaction`;
- movimentos de devolução/acréscimo referenciados;
- `NotificationDelivery` quando necessário.

Esses modelos pertencem ao HVB Sistema/API, não ao frontend do Terminal.

## 7. Prioridade de migração

### P0 — indispensável antes de novo desenvolvimento do Terminal

- congelar oficialmente o papel do Terminal como Terminal de Acesso;
- adotar `docs/TERMINAL-ARQUITETURA-V2.md` como protocolo funcional vigente;
- marcar picking atual como legado de protótipo;
- alinhar com o HVB Sistema os contratos de Ordem de Retirada e AccessSession;
- impedir que novas regras de estoque sejam implementadas localmente no Terminal.

### P1 — após contratos mínimos da API

- adaptar adapter/mock para ordens e sessões de acesso;
- substituir fluxo atendimento/material/retirada;
- implementar interface reduzida de autenticação/autorização;
- integrar HVB Mobile conceitualmente ao mesmo contrato;
- criar simulação DEV de face/PAD/barreiras sem hardware real.

### P2 — depois da API estável

- contingência sem crachá;
- break-glass;
- fila offline persistente;
- reconciliação/idempotência;
- múltiplas ordens por sessão;
- notificação WhatsApp;
- telemetria operacional.

### P3 — integração física

- DESFire EV3 real;
- câmera;
- engine facial 1:1;
- PAD/liveness;
- controlador de porta;
- sensores;
- armário sensível;
- Edge/gateway local, se aprovado;
- ensaios de falha, energia e rede.

## 8. Regra de congelamento

Até o HVB Sistema possuir protótipo funcional e contratos mínimos estáveis para:

- identidade/credencial/dispositivo;
- ordens pendentes;
- AccessSession;
- autorização;
- auditoria/eventos;

**não avançar na reescrita do código do Terminal**.

A documentação pode evoluir; a implementação atual permanece como protótipo histórico funcional até autorização específica de migração.

## 9. Critério para iniciar a migração de código

A migração pode começar quando existirem, ao menos:

1. máquina de estados de Ordem de Retirada aceita pelo HVB Sistema;
2. contrato versionado para ordens pendentes;
3. contrato de autenticação/evidências;
4. contrato de criação/fechamento de `AccessSession`;
5. semântica definida para autorização de barreira;
6. regras mínimas de offline e sensível;
7. OpenAPI ou especificação equivalente suficientemente estável.

Até esse ponto, alterar a UI do protótipo geraria retrabalho sem ganho funcional.