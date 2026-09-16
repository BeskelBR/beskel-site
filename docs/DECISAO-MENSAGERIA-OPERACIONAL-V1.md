# HVB Terminal — decisão transitória de mensageria operacional v1

Data: 16/09/2026
Status: **APROVADO PARA PROTÓTIPO / DEMONSTRAÇÃO**

## 1. Decisão

O **HVB Mobile** deixa de ser dependência da fase atual do Terminal.

Para o protótipo e para a validação operacional inicial com o HVB, a lista das Ordens de Retirada selecionadas será entregue ao telefone do servidor autenticado por um **canal de mensageria**.

Preferência atual do protótipo: **WhatsApp**.

Telegram permanece alternativa futura, sem implementação obrigatória nesta fase.

Esta decisão não elimina a possibilidade de um HVB Mobile/PWA no futuro. Apenas evita introduzir agora uma nova cadeia de produto, distribuição, suporte e manutenção antes de a rotina operacional estar validada.

## 2. Separação de responsabilidades

```text
HVB SISTEMA / CONSULTÓRIO
→ cria a Ordem de Retirada

TERMINAL DE ACESSO
→ autentica
→ mostra ordens e materiais
→ permite selecionar 1..N ORs
→ cria AccessSession
→ participa do controle físico

MENSAGERIA DO FUNCIONÁRIO
→ recebe a lista das ORs selecionadas
→ serve como referência dentro da sala
→ não escritura
→ não autoriza
→ não confirma consumo por si só

API HVB
→ autoridade de autorização e escrituração

POSTGRESQL
→ fonte oficial dos fatos persistidos
```

## 3. Fluxo da demonstração

```text
servidor autentica
→ Terminal mostra ORs e materiais
→ servidor seleciona 1..N ORs
→ confirma o conjunto
→ API/mock cria AccessSession
→ Terminal prepara a mensagem consolidada
→ WhatsApp abre no telefone/contato configurado
→ porta segue o fluxo de autorização
```

No protótipo atual, o `wa.me` apenas abre a conversa com o texto pré-preenchido. O usuário ainda confirma o envio.

**Disparo automático sem toque humano** exige posteriormente WhatsApp Business Platform/API ou provedor equivalente. Essa integração não faz parte desta demonstração.

## 4. Conteúdo mínimo da mensagem

A mensagem deve conter apenas o necessário para a retirada:

- identificador da OR;
- descrição do material;
- quantidade;
- indicação de item sensível quando útil à operação.

Evitar dados clínicos desnecessários, anamnese, diagnóstico, valores financeiros e outras informações que não sejam necessárias ao ato operacional.

## 5. Contato do funcionário

O destino definitivo deve vir do cadastro do servidor no HVB Sistema, não do frontend do Terminal.

Modelo conceitual:

```text
employee_contact
- employee_id
- channel
- address
- active
- verified_at
- notification_enabled
```

No DEV, o telefone de teste fica somente no `localStorage` do navegador ou é fornecido temporariamente por parâmetro de URL. Não deve ser hardcoded em repositório público.

## 6. WhatsApp x Telegram

### WhatsApp — preferência atual

Vantagens operacionais:

- menor atrito de adoção no ambiente brasileiro;
- identificação natural pelo número de telefone;
- uso direto do WhatsApp Business já existente;
- deep link `wa.me` simples para demonstração;
- não exige criar um aplicativo próprio para acompanhar a lista.

Limites:

- automação real exige API/plataforma oficial e suas políticas;
- o canal não deve virar fonte de verdade;
- conteúdo deve ser minimizado.

### Telegram — alternativa futura

Vantagens técnicas:

- bots e automações são simples de estruturar;
- boa capacidade de interação com bot e mensagens estruturadas.

Limites operacionais:

- adiciona uma ferramenta que parte da equipe pode não usar;
- vinculação prática costuma depender de bot/chat iniciado ou identificador próprio, não apenas do telefone cadastrado;
- aumenta treinamento e governança de outro canal.

## 7. Regra vigente

Para a fase atual:

```text
WHATSAPP GUIA A RETIRADA
API HVB AUTORIZA E ESCRITURA
TERMINAL NÃO MOVIMENTA ESTOQUE DIRETAMENTE
```

O canal pode mudar no futuro sem alterar o domínio central, desde que a integração seja implementada por um adaptador de notificação/mensageria.
