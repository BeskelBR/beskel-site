# HVB Terminal — Arquitetura Funcional v3

Status: **APROVADO PARA PROTÓTIPO / IMPLEMENTADO EM DEV**
Data: 16/09/2026

Esta versão substitui funcionalmente a dependência imediata de HVB Mobile/WhatsApp prevista em versões anteriores, preservando as decisões válidas de autenticação, AccessSession, segurança e separação entre acesso físico e escrituração.

## Arquitetura vigente

```text
HVB SISTEMA / CONSULTÓRIO
→ cria e gerencia Ordens de Retirada

TERMINAL DE ACESSO — fora da sala
→ DESFire + face 1:1 + PAD/liveness
→ consulta ordens
→ seleciona 1..N ORs
→ cria AccessSession
→ libera/acompanha acesso físico

TERMINAL DE RETIRADA — dentro da sala
→ recebe a AccessSession ativa
→ consolida ORs por material/endereço
→ orienta o picking
→ registra checklist e exceções
→ confirma a retirada

API HVB
→ valida e escritura

POSTGRESQL
→ fonte oficial dos fatos

CONTROLADOR FÍSICO
→ executa porta/armário conforme autorização válida
```

## Regra central

```text
AUTENTICAÇÃO ≠ ACESSO
ACESSO ≠ PICKING
PICKING ≠ ESCRITURAÇÃO
```

O Terminal externo autentica e controla o contexto físico. A tela interna acompanha o ato de separação. A API permanece a autoridade de domínio.

## Fluxo operacional

```text
CONSULTÓRIO SOLICITA
→ FUNCIONÁRIO AUTENTICA NO TERMINAL EXTERNO
→ SELECIONA 1..N ORs
→ ACCESSSESSION
→ PORTA LIBERA
→ ENTRY_CONFIRMED
→ TELA INTERNA LIBERA CHECKLIST
→ SEPARAÇÃO GUIADA POR ENDEREÇO
→ CONFIRMAR RETIRADA
→ API ESCRITURA
→ TERMINAL EXTERNO ENCERRA SESSÃO FÍSICA
```

## Endereçamento físico

A tela interna prioriza o endereço:

```text
A2  Agulha 25 x 7    2 un
G4  Gaze estéril     4 un
E1  Medicamento X    1 un [SENSÍVEL]
```

Em produção, o endereço deve vir da posição de estoque da API HVB. No protótipo DEV atual, existe somente um mapa local simulado para demonstrar UX.

## Múltiplas ordens

Materiais iguais podem ser consolidados para o picking, mantendo a rastreabilidade:

```text
G4  Gaze estéril  6 un
    OR-1842 · 2
    OR-1847 · 4
```

## Checklist

Interações da tela interna:

- `Retirado`;
- `Desfazer`;
- `Não encontrado`;
- `CONFIRMAR RETIRADA`.

A confirmação final só habilita quando todas as posições estiverem conferidas e não houver pendências.

Cliques intermediários não geram baixa definitiva. A futura escrituração deve acontecer atomicamente na API após confirmação final.

## Sensíveis

Itens sensíveis permanecem bloqueados visualmente enquanto a sessão não atingir estado compatível com acesso ao armário sensível. A tela interna nunca é autoridade autônoma para destravar barreiras.

## Saída

O Terminal externo não repete o checklist. Antes de encerrar a AccessSession, futuramente consulta o estado do fulfillment:

```text
SEM PENDÊNCIAS
→ encerrar acesso

COM PENDÊNCIA
→ orientar retorno à tela interna
```

## Mensageria e Mobile

WhatsApp, Telegram e HVB Mobile são **opções futuras**, não dependências da primeira versão operacional.

A decisão reduz:

- custo variável de mensageria;
- dependência de telefone pessoal;
- desenvolvimento prematuro de aplicativo/PWA móvel;
- risco do funcionário se perder entre ORs no interior da sala.

## Hardware alvo

Primeiro teste recomendado:

- tablet Android de aproximadamente 10–11 polegadas;
- modo kiosk;
- alimentação contínua;
- Wi-Fi/LAN local.

Alternativa posterior:

- monitor touchscreen maior + mini-PC.

Bluetooth não é barramento principal da arquitetura; pode ser usado por periféricos.

## Estado DEV implementado

- Terminal de Acesso existente preservado;
- nova rota `/separacao/:access_session_id`;
- vínculo entre telas pela mesma AccessSession;
- espera por `ENTRY_CONFIRMED`;
- UI orientada a touchscreen;
- agrupamento por localização/material;
- checklist local;
- exceção `Não encontrado`;
- sensíveis bloqueados conforme estado físico;
- confirmação final simulada;
- nenhuma baixa real em PostgreSQL/estoque.

## Próximo delta dependente do HVB Sistema

- localização física real fornecida pela API;
- fulfillment persistente;
- confirmação final idempotente;
- exceções e ajustes persistentes;
- stock transactions/custo/auditoria após commit;
- validação de pendências na saída.
