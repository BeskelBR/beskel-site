# Delta de conexão PostgreSQL DEV — backend

23/09/2026. Base local `ca16d43b6b2d72f78ed66236b28278ea59acc479`, branch `hvb-sistema-dev`, working tree inicialmente limpo. Delta solicitado pelo usuário após retorno do chat do banco; inclui autorização explícita para testes do backend. Não houve trabalho local anterior a sobrescrever.

## Resultado e limites

O backend mantém PostgreSQL local como padrão e aceita configuração explícita de PostgreSQL remoto DEV com TLS validado. `/ready` verifica herança efetiva de `hvb_app`, capacidades e migration 076; não exige nome literal de login. `search_path`, timeouts e `hvb.org` são locais à transação.

A evolução substitui apenas a limitação de conexão local e a igualdade literal de papel da implementação anterior. Não altera baselines, migrations 001–076, domínios, autenticação Bearer, RBAC/RLS, frontend, sessão/proxy ou Terminal. Nenhuma migration 077 foi criada. Servidor HTTP continua em loopback e `NODE_ENV=production` continua recusado. Nenhum deploy, provisionamento remoto ou escolha de hospedagem foi realizado.

O estado Supabase (001–076 registradas, 220 tabelas, 77 views, TLS e papéis) foi informado pelo responsável do banco. A igualdade byte a byte remota relatada limita-se a 073–076; este chat não reauditou 001–072 nem acessou o banco remoto.

## Configuração declarativa

Local: nenhuma variável nova obrigatória; `DATABASE_URL` local existente continua válida.

Remoto: configurar em ambiente privado da **API**; valores abaixo são placeholders, não credenciais:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
HVB_DATABASE_MODE=remote-dev
HVB_DATABASE_CONNECTION=transaction
HVB_DATABASE_TLS=verify-full
DATABASE_URL=postgresql://RUNTIME_LOGIN:SENHA_PERCENT_ENCODED@HOST_DO_BANCO:PORTA/BANCO_DEV
# Opcional: PEM da CA de confiança quando necessário, injetado pelo gestor de segredos.
# HVB_DATABASE_CA_PEM=<PEM MULTILINHA>
```

- `HVB_DATABASE_CONNECTION` aceita `direct`, `session` ou `transaction`; selecionar o endpoint correspondente fornecido pelo responsável. O código não deduz modo por porta nem troca endpoint. Direct/session atendem processo persistente; transaction é compatível com pool transacional. Isso não entrega um adaptador de hospedagem serverless.
- `HVB_DATABASE_TLS=verify-full` é obrigatório no remoto. `pg.Pool` recebe `rejectUnauthorized: true` e mínimo TLS 1.2. Sem CA explícita utiliza confiança padrão do Node; com `HVB_DATABASE_CA_PEM` utiliza o PEM fornecido. Não há opção de ignorar certificado ou hostname.
- URLs precisam de protocolo PostgreSQL, host e banco. Queries e fragmentos são recusados, inclusive `sslmode`, para impedir que o parser de `pg` sobrescreva TLS, CA, usuário, host ou opções. Credenciais devem estar percent-encoded; erros de parsing são genéricos e não incluem o input. `NODE_TLS_REJECT_UNAUTHORIZED=0` e `PGOPTIONS` são recusados no modo remoto.
- Somente `src/api/server.ts` passa o ambiente explicitamente ao terceiro argumento de `pool`. `pool(url, max)` e `localUrl` continuam locais: scripts de seed/migration e worker não ganham autorização remota por herança de variável de ambiente.
- Pool mantém limite de 5 conexões na API e timeout de conexão de 3 s. Remoto usa timeout de query do cliente de 5 s e não envia GUCs de sessão no startup. Nas transações aplica timeouts locais de statement 5 s, lock 2 s e idle-in-transaction 5 s. Dimensionamento final depende da hospedagem e está fora deste delta.
- Nenhuma query de runtime usa prepared statement nomeado. Autenticação e readiness usam nomes de schema explícitos; queries de domínio executam no contexto transacional. Não há dependência de sticky session para o contexto do tenant.

Contrato:

```text
API HVB em loopback
  → PostgreSQL via TLS validado (modo remoto explícito)
  → identidade LOGIN com privilégios herdados de hvb_app

Bearer opaco → SHA-256 → hvb.autenticar(hash)
  → organização / usuário / credencial
  → BEGIN
  → search_path LOCAL + timeouts LOCAL
  → hvb.org LOCAL
  → validação da credencial / RBAC / RLS / domínio
  → COMMIT ou ROLLBACK
