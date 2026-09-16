# HVB Terminal — Arquitetura Funcional v2

Status: **APROVADO FUNCIONALMENTE / NÃO IMPLEMENTADO**

Este documento substitui a concepção funcional anterior do Terminal como estação completa de retirada. O código do protótipo atual permanece inalterado até uma etapa específica de migração.

## 1. Papel do Terminal

O HVB Terminal passa a ser um **Terminal de Acesso HVB**.

Ele é responsável por:

- identificar o usuário;
- autenticar o usuário;
- validar ordens pendentes e permissões pela API;
- iniciar uma sessão de acesso;
- participar do controle físico de porta/armário;
- registrar eventos de autenticação e acesso;
- operar de forma conservadora em contingência.

Ele **não** é a interface principal de picking, conferência de materiais, ajuste de quantidades, devolução, acréscimo, consumo ou faturamento.

## 2. Separação de responsabilidades

```text
HVB SISTEMA / CONSULTÓRIO
→ cria e gerencia a Ordem de Retirada
→ vincula episódio/paciente
→ define itens, quantidades, observações e solicitante
→ submete a ordem

TERMINAL DE ACESSO HVB
→ identifica credencial
→ valida autenticação local
→ envia evidências à API
→ consulta ordens e permissões
→ inicia AccessSession
→ participa do controle físico
→ registra eventos de acesso

HVB MOBILE
→ apresenta a Ordem de Retirada
→ guia o picking
→ captura exceções
→ captura lote/apresentação quando obrigatório
→ confirma o resultado real da retirada

API HVB
→ autentica e autoriza
→ aplica regras
→ valida estados
→ garante idempotência
→ escritura estoque/custo/auditoria
→ publica eventos/outbox

POSTGRESQL
→ fonte transacional oficial

CONTROLADOR FÍSICO
→ executa abertura/trava somente mediante autorização válida

WHATSAPP
→ notifica e fornece acesso rápido
→ não escritura
→ não autoriza
```

## 3. Ordem de Retirada

A Ordem de Retirada nasce no HVB Sistema, vinculada ao episódio/atendimento e ao solicitante.

Estados mínimos aprovados:

```text
RASCUNHO
  ↓ submit
AGUARDANDO_RETIRADA
  ↓ entrada física confirmada
EM_SEPARACAO
  ↓ confirmação pelo HVB Mobile/API
RETIRADA_CONFIRMADA
  ↓ sessão encerrada e sem pendências
ENCERRADA

CANCELADA = estado terminal alternativo
```

### Regras

- `ENVIADA` é evento/comando, não estado obrigatório.
- `EM_SEPARACAO` só começa após confirmação física de entrada, não na simples liberação da porta.
- devolução e acréscimo não são estados da ordem; são novas transações/eventos vinculados ao histórico.
- fatos consumados não são editados destrutivamente.

## 4. Autenticação padrão

Arquitetura prevista:

```text
DESFire EV3
→ identidade alegada
→ reconhecimento facial 1:1
→ PAD/liveness
→ evidência autenticada do terminal
→ validação da API
→ AccessSession
```

Princípios:

- não usar reconhecimento 1:N como fluxo normal;
- processar biometria localmente quando possível;
- não enviar biometria bruta rotineiramente à nuvem;
- templates devem ser protegidos/criptografados;
- a API não deve confiar em um simples `face_match=true` vindo do cliente;
- evidências precisam ser frescas, anti-replay e vinculadas a terminal/dispositivo confiável.

Exemplo conceitual de evidência:

```text
authentication_evidence
- credential_id
- terminal_id
- challenge_id
- face_match
- liveness
- engine_version
- occurred_at
- nonce
- device_signature/attestation
```

## 5. Sessão de acesso

`AccessSession` é entidade distinta da sessão web comum.

Exemplo conceitual:

```text
session_id
user_id
terminal_id
started_at
expires_at
auth_level
sensitive_access
status
```

A sessão pode estar vinculada a uma ou mais ordens quando isso for funcionalmente necessário.

## 6. Estoque sensível

A máquina de acesso físico é separada da máquina de estados da Ordem:

```text
AUTHENTICATED
→ DOOR_AUTHORIZED
→ DOOR_OPEN
→ ENTRY_CONFIRMED
→ DOOR_CLOSED
→ SENSITIVE_CABINET_AUTHORIZED [se necessário]
→ CABINET_OPEN
→ CABINET_CLOSED
→ EXIT
→ ACCESS_SESSION_CLOSED
```

Regras:

- não liberar porta e armário desnecessariamente ao mesmo tempo;
- o controlador físico recebe autorização para transições específicas, não um comando genérico de destravar tudo;
- item sensível adicionado após a entrada exige ampliação explícita do escopo/step-up antes da liberação do armário.

## 7. HVB Mobile

O dispositivo móvel autorizado é a interface principal de picking.

Fluxo padrão:

```text
ordem aberta
→ lista de itens
→ conferência
→ CONFIRMAR TUDO
```

Exceções:

- quantidade diferente;
- item não retirado;
- item adicional;
- retirada adicional;
- devolução posterior;
- captura obrigatória de lote/apresentação/recipiente quando exigido.

