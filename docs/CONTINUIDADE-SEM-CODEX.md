# Continuidade HVB sem Codex — checkpoint operacional

Data: 23/09/2026

## Objetivo

Este arquivo registra todo trabalho realizado temporariamente fora do Codex enquanto a cota estiver indisponível, para impedir sobrescrita acidental quando o Codex retomar.

Regra de retomada: o Codex NÃO deve reconstruir, resetar, regenerar ou sobrescrever este delta. Antes de editar arquivos afetados, deve comparar o HEAD de `hvb-sistema-dev` com a branch `hvb-sistema-chat-continuity` e integrar apenas o delta registrado aqui.

## Baseline

- Repositório: `BeskelBR/beskel-site`
- Branch de origem: `hvb-sistema-dev`
- HEAD informado pelo backend antes da interrupção: `31c931d173095b6e9c82dc9e567f0ba5e3b55742`
- Branch isolada de continuidade: `hvb-sistema-chat-continuity`
- A branch de continuidade foi criada exatamente a partir do HEAD acima.
- Frontend, sessão/proxy, Terminal, terminal-access, terminal-v1, C18, OpenAPI e migrations 001–076 permanecem congelados salvo novo delta explícito.

## Estado herdado do backend

O backend publicado antes da interrupção já contém:
- opt-in explícito para PostgreSQL remoto DEV;
- TLS verificado;
- `/ready` por capacidades/herança efetiva de `hvb_app`;
- `search_path`, timeouts e `hvb.org` locais à transação;
- Bearer opaco de 64 hex preservado;
- nenhuma migration 077;
- servidor HTTP ainda em loopback;
- `NODE_ENV=production` ainda recusado.

## Mudanças executadas neste chat enquanto o Codex está inoperante

### Banco / Supabase

1. Foi provisionada uma identidade PostgreSQL de runtime:
   - nome: `hvb_api_dev`;
   - LOGIN: sim;
   - INHERIT: sim;
   - herança efetiva de `hvb_app`: sim;
   - SUPERUSER: não;
   - BYPASSRLS: não;
   - CREATEDB: não;
   - CREATEROLE: não;
   - REPLICATION: não;
   - senha armazenada com SCRAM-SHA-256;
   - validade: infinity.

2. `hvb_app` permanece `NOLOGIN`.

3. QA confirmado:
   - USAGE no schema `hvb`: OK;
   - EXECUTE em `hvb.autenticar(text)`: OK;
   - SELECT herdado nas tabelas necessárias: OK;
   - migrations registradas: 76;
   - `076_terminal_v1_conservation.sql`: presente.

4. Não houve alteração de schema, C18 ou migrations.
5. Não foi criada migration 077.

### Fixture sintético para E2E remoto

Foi criado um fixture mínimo, inspirado diretamente em `scripts/seed.ts`, sem executar o seed completo e sem dados reais.

Escopo:
- 2 organizações sintéticas isoladas (tenant A e tenant B);
- 1 unidade por tenant;
- 1 usuário admin sintético por tenant;
- 1 papel admin por tenant;
- cada papel recebeu as 118 permissões já catalogadas no banco;
- 1 credencial opaca `api` por tenant, com expiração em 7 dias;
- nenhum paciente, responsável, episódio, estoque ou dado clínico foi criado.

Armazenamento privado dos identificadores/tokens do fixture:
`OneDrive/HVB_RUNTIME_PRIVATE/e2e-fixture.json`

Permissão do arquivo verificada: somente proprietário.

QA:
- 2 organizações sintéticas: OK;
- 2 usuários sintéticos: OK;
- 2 credenciais `api`: OK;
- `hvb.autenticar` resolve tenant A para sua organização/usuário/credencial: OK;
- `hvb.autenticar` resolve tenant B para sua organização/usuário/credencial: OK;
- 118 permissões em cada papel admin: OK.

Tentativa inicial de criação do fixture falhou por `NULL` não tipado em `usuario_papel.unidade_id`; a transação abortou integralmente e não persistiu dados. A segunda execução usou `NULL::uuid` e concluiu com sucesso.

O fixture existe somente para testes DEV e deve ser removido/rotacionado após concluir a etapa de integração remota.

