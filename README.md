# HVB Terminal — Candidato de Aplicação v1

Status: **FECHAMENTO DE SOFTWARE / PRÉ-IMPLANTAÇÃO**  
Branch: `hvb-terminal-dev`  
Subprojeto: `05_TERMINAL_E_INFRAESTRUTURA`

A referência funcional vigente é `docs/TERMINAL-FLUXO-FISICO-N1-V4.md`.

## Fluxo N1 congelado

```text
NFC_VALIDATED
→ BIOMETRIC_VALIDATED            [automático após NFC]
→ WITHDRAWAL_CONTEXT_CONFIRMED
→ ACCESS_GRANTED
→ DOOR_OPENED
→ PRESENCE_CONFIRMED
→ PICKING GUIADO
→ PICKING_READY
→ PRESENCE_CLEARED
→ DOOR_CLOSED
→ WITHDRAWAL_CONFIRMED           [automático]
```

O primeiro fator é **NFC TAG simples**, por decisão do HVB. A biometria permanece como segundo fator, porém a captura é iniciada automaticamente após a leitura da TAG; não existe botão intermediário de confirmação.

## Interfaces

- `/` — Terminal de Acesso;
- `/auth/:token` — autenticação DEV;
- `/ordens` — seleção de ORs e ajuste ao vivo DEV;
- `/acesso/:id` — AccessSession e eventos físicos;
- `/separacao` — Terminal de Retirada em kiosk, aguardando e assumindo automaticamente a AccessSession ativa;
- `/separacao/:id` — rota DEV/compatibilidade para uma sessão específica;
- `/admin/auditoria` — auditoria DEV.

## Logística por lote

O candidato v1 não possui coordenada fixa por produto.

```text
produto → lote → ocupação → coordenada
```

O responsável do estoque define a posição física de cada lote no recebimento. Na retirada, a API aloca por **FEFO** e usa **FIFO** como desempate. Se a quantidade solicitada atravessar dois lotes, o Terminal recebe duas tarefas físicas independentes, cada uma com lote, validade, posição e quantidade.



## Medicação sensível

A medicação sensível possui subfluxo próprio dentro da AccessSession já autenticada. A permissão é validada no início, porém o armário permanece travado até o funcionário tocar **Retirar medicação sensível** no Terminal de Retirada.

Não ocorre nova autenticação. Abertura, fechamento e confirmação da trava são eventos físicos independentes e auditáveis. Quando todos os itens estiverem resolvidos, `PICKING_READY` é gerado automaticamente; em sessões sensíveis isso só acontece após a trava do armário ser confirmada.

## Terminal de Retirada

O tablet interno permanece em `/separacao` em modo kiosk e assume automaticamente a AccessSession ativa da sala. O operador não precisa abrir, parear ou transportar manualmente a sessão entre os dois terminais. No DEV a identidade do dispositivo é simulada; em produção deverá vir de provisionamento seguro do tablet/controlador.

O picking é guiado por coordenada e suporta:

- confirmação de retirada;
- material não encontrado;
- realocação automática para o próximo lote/coordenada elegível por FEFO/FIFO;
- retirada parcial;
- indisponibilidade;
- preservação da divergência para auditoria.

O **estado do picking é autoridade do servidor** no contrato v1. O navegador não é mais a fonte oficial do checklist.

Após `PICKING_READY`, `PRESENCE_CLEARED` e `DOOR_CLOSED`, a API valida o estado server-side e gera `WITHDRAWAL_CONFIRMED` automaticamente. Não existe confirmação final adicional do operador.

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


## Delta de redução de interação humana — 22/09/2026

Três ações intermediárias foram removidas do fluxo do operador:

1. NFC válida inicia automaticamente a biometria; não há botão **Confirmar identidade**.
2. Após biometria aprovada, as ORs são carregadas automaticamente; não há botão **Ver ordens e materiais**.
3. O Terminal de Retirada assume automaticamente a AccessSession da sala e, após saída + porta fechada, a retirada é confirmada automaticamente.

Mantêm-se como ações humanas deliberadas: escolha do contexto/OR, confirmação de cada item retirado, tratamento de exceções e o botão **Retirar medicação sensível**.

## Delta final de picking — automação

O operador não executa mais **Concluir separação**.

Quando a última tarefa fica resolvida (`CONFIRMED`, `PARTIAL` ou `UNAVAILABLE`) e o armário sensível, quando aplicável, está em `COMPLETED`, o servidor promove a sessão automaticamente para `PICKING_READY`.

Enquanto `PRESENCE_CLEARED` ainda não ocorreu, o Terminal de Retirada oferece **Desfazer último item**. Essa ação reabre o picking em `ENTRY_CONFIRMED`. Depois da saída detectada, o picking não pode mais ser alterado.

Para `Não encontrei`, o servidor registra `STOCK_LOCATION_DISCREPANCY` e tenta automaticamente o próximo lote elegível pela mesma ordenação FEFO/FIFO. Havendo lote único com saldo suficiente, registra `PICKING_LOT_REALLOCATED` e apresenta a nova coordenada sem escolha humana. Só permanece em exceção quando não existe alternativa suficiente, caso em que o operador decide entre retirada parcial ou indisponibilidade.