```

`/ready` exige: registro acessível da migration 076, `pg_has_role(..., 'hvb_app', 'USAGE')`, USAGE em `hvb`, EXECUTE em `hvb.autenticar(text)`, SELECT em `hvb.credencial` e `hvb.usuario`, e papel efetivo sem SUPERUSER/BYPASSRLS. Erro ou capacidade ausente gera 503 genérico. É uma verificação específica de disponibilidade, não auditoria completa de schema ou de todos os grants.

## Evidências

Ambiente: Windows, Node 24, `pg@8.23.0`, PostgreSQL local existente; testes de integração exclusivamente em `hvb_sistema_test`, com dados sintéticos. O servidor local estava parado (sondagem inicial ECONNREFUSED); foi iniciado sem bootstrap, credenciais novas ou reinicialização. A suíte de regressão existente verifica migrations e grants no TEST pelo seu setup, sem nova migration ou reescrita de histórico. Papel sintético NOLOGIN do teste de herança foi criado dentro de transação e removido pelo ROLLBACK, comprovado ao final.

| Comando/verificação | Ambiente | Resultado |
|---|---|---|
| `node --test tests/database-config.test.ts tests/unit.test.ts` | Sem banco remoto; configuração e unidade | PASS: 11 testes |
| `node --env-file=.env --test tests/database-runtime.test.ts` | PostgreSQL TEST local | PASS: 4 testes — health/ready/Bearer/contexto, RLS, COMMIT/ROLLBACK, papel herdeiro e recusas |
| `node --env-file=.env --test tests/integration.test.ts` | PostgreSQL TEST local | PASS: 15 testes — regressão de autenticação, RBAC/RLS, retry, concorrência, idempotência, auditoria/outbox |
| `node node_modules/typescript/bin/tsc --noEmit` | Workspace | PASS |
| Biome lint/format dos 5 arquivos TS alterados/criados | Workspace | PASS |
| Comparação de `app.swagger()` com OpenAPI publicado | Workspace/local | PASS: paths e securitySchemes idênticos, sem regravação do contrato |
| Diff/links, arquivos protegidos e hashes | Workspace | Ver manifesto de evidência |
| Handshake TLS, conexão e E2E no Supabase | Remoto | BLOQUEADO POR CONFIGURAÇÃO EXTERNA: identidade/secret de runtime não configurados neste ambiente |
| Navegador, frontend e hardware Terminal | Outros blocos | NÃO EXECUTADO neste delta |

Nenhum teste executado terminou em FAIL. O teste de CA é de configuração preservada até `pg.Client`, não handshake nem prova de confiança no certificado remoto. As modalidades de pool foram verificadas na configuração; a execução em Supavisor continua dependente da integração remota. Registros detalhados de arquivos, motivos e SHA-256 estão em [evidência](evidencias/backend-postgres-dev.json).

## Pedido ao chat do banco

```text
O delta do backend está pronto, com regressão local aprovada. Para liberar o primeiro E2E Supabase DEV, provisione/configure pelo fluxo seguro uma identidade PostgreSQL LOGIN de runtime, com herança efetiva de hvb_app (USAGE por pg_has_role), sem SUPERUSER/BYPASSRLS. Preserve hvb_app NOLOGIN e não altere schema ou migrations.

Disponibilize a conexão e o segredo somente no ambiente privado da API, sem colar valores no chat nem versionar arquivos. Informe apenas onde a configuração segura foi disponibilizada e qual modalidade foi escolhida: direct, session ou transaction. Configure HVB_DATABASE_MODE=remote-dev, HVB_DATABASE_CONNECTION conforme o endpoint e HVB_DATABASE_TLS=verify-full; forneça CA confiável por HVB_DATABASE_CA_PEM somente se necessário. DATABASE_URL deve vir sem query/fragmento, com usuário apropriado ao endpoint e senha percent-encoded. Não substituir por chaves REST/service_role ou Supabase Auth.

Após isso, validar conexão/TLS e /ready. Para a etapa autenticada, combinar fixture/credencial HVB sintética pelo fluxo privado; não criar dados reais nem executar o seed completo remoto por inferência. Devolver somente evidências e limitações, sem segredos. Não há pedido de DDL funcional, migration 077 ou alteração de C18.
```

Frontend: nenhuma incompatibilidade nova identificada e nenhum pedido de alteração neste delta. Ainda aguardamos o retorno próprio desse chat. Terminal / terminal-access / terminal-v1 / C18: **SEM ALTERAÇÃO; congelados**.

Referências técnicas consultadas: [conexões Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres), [SSL no node-postgres](https://node-postgres.com/features/ssl). O aviso do driver sobre parâmetros SSL da URL motivou a recusa explícita desses parâmetros em vez de permitir sobrescrita da configuração TLS.