### Configuração privada do runtime

Modalidade escolhida para o primeiro E2E: `direct`.

Variáveis preparadas no ambiente privado:
- `DATABASE_URL`
- `HVB_DATABASE_MODE=remote-dev`
- `HVB_DATABASE_CONNECTION=direct`
- `HVB_DATABASE_TLS=verify-full`

Local privado:
`OneDrive/HVB_RUNTIME_PRIVATE/.env.remote-dev`

Esse local foi verificado com permissão somente do proprietário.

Nenhuma credencial é registrada neste arquivo, no Git ou no chat.

### Incidente preventivo de segredo

A pasta `BESKEL/PARCEIROS/HVB` possui links anônimos de edição herdados.

Um arquivo `.env.remote-dev` chegou a ser criado temporariamente dentro do diretório sincronizado do Sistema, mas:
1. o risco foi detectado antes de uso;
2. o conteúdo sensível foi neutralizado;
3. a senha PostgreSQL do runtime foi rotacionada depois da neutralização;
4. o segredo válido foi armazenado somente em `OneDrive/HVB_RUNTIME_PRIVATE/.env.remote-dev`.

Não alterar as permissões das pastas BESKEL/HVB por inferência; isso é uma decisão separada do usuário.

## Arquivos do código alterados por este chat

Até este checkpoint: nenhum arquivo de backend foi alterado após o HEAD `31c931d...`.

Este arquivo é o primeiro commit documental da branch de continuidade.

## Testes

### Já comprovados pelo backend antes da interrupção
- configuração/unidade: PASS;
- PostgreSQL TEST local: PASS;
- integração local: PASS;
- TypeScript: PASS;
- Biome: PASS;
- OpenAPI paths/securitySchemes: preservados.

### Executados neste chat
- QA do papel PostgreSQL remoto: PASS;
- herança efetiva de `hvb_app`: PASS;
- preservação de 76 migrations: PASS;
- preservação de `hvb_app NOLOGIN`: PASS;
- permissão do arquivo privado no OneDrive: somente proprietário;
- criação do fixture sintético remoto A/B: PASS;
- autenticação SQL dos dois tokens via `hvb.autenticar`: PASS;
- armazenamento privado do fixture: PASS.

### Ainda pendente
- handshake TLS real executado pelo processo Node do backend;
- `/ready` contra Supabase DEV;
- E2E autenticado via processo Node usando o fixture HVB sintético já preparado;
- isolamento tenant A × tenant B através do backend remoto;
- rollback/idempotência contra Supabase DEV.

Não declarar esses itens como PASS até execução real.

### Tentativa de execução fora do Codex

Foi verificado o runtime isolado disponível neste chat:
- Node disponível: sim;
- Git disponível: sim;
- `pg` disponível: não;
- `psql` disponível: não;
- acesso DNS/rede externa do container: indisponível (teste de resolução para GitHub falhou antes de conexão).

Resultado: handshake TLS e E2E pelo processo Node permanecem `NÃO EXECUTADO — limitação do executor deste chat`, e não `FAIL` do Sistema/Supabase.

## Regra de registro daqui em diante

Para cada novo delta realizado enquanto o Codex estiver indisponível, atualizar este documento com:
1. arquivos alterados;
2. motivo;
3. mudança registrada em commit próprio na branch de continuidade; o histórico Git da branch é a fonte autoritativa dos SHAs e será extraído integralmente no handoff ao Codex;
4. testes executados e resultado;
5. alterações de banco/configuração;
6. pendências;
7. qualquer conflito potencial com `hvb-sistema-dev`.

## Procedimento quando o Codex voltar

1. Não pedir ao Codex para "refazer" o trabalho.
2. Informar baseline `31c931d...` e branch `hvb-sistema-chat-continuity`.
3. Mandar o Codex buscar/inspecionar primeiro essa branch.
4. Comparar com o novo HEAD de `hvb-sistema-dev`.
5. Integrar por merge/rebase consciente, sem checkout/reset destrutivo.
6. Preservar commits do frontend e outros responsáveis.
7. Rodar somente os testes pertinentes ao delta integrado.
8. Confirmar hashes/diff antes de qualquer push final.

