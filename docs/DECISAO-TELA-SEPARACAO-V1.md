# HVB Terminal — decisão de tela interna de separação v1

Data: 16/09/2026
Status: **APROVADO PARA PROTÓTIPO / VALIDAÇÃO OPERACIONAL**

## 1. Decisão

A primeira versão operacional do fluxo de estoque passa a usar duas interfaces físicas distintas:

```text
TERMINAL DE ACESSO — fora da sala
→ identifica/autentica
→ permite selecionar 1..N Ordens de Retirada
→ cria AccessSession
→ participa da liberação física

TERMINAL DE RETIRADA / TELA DE SEPARAÇÃO — dentro da sala
→ recebe a AccessSession ativa
→ mostra as ORs e os materiais
→ organiza o picking por endereço físico
→ acompanha checklist/progresso
→ registra exceções no fluxo futuro
→ confirma a retirada ao final
```

WhatsApp, Telegram e HVB Mobile deixam de ser dependências da fase atual. Permanecem opções futuras.

## 2. Princípio operacional

```text
CONSULTÓRIO SOLICITA
→ TERMINAL EXTERNO AUTENTICA
→ SALA LIBERA
→ TELA INTERNA GUIA
→ FUNCIONÁRIO CONFIRMA
→ API HVB ESCRITURA
→ TERMINAL EXTERNO ENCERRA A SESSÃO FÍSICA
```

A confirmação operacional da retirada ocorre **dentro da sala**, no momento em que o profissional ainda está diante do estoque.

O Terminal de Acesso externo não deve obrigar o funcionário a reconstruir o checklist na saída. Sua função de saída é verificar se a sessão possui pendências e encerrar o acesso físico.

## 3. Endereçamento físico

A tela interna destaca o endereço físico antes do nome do material.

Exemplo:

```text
A2  Agulha 25 x 7    2 un
G4  Gaze estéril     4 un
E1  Medicamento X    1 un   [SENSÍVEL]
```

No protótipo atual, os endereços são uma **simulação local de DEV** baseada no nome dos materiais. Em produção, o endereço deve vir do domínio de estoque do HVB Sistema, associado à posição física real, lote/recipiente quando aplicável e unidade hospitalar.

Não hardcodar endereço no produto como fonte oficial.

## 4. Múltiplas ordens

Uma AccessSession pode conter 1..N ORs.

A visão padrão da tela interna consolida materiais iguais por endereço para reduzir caminhada e leitura, mas preserva as ORs de origem.

Exemplo:

```text
G4  Gaze estéril  6 un
    OR-1842 · 2
    OR-1847 · 4
```

## 5. Checklist e confirmação

O protótipo possui interação touchscreen:

- `Retirado` — confirma a posição no checklist;
- `Desfazer` — corrige antes da confirmação final;
- `Não encontrado` — sinaliza exceção/pêndencia;
- `CONFIRMAR RETIRADA` — habilita apenas quando não houver pendências.

Os cliques intermediários representam **estado de picking em andamento**. Eles não devem gerar movimentos definitivos de estoque individualmente.

A confirmação final é o ponto futuro para enviar um comando atômico à API HVB.

## 6. Itens sensíveis

Itens sensíveis aparecem na tela, mas ficam bloqueados enquanto a AccessSession não estiver em estado físico compatível com abertura/autorização do armário sensível.

A tela interna não destrava porta ou armário por conta própria.

## 7. Hardware

A interface é web e pode rodar em:

- tablet Android simples em modo kiosk;
- monitor touchscreen + mini-PC;
- painel web em dispositivo corporativo fixo.

Para o protótipo, a recomendação é validar primeiro em touchscreen de aproximadamente 10–11 polegadas. Se a operação real exigir maior área visual/robustez, migrar para monitor touchscreen maior sem alterar o contrato lógico.

Bluetooth não é requisito do fluxo principal. A comunicação preferencial futura é LAN/Wi-Fi local com API/WebSocket; Bluetooth pode ser reservado a periféricos.

## 8. Estado do protótipo

Implementado na branch `hvb-terminal-dev`:

- rota `/separacao/:access_session_id`;
- tela interna responsiva/touchscreen;
- leitura da mesma AccessSession do Terminal externo;
- espera por `ENTRY_CONFIRMED`;
- consolidação por endereço/material;
- checklist local DEV;
- bloqueio visual de sensíveis até armário aberto/estado compatível;
- confirmação final simulada;
- nenhuma baixa real de estoque.

## 9. Próxima integração com HVB Sistema

Quando os contratos do HVB Sistema estiverem estáveis, substituir os elementos simulados por:

- `location_code`/posição física vindos da API;
- fulfillment persistente;
- exceções persistentes;
- confirmação final idempotente;
- movimentos de estoque/custo/auditoria após commit;
- consulta de pendências pelo Terminal externo antes de `ACCESS_SESSION_CLOSED`.
