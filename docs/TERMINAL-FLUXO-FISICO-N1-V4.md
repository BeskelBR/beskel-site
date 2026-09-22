# HVB Terminal — Fluxo físico N1 v4

Status: **N1 aprovado na reunião com o HVB**  
Subprojeto: `05_TERMINAL_E_INFRAESTRUTURA`

## Sequência física congelada

1. `NFC_VALIDATED`
2. `BIOMETRIC_VALIDATED`
3. `WITHDRAWAL_CONTEXT_CONFIRMED`
   - seleção de uma ou mais ORs; e/ou
   - ajuste ao vivo versionado para a AccessSession.
4. `ACCESS_GRANTED`
   - libera somente a porta principal;
   - se houver medicação sensível, a permissão é validada para a sessão, mas o armário permanece travado.
5. `PRESENCE_CONFIRMED`
6. separação guiada no Terminal de Retirada por lote/coordenada
   - materiais comuns podem ser retirados normalmente;
   - medicação sensível usa uma sessão de abertura sob demanda dentro da mesma AccessSession.
7. `PICKING_READY`
8. `PRESENCE_CLEARED`
9. `DOOR_CLOSED`
10. `WITHDRAWAL_CONFIRMED`

### Subfluxo de medicação sensível

```text
SENSITIVE_ACCESS_ELIGIBLE
→ funcionário toca "RETIRAR MEDICAÇÃO SENSÍVEL"
→ SENSITIVE_ACCESS_REQUESTED
→ SENSITIVE_ACCESS_GRANTED
→ SENSITIVE_DOOR_OPENED
→ picking somente dos itens sensíveis
→ SENSITIVE_DOOR_CLOSED
→ SENSITIVE_LOCK_CONFIRMED
→ SENSITIVE_ACCESS_COMPLETED
```

Não há segunda rodada de NFC/biometria. A identidade e a permissão já pertencem à AccessSession autenticada.

No DEV, a autorização de abertura expira em 15 segundos se o sensor não registrar a abertura. Expirada a janela, o armário permanece travado e o mesmo funcionário pode solicitar outra abertura dentro da sessão, sem nova autenticação.

Enquanto o subfluxo sensível estiver em `UNLOCK_AUTHORIZED`, `OPEN` ou `CLOSED`, o picking comum fica bloqueado. Isso reduz o tempo de armário aberto e mantém a retirada sensível como uma sessão operacional isolada.

`PICKING_READY` exige, quando houver itens sensíveis:

- todos os itens sensíveis resolvidos;
- porta do armário fechada;
- trava confirmada;
- `sensitive_state = COMPLETED`.

## Credencial

A v4 usa **NFC TAG simples** como primeiro fator, conforme decisão do HVB. A TAG identifica uma credencial revogável; permissões permanecem no servidor. A biometria continua como segundo fator.

## Terminal de Retirada

A tela interna recebe a mesma `AccessSession` e consolida ORs + ajustes ao vivo. Cada linha contém:

- material;
- quantidade esperada;
- coordenada física;
- indicação de item sensível;
- referências às ORs de origem.

## Alocação por lote e contingência

A coordenada pertence à ocupação física do **lote**, não ao produto. O responsável pelo estoque registra a coordenada ao armazenar o lote recebido.

Para itens com validade, o motor seleciona lotes por:

```text
1. FEFO — menor validade primeiro
2. FIFO — entrada mais antiga como desempate
3. identificador determinístico como último desempate
```

Uma mesma solicitação pode gerar várias tarefas de picking quando precisar consumir mais de um lote.

Quando o lote esperado não é encontrado na coordenada registrada:

```text
NÃO ENCONTRADO
→ STOCK_LOCATION_DISCREPANCY
→ sistema procura automaticamente o próximo lote elegível por FEFO/FIFO
   ├─ existe lote único com saldo suficiente
   │  → PICKING_LOT_REALLOCATED [automatic=true]
   │  → nova coordenada/lote apresentada ao operador
   └─ não existe alternativa suficiente
      ├─ PICKING_PARTIAL
      └─ PICKING_UNAVAILABLE
```

A divergência do lote/posição original permanece auditável mesmo quando a retirada continua por outro lote. Para item sensível, a realocação só pode apontar para lote armazenado em área sensível.

## Confirmação

Os cliques de checklist não movimentam estoque real no protótipo.

A confirmação final só é habilitada quando:

- todas as linhas têm resultado resolvido (`CONFIRMED`, `PARTIAL` ou `UNAVAILABLE`);
- não há divergência aberta;
- o armário sensível, quando aplicável, já está em `COMPLETED`;
- a saída da sala foi detectada;
- a porta principal já gerou `DOOR_CLOSED`.

A v4 DEV então registra `WITHDRAWAL_CONFIRMED` e preserva o resultado para auditoria, sem gerar `STOCK_CONSUMED`.

## Rotas de demonstração

- Terminal de Acesso: `/`
- Sessão: `/acesso/:access_session_id`
- Terminal de Retirada: `/separacao/:access_session_id`
- Auditoria: `/admin/auditoria`

## Limite de implantação

Esta revisão fecha o **fluxo funcional DEV**. Hardware real, sensores reais, relés/fechaduras, biometria real e escrituração transacional no HVB Sistema dependem do projeto executivo e da integração física/API.


## Fechamento de software — revisão 22/09/2026

A revisão de pré-implantação consolidou os seguintes pontos:

