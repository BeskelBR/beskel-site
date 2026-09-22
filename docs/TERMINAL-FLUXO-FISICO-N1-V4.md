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
   - porta principal;
   - acesso ao compartimento sensível quando o contexto exigir e o usuário possuir permissão.
5. `PRESENCE_CONFIRMED`
6. separação guiada no Terminal de Retirada por coordenada física exata
7. `DOOR_CLOSED`
8. `WITHDRAWAL_CONFIRMED`

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
→ procurar OUTRO LOTE elegível do mesmo produto
   ├─ existe → PICKING_LOT_REALLOCATED → nova coordenada/lote
   └─ não existe
      ├─ PICKING_PARTIAL
      └─ PICKING_UNAVAILABLE
```

A divergência do lote/posição original permanece auditável mesmo quando a retirada continua por outro lote. Para item sensível, a realocação só pode apontar para lote armazenado em área sensível.

## Confirmação

Os cliques de checklist não movimentam estoque real no protótipo.

A confirmação final só é habilitada quando:

- todas as linhas têm resultado resolvido (`CONFIRMED`, `PARTIAL` ou `UNAVAILABLE`);
- não há divergência aberta;
- a porta já gerou `DOOR_CLOSED`.

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
