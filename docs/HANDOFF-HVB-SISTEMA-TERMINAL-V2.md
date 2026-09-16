# Handoff — atualização do HVB Sistema para Terminal de Acesso v2

Este documento prepara a próxima tarefa no `hvb-sistema-dev`.

**Não é autorização para modificar essa branch.**

## Contexto

A arquitetura funcional do Terminal foi atualizada após validação do fluxo físico real:

```text
CONSULTÓRIO SOLICITA
→ TERMINAL AUTENTICA
→ SALA LIBERA
→ HVB MOBILE GUIA
→ API ESCRITURA
```

O módulo `terminal` atualmente implementado no HVB Sistema ainda representa o fluxo anterior de etiqueta/leitura/retirada física pelo Terminal.

Ler antes de alterar o Sistema:

- `docs/TERMINAL-ARQUITETURA-V2.md` em `hvb-terminal-dev`;
- `docs/AUTH-EVIDENCE-CONTRACT-V1.md`;
- `docs/TERMINAL-CORE-CONTRACT-V1.md`;
- `docs/OFFLINE-EDGE-V1.md`;
- `docs/INTEGRACAO-HVB-SISTEMA-DELTA-V2.md`.

## Prompt preparado para Codex / HVB Sistema

> Revise o módulo `terminal` de `hvb-sistema-dev` contra a arquitetura funcional v2 do Terminal de Acesso documentada na branch `hvb-terminal-dev`.
>
> Antes de escrever código, faça uma auditoria de impacto sobre `src/domain/terminal/*`, migrations 047/048, ADR 0015, OpenAPI, scripts/seeds e `tests/terminal.test.ts`.
>
> Preserve as fundações válidas do Sistema: organização/unidade, usuários, papéis/permissões, credenciais/revogação, dispositivos, RLS, comandos/idempotência, auditoria, episódios, estoque transacional e OpenAPI.
>
> Não preserve como arquitetura ativa o fluxo antigo `etiqueta → leitura → retirada pelo terminal → movimento de estoque`. O Terminal físico agora é responsável por identidade/autenticação/acesso; picking ocorre no HVB Mobile; escrituração de estoque é posterior e centralizada na API.
>
> Implemente, por migrations aditivas e sem reescrever migrations históricas, os agregados/contratos necessários para: Ordem de Retirada, challenge/evidência/AuthSession, AccessSession N:N com ordens, eventos físicos append-only e sequência de barreiras. `ENTRY_CONFIRMED` é o evento que leva a ordem a `EM_SEPARACAO`.
>
> O Terminal não pode criar diretamente `transacao_estoque` no novo contrato. Confirmação de picking/fulfillment e movimentos físicos pertencem à API/Mobile em fluxo separado.
>
> Reutilize o mecanismo existente de comando/idempotência e `X-Device-Id`; não crie uma infraestrutura concorrente de deduplicação sem necessidade.
>
> Para autenticação física, não trate NFC como Bearer. DESFire identifica a identidade alegada; face 1:1 + PAD/liveness geram evidência local vinculada a challenge e dispositivo. Não envie biometria bruta rotineiramente. Nesta etapa, abstraia o verificador/attestation; não implemente hardware real nem escolha engine biométrica sem decisão explícita.
>
> Estoque sensível: fail-closed offline por padrão. Porta e armário não devem ser autorizados simultaneamente sem necessidade. Item sensível adicionado após entrada deve exigir step-up/ampliação de escopo em fase posterior; não invente regra antes da política ser aprovada.
>
> Atualize OpenAPI e testes. O conjunto mínimo de testes deve provar: challenge single-use/TTL/device-bound; replay de evidence rejeitado; AuthSession distinta de AccessSession; acesso sensível por permissão; idempotência; sequência física; `ENTRY_CONFIRMED → EM_SEPARACAO`; nenhuma criação de movimento de estoque pelo Terminal; dispositivo desativado bloqueia comandos; fail-closed conforme contrato.
>
> Não altere `hvb-terminal-dev`, `hvb-site-dev` ou `main`. Não acesse SimplesVet. Não use dados reais. Não configure produção, domínio, Vercel/Cloudflare ou hardware.
>
> Ao final, entregue o delta implementado, migrations criadas, endpoints/OpenAPI, testes executados e pendências ainda não resolvidas.

## Critério de integração posterior

Somente depois da API v2 do Sistema estar estável:

1. comparar OpenAPI real com `TERMINAL-CORE-CONTRACT-V1.md`;
2. mapear diferenças de nomes/payloads;
3. criar `HvbSystemAdapter` no Terminal;
4. manter `MockAdapter` para DEV/testes;
5. testar Terminal contra ambiente isolado do Sistema;
6. somente depois discutir hardware real.

## Pontos que continuam pendentes de decisão humana

- política de quem pode assumir uma ordem;
- múltiplas ordens em um acesso;
- ocupação simultânea da sala;
- classificação definitiva de sensíveis;
- itens que exigem lote/recipiente;
- engine de face/PAD;
- armazenamento/provisionamento dos templates;
- controlador físico;
- política de break-glass;
- Edge/offline;
- dispositivo móvel pessoal versus corporativo;
- regra de encerramento definitivo da Ordem de Retirada.

Essas pendências devem permanecer configuráveis/PENDENTE, sem regras inventadas.