`CONFIRMAR TUDO` é o caminho de baixa fricção, mas nunca elimina captura obrigatória de rastreabilidade física.

O fluxo não deve depender obrigatoriamente de smartphone pessoal. A arquitetura deve aceitar PWA em dispositivo móvel autorizado, inclusive equipamento corporativo/compartilhado.

## 8. Escrituração

Terminal e Mobile nunca escrevem diretamente no PostgreSQL.

Confirmação normal:

```text
HVB Mobile
→ API HVB
→ valida ordem, sessão e usuário
→ valida quantidades/lotes
→ cria fulfillment
→ cria movimentos de estoque
→ vincula episódio/paciente/profissional
→ calcula custo real
→ avalia eventual reflexo comercial
→ registra auditoria
→ grava outbox
→ COMMIT
```

Integrações externas e notificações acontecem depois do commit.

## 9. Imutabilidade e correções

Nenhum movimento finalizado é alterado destrutivamente.

Exemplo:

```text
RETIRADA ORIGINAL  -2
DEVOLUCAO          +1  ref=movimento original
resultado líquido  -1
```

Acréscimo segue o mesmo princípio:

```text
RETIRADA ORIGINAL   -1
RETIRADA ADICIONAL  -1  motivo obrigatório
resultado líquido   -2
```

Todo evento corretivo deve registrar referência, motivo, autor e timestamp.

## 10. Funcionário sem crachá

Níveis conceituais:

```text
AUTH_LEVEL_STANDARD
DESFire + face + PAD

AUTH_LEVEL_DEGRADED
face + credencial lógica
physical_credential_absent=true

AUTH_LEVEL_BREAK_GLASS
face + segundo autorizador/fator
+ justificativa obrigatória
+ auditoria destacada
```

Política preliminar:

- estoque comum pode admitir modo degradado conforme política do HVB;
- estoque sensível exige nível adequado e, sem crachá, fluxo reforçado;
- offline + sensível = `FAIL_CLOSED` por padrão.

## 11. Contingência offline

Toda ação offline deve conter:

- ID único;
- idempotency key;
- `occurred_at`;
- `device_id`;
- `offline=true`;
- estado de sincronização;
- fila local persistente.

### Estoque comum

Pode operar de forma degradada somente se houver política local válida, credencial previamente conhecida, autenticação local válida e contexto mínimo cacheado.

A interface deve informar **"registrado localmente — sincronização pendente"**, nunca sugerir confirmação definitiva antes da sincronização.

### Estoque sensível

`FAIL_CLOSED` por padrão. Qualquer exceção depende de procedimento físico formal do HVB.

### Dependência futura

Com Terminal e Mobile simultaneamente offline, uma arquitetura apenas cliente-local pode ser insuficiente. Deve permanecer possível adicionar futuramente um **HVB Edge/gateway local** para coordenação em LAN sem alterar o domínio central.

## 12. WhatsApp

Princípio:

```text
WHATSAPP NOTIFICA
HVB MOBILE OPERA
API ESCRITURA
```

Mensagens devem conter o mínimo necessário e deep link para a ordem. O link não pode carregar autorização suficiente para executar operação nem dados clínicos desnecessários.

## 13. Interface do Terminal

Fluxo alvo:

### Repouso

```text
HVB
Terminal de Acesso
Aproxime seu crachá
```

### Autenticação

```text
Credencial identificada
Dra. Ana
Confirme sua identidade
[câmera / PAD]
```

### Autorização

```text
Dra. Ana
OR-1842
5 itens aguardando retirada
✓ identidade confirmada
✓ acesso autorizado
Abrindo sala...
```

### Acesso ativo

```text
ACESSO AUTORIZADO
OR-1842
Continue a separação pelo HVB Mobile.
Sessão ativa
```

## 14. Invariantes

```text
NFC ≠ autenticação completa
Face ≠ autorização
Autenticação ≠ consumo
Acesso ≠ retirada
Retirada ≠ execução clínica
Consumo ≠ faturamento
```

Cada fato possui registro próprio.

## 15. Fluxo normal oficial

```text
CONSULTÓRIO SOLICITA
→ FUNCIONÁRIO RECEBE
→ TERMINAL AUTENTICA
→ SALA LIBERA
→ MOBILE GUIA
→ CONFIRMAR TUDO
→ API ESCRITURA
→ ESTOQUE / CUSTO / ATENDIMENTO / AUDITORIA SÃO ATUALIZADOS
```

O usuário informa apenas o que o sistema não consegue inferir com segurança.

## 16. Dependências ainda abertas

- regra de atribuição da ordem;
- uma ou várias ordens por sessão;
- múltiplas pessoas simultaneamente na sala;
- mecanismo físico de saída;
- classes que exigem captura obrigatória de lote;
- classificação formal de item sensível;
- engine de reconhecimento e PAD;
- política de templates biométricos;
- controlador físico e protocolo;
- estratégia offline/Edge;
- política de dispositivo móvel;
- regra de supervisor/break-glass;
- provedor WhatsApp;
- regra final de encerramento da ordem.

Essas pendências não invalidam a arquitetura funcional aprovada; devem ser resolvidas antes das respectivas implementações.