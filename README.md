# HVB Terminal — Candidato de Aplicação v1

Status: **FECHAMENTO DE SOFTWARE / PRÉ-IMPLANTAÇÃO**  
Branch: `hvb-terminal-dev`  
Subprojeto: `05_TERMINAL_E_INFRAESTRUTURA`

A referência funcional vigente é `docs/TERMINAL-FLUXO-FISICO-N1-V4.md`.

## Fluxo N1 congelado

```text
NFC_VALIDATED
→ BIOMETRIC_VALIDATED
→ WITHDRAWAL_CONTEXT_CONFIRMED
→ ACCESS_GRANTED
→ DOOR_OPENED
→ PRESENCE_CONFIRMED
→ PICKING GUIADO
→ DOOR_CLOSED
→ WITHDRAWAL_CONFIRMED
```

O primeiro fator é **NFC TAG simples**, por decisão do HVB. A biometria permanece como segundo fator.

## Interfaces

- `/` — Terminal de Acesso;
- `/auth/:token` — autenticação DEV;
- `/ordens` — seleção de ORs e ajuste ao vivo DEV;
- `/acesso/:id` — AccessSession e eventos físicos;
- `/separacao/:id` — Terminal de Retirada;
- `/admin/auditoria` — auditoria DEV.

## Terminal de Retirada

O tablet interno recebe a mesma `AccessSession` do Terminal de Acesso.

O picking é guiado por coordenada e suporta:

- confirmação de retirada;
- material não encontrado;
- redirecionamento para coordenada alternativa;
- retirada parcial;
- indisponibilidade;
- preservação da divergência para auditoria.

O **estado do picking é autoridade do servidor** no contrato v1. O navegador não é mais a fonte oficial do checklist.

A confirmação final só é aceita após `DOOR_CLOSED` e somente se todos os grupos esperados estiverem resolvidos. A API valida o conjunto de itens, quantidades e coordenadas antes de aceitar `WITHDRAWAL_CONFIRMED`.

## Limite do ambiente atual

O branch continua em **DEV**:

```text
UI
→ /api/mock
→ IntegrationAdapter
→ MockAdapter
→ store em memória
```

Portanto, o mock valida o contrato e o fluxo, mas **não é infraestrutura de produção**.

Para aplicação real ainda são dependências externas ao mock:

1. API real do HVB Sistema + PostgreSQL;
2. catálogo e posições reais de estoque;
3. NFC Android real;
4. biometria real / face 1:1 + liveness;
5. controlador físico da porta e sensores;
6. política de contingência local diante de perda de rede/energia;
7. configuração Android Dedicated Device / Kiosk;
8. comissionamento e homologação no hospital.

## Regra para implantação

Nenhuma barreira física real deve ser comandada diretamente pelo navegador.

```text
Tablet
→ API / autorização
→ controlador local confiável
→ relé / fechadura

Sensores
→ controlador local
→ eventos autenticados
→ API
```

Novos acessos permanecem `FAIL_CLOSED` quando a autorização central não puder ser validada. A política para uma sessão já autorizada será fechada junto ao controlador/Edge no projeto executivo.

## QA

Testes do núcleo:

```bash
node --test tests/store.test.js
```

A suíte cobre autenticação simulada, múltiplas ORs, estoque sensível, sequência física, coordenadas, estado de picking no servidor, idempotência e rejeição de confirmação inconsistente.

## Próximo marco

O software funcional está em **candidato de aplicação**, não em produção.

O próximo marco é:

```text
VISITA TÉCNICA
→ projeto executivo físico
→ seleção do hardware
→ adapters reais
→ teste integrado
→ homologação
→ TERMINAL_V1_FROZEN
```
