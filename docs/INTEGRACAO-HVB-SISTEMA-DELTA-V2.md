# HVB Terminal v2 ↔ HVB Sistema — Delta de integração

Data da revisão: 16/09/2026.

Status: **BLOQUEIO DE INTEGRAÇÃO IDENTIFICADO / nenhuma alteração feita em `hvb-sistema-dev`**.

## 1. Objetivo

Comparar a arquitetura funcional aprovada do **Terminal de Acesso v2** com o módulo `terminal` atualmente existente em `hvb-sistema-dev`.

A comparação foi feita somente em leitura sobre:

- `src/domain/terminal/schemas.ts`;
- `src/domain/terminal/routes.ts`;
- `src/domain/terminal/service.ts`;
- `migrations/047_terminal_model.sql`;
- `migrations/048_terminal_integrity.sql`;
- `docs/adr/0015-terminal-simulado.md`;
- `tests/terminal.test.ts`.

## 2. Conclusão

O módulo `terminal` atual do HVB Sistema representa a **arquitetura anterior**.

Ele modela:

```text
etiqueta
→ leitura
→ posição/paciente
→ retirada pelo próprio terminal
→ movimento de estoque
```

A arquitetura aprovada agora é:

```text
Ordem de Retirada criada no Sistema
→ credencial DESFire
→ face 1:1 + PAD
→ AuthSession
→ AccessSession
→ controle físico de acesso
→ picking no HVB Mobile
→ API escritura consumo/estoque depois da confirmação móvel
```

Portanto, **o Terminal v2 não deve ser adaptado ao contrato atual do módulo `terminal` do Sistema**. O contrato do Sistema é que precisará evoluir antes da integração real.

## 3. O que pode ser reaproveitado do HVB Sistema

Embora o fluxo terminal esteja desatualizado, diversas fundações do Sistema continuam úteis:

- `usuario` e papéis/permissões;
- `credencial` e revogação;
- `dispositivo` e desativação;
- `comando` e idempotência;
- escopo organização/unidade;
- RLS;
- auditoria/autoria;
- `episodio`/paciente;
- estoque transacional já separado;
- API Fastify;
- OpenAPI;
- padrão de comando com `Idempotency-Key` e `X-Device-Id`;
- validação de dispositivo ativo;
- transações e constraints PostgreSQL.

Esses elementos devem ser preservados em vez de duplicados.

## 4. O que está incompatível

### 4.1 Etiqueta não é credencial de acesso

O módulo atual usa `etiqueta_terminal` para identificar paciente ou posição de estoque. A própria ADR 0015 explicita que essa etiqueta **não é credencial** e não prova identidade/presença profissional.

No v2, o primeiro fator é uma `credencial` do funcionário, com direção DESFire EV3.

### 4.2 Leitura atual tem outro significado

`leitura_terminal` atualmente representa leitura de etiqueta associada a paciente/posição e contexto de episódio.

No v2, o Terminal precisa registrar evidências de:

- credencial apresentada;
- challenge;
- autenticação biométrica/PAD;
- dispositivo/terminal;
- sessão de acesso;
- eventos de barreira.

Não reutilizar `leitura_terminal` com semântica diferente.

### 4.3 Retirada pelo Terminal deve sair do contrato

O endpoint atual `/terminal/retiradas` reutiliza diretamente a ação de estoque e cria `retirada_terminal` vinculada à `transacao_estoque`.

Isso conflita com a decisão aprovada:

```text
TERMINAL AUTENTICA / CONTROLA ACESSO
HVB MOBILE CONFIRMA PICKING
API ESCRITURA ESTOQUE
```

O Terminal v2 não deve produzir `StockTransaction` por confirmação local de item/quantidade.

### 4.4 Não existe Ordem de Retirada no módulo atual

A arquitetura v2 exige entidade/contrato de `WithdrawalOrder` vinculada a episódio, solicitante e itens.

O módulo Terminal atual não expõe esse agregado.

### 4.5 Não existem AuthSession e AccessSession com semântica v2

A autenticação API atual é Bearer para o usuário da API. Isso não substitui:

- challenge de credencial física;
- evidência de face/PAD;
- sessão curta de autenticação física;
- sessão temporal de acesso ao estoque;
- escopo de acesso sensível.

### 4.6 Não existe máquina de barreiras v2

O Sistema precisa validar a sequência:

```text
DOOR_AUTHORIZED
→ DOOR_OPEN
→ ENTRY_CONFIRMED
→ DOOR_CLOSED
→ SENSITIVE_CABINET_AUTHORIZED [se necessário]
→ SENSITIVE_CABINET_OPEN
→ SENSITIVE_CABINET_CLOSED
→ ACCESS_ACTIVE
→ CLOSED
```

`ENTRY_CONFIRMED` é o evento que deve levar a Ordem de `AGUARDANDO_RETIRADA` para `EM_SEPARACAO`.