- o fluxo v4 é carregado antes da primeira renderização da rota;
- o link para o Terminal de Retirada pertence à própria sessão e não depende mais do bridge de DOM;
- o estado do picking passou a ser mantido no servidor do contrato, não no `localStorage` do tablet;
- cada evento de picking é validado contra o grupo esperado da AccessSession;
- a confirmação final é rejeitada se itens, quantidades, coordenadas ou estados divergirem do contexto autorizado;
- a edição ao vivo usa catálogo autenticado do servidor;
- sensibilidade e coordenada do material adicionado ao vivo não são definidas manualmente pelo operador;
- o mock continua sem movimentação real de estoque.

O estado atual é **candidato de aplicação**, ainda dependente da substituição do `MockAdapter` por API/PostgreSQL reais e dos adapters físicos de NFC, biometria e controlador.


## Invariante logística de estoque

```text
PRODUTO
→ LOTE
→ OCUPAÇÃO FÍSICA
→ COORDENADA
```

Não existe vínculo permanente `produto → coordenada`.

Regras:

- um lote ativo ocupa uma coordenada registrada pelo responsável do estoque;
- lotes distintos do mesmo produto permanecem fisicamente separados;
- o mesmo produto pode existir simultaneamente em várias coordenadas porque possui lotes distintos;
- a coordenada volta a ficar livre quando a ocupação do lote é encerrada;
- o Terminal recebe da API a tarefa já alocada com `stock_lot_id`, lote, validade, coordenada e quantidade;
- o mock não altera estoque real nem representa reserva concorrente de produção.


## Delta de integridade pós-QA — 22/09/2026

Para tornar a sequência física executável sem contradição entre a tela interna e a porta, o N1 foi refinado sem alterar sua ordem macro:

```text
PRESENCE_CONFIRMED
→ picking
→ PICKING_READY
→ PRESENCE_CLEARED
→ DOOR_CLOSED
→ WITHDRAWAL_CONFIRMED
```

`PICKING_READY` é gerado automaticamente quando todas as tarefas estão resolvidas e, quando aplicável, o armário sensível está em `COMPLETED`. Até `PRESENCE_CLEARED`, o operador pode desfazer o último item; o servidor então registra `PICKING_REOPENED` e retorna a `ENTRY_CONFIRMED`. Após a saída detectada, o picking fica imutável.

A AccessSession ocupada não expira destrutivamente: ultrapassar o TTL gera alerta de timeout, mas preserva a possibilidade de concluir com segurança a saída e o fechamento.

A confirmação final é construída a partir do estado persistido no servidor, não de resultados informados pelo cliente.


## Delta final — medicação sensível sob demanda

A alteração final aprovada separa o destravamento do armário sensível do acesso principal à sala.

Abertura da porta principal nunca gera `SENSITIVE_DOOR_OPENED`.

A sessão conserva a autorização do funcionário, mas o armário fica fisicamente travado até pedido explícito no Terminal de Retirada. Cada abertura fica vinculada à mesma AccessSession, usuário e trilha de auditoria.

Se o armário for fechado com itens sensíveis ainda pendentes, `SENSITIVE_LOCK_CONFIRMED` devolve o subfluxo a `LOCKED`, permitindo outra abertura sob demanda. Quando não restar item sensível pendente, a confirmação da trava promove o subfluxo a `COMPLETED`.

O Terminal não permite sair para `PICKING_READY` enquanto o armário não estiver confirmado como travado.


## Delta N1 — redução de interação humana

Sem alterar as invariantes de segurança, o fluxo operacional foi simplificado:

```text
TAG NFC
→ biometria iniciada automaticamente
→ ORs/contexto
→ INICIAR RETIRADA
→ porta / presença por sensores
→ Terminal de Retirada assume a AccessSession automaticamente
→ picking
→ saída
→ porta fechada
→ WITHDRAWAL_CONFIRMED automático
```

### Regras

- leitura NFC válida dispara a etapa biométrica sem toque intermediário;
- biometria aprovada encaminha automaticamente às ORs;
- o tablet interno fica permanentemente em `/separacao` e consulta a sessão ativa da sala usando identidade de dispositivo;
- no DEV, essa identidade é simulada; produção exige credencial de dispositivo provisionada e protegida;
- o operador não transfere `access_session_id` nem token entre telas;
- `DOOR_CLOSED` após `PICKING_READY` + `PRESENCE_CLEARED` dispara a confirmação final no servidor;
- `WITHDRAWAL_CONFIRMED` continua server-authoritative;
- o endpoint manual de confirmação permanece apenas como mecanismo técnico de recuperação/compatibilidade, não como ação normal do operador.

## Delta final — auto-ready e recuperação FEFO

O botão **Concluir separação** foi removido do fluxo normal.

```text
última tarefa resolvida
+ armário sensível seguro, quando aplicável
→ PICKING_READY automático
```

A automação não elimina a correção humana: enquanto a presença ainda não tiver sido encerrada, **Desfazer último item** reabre o picking. Essa janela termina em `PRESENCE_CLEARED`.

A contingência logística também deixa de pedir ao funcionário que escolha entre lotes equivalentes:

```text
NÃO ENCONTREI
→ registrar divergência original
→ ordenar alternativas por FEFO/FIFO
→ escolher automaticamente a primeira alternativa suficiente
→ registrar realocação automática
→ exibir nova coordenada
```

Lotes/coordenadas já marcados como não encontrados na mesma tarefa são excluídos das próximas tentativas automáticas. Se nenhuma alternativa possuir saldo suficiente, a tarefa permanece `EXCEPTION` e o operador decide apenas entre parcial ou indisponível.
