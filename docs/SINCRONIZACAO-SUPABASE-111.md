# Desbloqueio cadastral — Supabase 111

25/09/2026. Branch `hvb-sistema-dev`; HEAD inicial `1d748bebfbbd1ce05bb97149b7becca2ee1e389d`.

## Resultado

**Os antigos 403/42501 da jornada cadastral não se repetiram.** A execução remota com `admin.remote.dev.a` passou **38 verificações, zero falhas e zero bloqueios**. As regressões locais passaram **31/31**. A baixa se limita a esse desbloqueio, sem aprovar todo o sistema ou o login humano em elaboração.

## Histórico literal

Incorporadas 103–111 do histórico `supabase_migrations.schema_migrations`, sem reconstruir funções/schema. Para 103–107, o statement inteiro corresponde ao hash. Para 108–111, o histórico contém o arquivo original como prefixo literal, seguido do INSERT de registro em `public.schema_migration`. Foi extraído o prefixo exato cujo SHA-256 coincide com o ledger, sem reformatação. O sufixo de registro não faz parte do arquivo canônico. Origem, intervalo e hashes estão no [manifesto de evidência](evidencias/sincronizacao-111.json).

SHA-256 da 111: `65138d010c53affb7532c964bfbb6014755c0a851b0f56e8a0ec52890b06d4bf`. **111 arquivos locais conferidos contra o ledger remoto, sem divergência**. Migrations 001–102 preservadas. Nenhuma migration nova inventada; nenhum DDL/grant aplicado no Supabase por este chat.

## Backend e TEST

- `/ready` exige registro/hash 111 e a sequência 001–111, preservando as verificações de runtime e adicionando EXECUTE de cpf_valido. Responde `{ "status": "ready", "migration": 111 }`.
- OpenAPI atualizado apenas para esse campo adicional de readiness.
- `scripts/verify-schema-111.ts` executa a jornada por handlers HTTP reais via Fastify inject e conexão Node/pg remota com TLS verify-full. Captura somente endpoint, método, status esperado/observado e SQLSTATE; nunca credenciais, CPF ou respostas com dados.
- TEST isolado fora do OneDrive recebeu os nove arquivos em transação com conferência de hash, sem executar novamente os grants globais legados do runner.
- **A fixture `admin.remote.dev.a` não existe no TEST.** A consulta por login + organização + papel + escopo global não encontrou correspondência; não foram criados usuários, papéis ou IDs, nem alterada outra fixture para simular essa identidade. Portanto a aplicação local dos sete vínculos à mesma fixture ficou **BLOQUEADA POR CONFIGURAÇÃO**. As 31 regressões usam as fixtures sintéticas próprias das suítes. A jornada da identidade exigida foi executada no Supabase, onde ela existe.
- Uma expectativa antiga da regressão de revisão foi corrigida para conferir também os campos opcionais null do responsável. O erro era do contrato esperado pelo teste; não foi relaxada a validação da API/banco.

## Evidência de endpoints remotos

Todos os resultados abaixo coincidiram com o esperado. SQLSTATE é null quando não houve erro PostgreSQL.

| Método | Endpoint / caso | HTTP esperado = observado | SQLSTATE |
|---|---|---|---|
| GET | /ready, reportando 111 | 200 | — |
| GET | /v1/me, Bearer da fixture A | 200 | — |
| GET | /v1/responsaveis | 200 | — |
| POST | /v1/responsaveis, CPF null | 200 | — |
| POST | /v1/responsaveis, CPF sintético válido | 200 | — |
| POST | /v1/responsaveis, CPF inválido | 409 | 23514 |
| GET / POST | /v1/pacientes | 200 | — |
| GET | /v1/pacientes?q={id}, microchip null | 200 | — |
| GET | /v1/vinculos, por paciente e por responsável | 200 | — |
| GET / POST | /v1/episodios, incluindo leitura do criado | 200 | — |
| POST | /v1/locais, box sintético | 200 | — |
| GET / POST | /v1/ocupacoes, incluindo leitura da criada | 200 | — |
| GET | /v1/atribuicoes, escopo global | 200 | — |

Vínculo inicial criado atomicamente no POST paciente e conferido ativo pelos dois lados. Episódio lido como ativo e ocupação como ativa. Tenant B não enxergou o paciente criado em A; A enxergou. `hvb.autenticar` permaneceu com a mesma definição antes/depois. A fixture B não recebeu permissões.

"Login" nesta evidência significa autenticação da API pelo **Bearer existente** e confirmação de que a identidade corresponde a `admin.remote.dev.a`. Não é prova de login web por CPF/senha, BFF, cookie ou navegador. Esse trabalho anterior continua local, fora desta publicação.

Cada requisição usa savepoint dentro de uma transação externa, com `SET CONSTRAINTS ALL IMMEDIATE` antes de concluir a requisição, para realmente avaliar constraints diferidas. O rollback final foi confirmado: os cadastros sintéticos não persistiram no remoto. Isso comprova handlers/SQL/jornada e as recusas esperadas; não comprova transporte HTTP pela rede ou commits independentes entre requisições.

Comandos: `node --import ./.local/canonical102-hooks.mjs scripts/verify-schema-111.ts <env-privado>`; `node --import ./.local/canonical102-hooks.mjs --test --test-concurrency=1 tests/database-runtime.test.ts tests/operational-registration.test.ts tests/registry-corrections.test.ts tests/registration-102.test.ts`, com variáveis privadas do TEST herdadas. O hook somente exclui em memória os handlers humanos ainda não publicados. Não muda arquivos do frontend.

## Pendências distintas deste desbloqueio

- **Configuração:** reproduzir a fixture nominal no TEST depende de orientação do responsável, pois o pedido proíbe criar identidades. Não necessário para provar os antigos erros na fixture remota; não registrado como PASS local.
- **Backend/outbox:** revisão estática identificou `src/worker/outbox.ts` chamando reservar_outbox sem tenant e fazendo UPDATE direto; 109–110 agora exigem tenant e funções concluir_outbox/falhar_outbox. O runner `scripts/migrate.ts` também possui grant histórico de UPDATE ao worker, que não deve reabrir o acesso revogado pela 109. Adaptar worker/runner em delta próprio antes de executar worker ou reprovisionar pelo runner geral. Não contornar com grants no banco. Nenhum teste do worker foi declarado aprovado nesta rodada.
- **Frontend/configuração humana:** integrar os contratos cadastrais já publicados; login humano HTTP/BFF/email permanece trabalho separado. Não houve edição de frontend, sessão, Terminal/C18 ou NFC.
- **Evidência insuficiente:** navegador, transporte/deploy e commits remotos independentes não executados; não confundir esta jornada backend com homologação completa.

As falhas registradas em [102](SINCRONIZACAO-SUPABASE-102.md) permanecem como histórico, supersedidas apenas quanto ao EXECUTE de CPF e RBAC da fixture A por esta prova.

Integridade: TypeScript do backend (`tsc --noEmit -p .local/tsconfig.backend.json`) PASS; lint dos três arquivos TypeScript alterados PASS. Typecheck global FAIL com os mesmos quatro diagnósticos no `api/gateway.ts` do frontend (180, 186, 187, 191), não editado. OpenAPI mantém as 293 rotas; a única mudança de contrato desta rodada é o campo migration em /ready.