## 5. Modelo mínimo necessário no HVB Sistema

Nomes físicos ainda podem ser ajustados ao padrão do projeto.

### Ordem

```text
ordem_retirada
ordem_retirada_item
```

Campos conceituais:

- organização/unidade;
- episódio;
- solicitante;
- estado;
- criado/submetido em;
- observação;
- item/apresentação;
- quantidade solicitada;
- sensibilidade derivada por regra do Sistema, não confiada ao cliente.

### Autenticação física

```text
auth_challenge
biometric_auth_evidence (ou registro mínimo equivalente)
auth_session
```

A biometria bruta/template não deve ser enviada rotineiramente para o Core.

### Acesso

```text
access_session
access_session_order
access_event
physical_barrier / device binding (ou equivalente)
```

`AccessSession` deve aceitar N ordens por desenho, mesmo que o MVP use uma.

## 6. API mínima requerida

O Sistema deverá fornecer semanticamente:

1. identificar credencial física e emitir challenge;
2. verificar evidência de autenticação local;
3. criar `AuthSession`;
4. listar Ordens de Retirada elegíveis/pendentes;
5. iniciar `AccessSession` idempotente;
6. consultar `AccessSession`;
7. registrar eventos físicos idempotentes;
8. consultar auditoria/estado necessário ao Terminal.

URLs definitivas devem seguir o OpenAPI do Sistema após implementação.

## 7. Reuso de idempotência existente

O HVB Sistema já possui conceito de `comando`, chave idempotente e consulta de resultado. Essa base deve ser reutilizada.

A integração v2 deve preferir:

```text
Idempotency-Key
X-Device-Id
Bearer / identidade da aplicação ou sessão apropriada
```

sem criar um segundo mecanismo concorrente de deduplicação no servidor.

No cliente, `command_id`/chave precisa permanecer estável em retries exatos.

## 8. Permissões propostas para revisão no Sistema

As permissões atuais:

```text
terminal:ler
terminal:configurar
terminal:usar
```

podem continuar como base, mas a semântica precisa ser revista.

Possível direção sem congelar nomes:

- ler estado/auditoria do Terminal;
- usar Terminal de Acesso;
- administrar dispositivos/barreiras;
- acessar estoque comum;
- acessar estoque sensível;
- autorizar contingência/break-glass.

Não criar permissões novas apenas por conveniência sem revisar a matriz global do Sistema.

## 9. Migrações existentes 047/048

`047_terminal_model.sql` e `048_terminal_integrity.sql` preservam corretamente imutabilidade, RLS e integridade do fluxo antigo, mas **não representam o modelo funcional v2**.

Não apagar dados/migrações históricas sem estratégia de evolução.

Quando o Sistema for autorizado a mudar, preferir novas migrations aditivas/corretivas e descontinuar semanticamente endpoints antigos, em vez de reescrever migrations já aplicadas.

## 10. Testes atuais do Sistema

`tests/terminal.test.ts` testa corretamente as invariantes da arquitetura anterior:

- scan não implica execução/cobrança;
- retirada reutiliza movimento de estoque;
- idempotência;
- revogação de etiqueta;
- vínculo operador/dispositivo;
- RLS/concorrência.

Os princípios de segurança e idempotência devem ser reaproveitados, mas os testes de retirada pelo Terminal precisarão ser substituídos/complementados por cenários v2.

## 11. Novo conjunto de testes requerido no Sistema

Quando autorizado:

- credencial revogada não emite challenge;
- challenge é curto, terminal-bound e single-use;
- evidence inválida/replay falha;
- AuthSession não abre barreira automaticamente;
- ordem sensível exige permissão adequada;
- AccessSession retry é idempotente;
- sequência física inválida é rejeitada;
- `ENTRY_CONFIRMED` inicia `EM_SEPARACAO`;
- abrir armário antes de fechar porta é rejeitado;
- Terminal nunca cria movimento de estoque;
- Mobile/API posterior é responsável pelo fulfillment/movimento;
- dispositivo desativado bloqueia novo comando;
- offline sensível é fail-closed.

## 12. Impacto no Terminal atual

Nenhuma reversão é necessária em `hvb-terminal-dev`.

O mock v2 atual está mais alinhado à decisão funcional aprovada do que o módulo `terminal` existente em `hvb-sistema-dev`.

Portanto:

```text
NÃO adaptar o Terminal v2 ao endpoint /terminal/retiradas atual.
NÃO reintroduzir picking no Terminal.
NÃO integrar enquanto o contrato do Sistema continuar pré-v2.
```

## 13. Bloqueio atual

A próxima etapa de integração real exige **alteração em `hvb-sistema-dev`**.

Essa branch não foi modificada nesta revisão.

Até existir autorização explícita para atualizar o HVB Sistema, o Terminal deve continuar evoluindo apenas em:

- mock/contratos v2;
- testes;
- fail-closed;
- ergonomia;
- documentação;
- preparação do adapter.
