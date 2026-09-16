# Teste DEV — múltiplas Ordens de Retirada + WhatsApp

Status: DEV/mock. Não usa dados reais, estoque real, biometria real ou provedor oficial de WhatsApp.

## Objetivo

Validar:

- autenticação simulada;
- exibição dos materiais no Terminal após autenticação;
- seleção simultânea de 2 ou mais Ordens de Retirada;
- criação de uma única `AccessSession` vinculada ao conjunto selecionado;
- visualização consolidada das listas na tela de acesso;
- preparação de mensagem WhatsApp com os materiais;
- ausência de qualquer escrituração de estoque pelo Terminal.

## Massa de teste

O `server/store.js` contém pelo menos 10 Ordens de Retirada sintéticas simultaneamente em `AGUARDANDO_RETIRADA`, com mistura de ordens comuns e sensíveis.

A credencial DEV principal é `demo-rafael`, acionada pelo botão de simulação da tela inicial.

## Roteiro

1. Abra o Terminal DEV.
2. Opcionalmente configure o WhatsApp de teste no campo `WhatsApp • DEV` ou acrescente uma vez à URL:

   `?whatsapp=<numero_em_formato_internacional>`

   Exemplo de formato: `5561999999999`.

   O número é salvo no `localStorage` do dispositivo e removido da URL. Não é persistido no repositório.

3. Clique em `Simular credencial de teste`.
4. Confirme a autenticação biométrica simulada.
5. Acesse `Ordens e materiais`.
6. Confirme que cada Ordem exibe a lista de materiais e quantidades.
7. Selecione pelo menos 2 ordens; testar também 3 ou mais.
8. Use `WhatsApp com selecionadas` para abrir a mensagem pré-preenchida.
9. Volte ao Terminal e clique em `Confirmar N ordem(ns) e autorizar acesso`.
10. Na sessão criada, confirme que todas as ordens selecionadas e suas listas aparecem na tela.
11. Execute a sequência DEV de porta/entrada.
12. Após `ENTRY_CONFIRMED`, todas as ordens da sessão devem aparecer como `EM_SEPARACAO` no mock.
13. O Terminal não deve registrar `STOCK_CONSUMED` nem produzir movimentação de estoque.

## WhatsApp

O protótipo apenas abre `https://wa.me/...` com mensagem pré-preenchida. O envio depende de confirmação humana dentro do WhatsApp.

A mensagem contém:

- IDs das Ordens de Retirada;
- descrição dos materiais;
- quantidades;
- marcação `[SENSÍVEL]` quando aplicável.

Ela não inclui nome do paciente, prontuário ou outros dados clínicos no texto do WhatsApp.

## Segurança da seleção múltipla

Se qualquer uma das ordens selecionadas possuir item sensível, a `AccessSession` inteira é tratada como `sensitive_access=true`.

Usuário sem `stock.sensitive.access` deve receber `SENSITIVE_ACCESS_DENIED` e nenhuma sessão de acesso deve ser criada.

## Teste automatizado do store

```bash
node --test tests/store.test.js
```

A suíte cobre massa >=10 ordens, materiais no contrato, sessão multi-ordem, idempotência, transição por entrada física e bloqueio de sensível.