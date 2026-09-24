# Login humano CPF — incorporação canônica e bloqueios

## Atualização vigente — preparação do verificador e TLS, 24/09/2026

HEAD inicial deste recorte: `ff9e178325bc7ac5534930076aada44fc83f7583`, árvore inicialmente limpa. Os resultados históricos abaixo permanecem como evidência da execução anterior; não são resultados do verificador atualizado.

- **TLS RESOLVIDO:** handshake real Node/pg pela identidade runtime em TLS 1.3, com socket autorizado, validação de certificado/hostname e confirmação em `pg_stat_ssl`. CA obtida da URL HTTPS referenciada pelo código oficial do dashboard Supabase, validada e disponibilizada exclusivamente como `HVB_DATABASE_CA_PEM` no arquivo privado indicado pelo usuário. Nenhum certificado/segredo foi versionado; `verify-full` e `rejectUnauthorized: true` preservados. Isso não constitui E2E humano ou teste de email.
- **Verificador preparado:** exige schema previamente provisionado e registro canônico da 077; não instala migrations, não cria roles e não escreve diretamente nas tabelas privadas da 077. A antiga fixture de ativação direta foi removida. Consumo e recusa de reutilização precedem a criação de sessão. A recuperação deve produzir simultaneamente credencial revogada, sessão encerrada e recusa do token anterior por `hvb.autenticar`; a inspeção administrativa de estado é somente leitura. Dependências que falham bloqueiam os testes seguintes, sem produzir PASS artificial. Critério final: exatamente 14 PASS / 0 FAIL / 0 BLOCKED.
- **Integridade PASS:** TypeScript e lint/formatação do arquivo alterado. **Execução funcional deste recorte: NÃO EXECUTADA**, aguardando correção canônica pelo responsável do banco. A leitura dos corpos das funções remotas ainda mostrou a referência não qualificada no consumo e ausência de revogação na emissão da recuperação; não houve aplicação de SQL corretivo por este chat.
- **OneDrive:** testes locais com escrita continuam suspensos após o alerta relatado pelo usuário. O verificador recusa `data_directory` contendo OneDrive antes de iniciar sua transação. Não apaga, move nem reprovisiona arquivos. O responsável precisa disponibilizar banco de teste corrigido fora da sincronização antes da execução local. Não foi confirmada a origem exata dos mais de 1.100 arquivos do alerta.
- **Próxima etapa condicionada:** após a correção do banco e ambiente de teste adequado, executar o verificador, regressões API/banco e onboarding com/sem NFC. Somente depois iniciar os handlers HTTP humanos. Nenhum contorno do 42702 em TypeScript, alteração de `hvb.autenticar`, Bearer, C18/NFC ou migration 001–077; nenhuma 078 criada.

Pedido vigente ao responsável pelo banco (substitui apenas as ações já resolvidas no pedido histórico abaixo):

```text
HVB banco — CA já configurada privadamente e handshake Node/pg verify-full PASS em TLS 1.3. Não é necessário reenviar credenciais ou certificados no chat.
Concluir a correção autorizada do consumo (42702) e da revogação na emissão de recuperação, preservando literalmente 001–077; não inferir autorização para 078. Informar quando aplicada e fornecer sua evidência/artefato autorizado.
Para a regressão local, preparar uma instância de teste com o schema corrigido, fora de OneDrive, e disponibilizar TEST_MIGRATION_DATABASE_URL por configuração privada. Não apagar/mover o cluster existente por inferência. O verificador não instala DDL nem ativa contas por escrita direta.
Após isso o backend executará a meta de 14 PASS, as regressões e, só então, os endpoints humanos. Email real continua dependência de integração/configuração aprovada.
```

Evidência deste recorte: [preparacao-077-tls.json](evidencias/preparacao-077-tls.json).

## Registro histórico da incorporação inicial

Delta de 24/09/2026. HEAD inicial: `d4d63315b259d93605e5003f734d21dfe2a3e1f8`, branch `hvb-sistema-dev`, árvore inicialmente limpa. CPF em `usuario.login`, senha temporária por email e redefinição obrigatória são a decisão vigente do usuário; superam a proposta de ativação/conta corporativa de CADASTRO-LOGIN-NFC.md. Não existe coluna CPF paralela nem adoção de Supabase Auth.

## Migration sincronizada

A 077 não existia no checkout nem no remoto canônico consultado. Foi recuperada literalmente do campo `statements[1]` de `supabase_migrations.schema_migrations`, versão `20260924020043`, nome `hvb_repo_077_human_access_cpf`, pelo conector Supabase. Não foi reconstruída a partir do schema ou de pg_get_functiondef.

Arquivo incorporado: `migrations/077_human_access_cpf.sql`.

SHA-256 local, registro `public.schema_migration` remoto e valor informado pelo usuário são iguais:

```text
a7030dde974cf5072d0c9af0eedcb8502664f85fd09aae3c9a43da4f5d494eac
```

O histórico remoto confirma 77 registros. Nenhuma migration foi aplicada/reaplicada remotamente neste delta. A instalação temporária local da 077 usada nos diagnósticos foi revertida por ROLLBACK; incorporar ao Git não significa aplicá-la ao cluster local. Migrations 001–076 e C18 permaneceram intocados.

## Estado do backend

**PARCIAL/PENDENTE, sem endpoints novos habilitados.** Integração HTTP, BFF, login normal e primeira redefinição não foram anunciados como disponíveis. O ponto congelado é a integração que depende das garantias da 077, por falha executável no SQL canônico, e não falta de autorização do usuário.

Partes independentes implementadas:

- `src/domain/human-access/password.ts`: Argon2id nativo assíncrono do Node 24, PHC v19, memória 19.456 KiB, 2 passes, paralelismo 1, salt aleatório de 16 bytes e saída de 32 bytes. Só aceita esse perfil no verificador atual; outros perfis não provocam custos arbitrários nem downgrade. Temporária: 24 bytes aleatórios/192 bits, codificados em 32 caracteres base64url.
- Política preparada: 15–128 caracteres Unicode, máximo 512 bytes UTF-8; sem truncamento/normalização. Não representa conclusão de controles de senha comprometida, MFA ou proteção de endpoint, ainda não implementados. Argon2 usa o threadpool, não implementação criptográfica própria.
- `src/domain/human-access/delivery.ts`: fronteira injetável persistir PHC → enviar → confirmar envio. Sem adaptador, recusa antes da emissão. Falha/ambiguidade no provedor ou confirmação vira erro controlado sem segredo; não há retry automático nem fila/outbox de senha. Retorno contém apenas id/estado. Strings JS não têm apagamento garantido; buffers controlados são zerados e o segredo não é retido pela fronteira. O adaptador futuro deve obedecer à mesma proibição de logs/armazenamento.
- `scripts/migrate.ts`: o grant genérico histórico de SELECT reabriria as cinco tabelas privadas da 077. A finalização do runner agora retira os privilégios diretos de hvb_app/hvb_worker nessas tabelas, dentro da mesma transação, preservando o acesso por funções. Nenhum SQL histórico foi editado. Execução integral do runner com 077 ainda NÃO EXECUTADA: roles locais anon/authenticated/service_role são dependência do ambiente a cargo do banco, não são criadas pelo runner.
- `scripts/verify-human-access-077.ts`: diagnóstico sintético reproduzível, restrito a `hvb_sistema_test` local, com checagem de hash e rollback integral. Roles auxiliares e 077, quando ausentes, são criadas só na transação de diagnóstico; não constituem alteração permanente do ambiente. Não imprime senhas, PHCs, tokens, URL de conexão ou valores de .env.

Referências: [Node crypto.argon2](https://nodejs.org/download/release/v24.16.0/docs/api/crypto.html#cryptoargon2algorithm-parameters-callback), [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Nenhum pacote/provedor pago instalado.

## BANCO — decisão/novo delta necessário

1. **FAIL executável: consumo da temporária.** `hvb.acesso_humano_consumir_senha_temporaria(uuid,uuid,uuid,text,text,uuid)` retorna SQLSTATE **42702**, referência ambígua a coluna. Reproduzido no PostgreSQL local e no Supabase DEV. O parâmetro de saída `usuario_id` conflita com referências não qualificadas no corpo. Foi possível emitir, marcar envio e obter prova; consumir não conclui. Sem contorno via `plpgsql.variable_conflict`, redefinição local da função ou escrita direta de senha na aplicação.
2. **Lacuna de revogação na emissão de recuperação.** Em teste local, sessão criada pela função canônica continuou válida em `hvb.autenticar` após `acesso_humano_emitir_senha_temporaria(...,'recuperacao',...)`. A troca bem-sucedida prevê revogação, mas a emissão não revoga. Isso precisa de decisão explícita frente ao requisito de recuperação/revogação. O teste usa estado ativo montado diretamente como fixture, pois a ativação canônica está bloqueada; não é prova de E2E humano.
3. **Configuração:** cliente pg remoto continua falhando na confiança TLS (`SELF_SIGNED_CERT_IN_CHAIN`). CA explícita e fixture API privada não estão configuradas no arquivo privado informado. Acesso pelo conector Supabase para diagnóstico não substitui conexão da API pela identidade runtime.

Pedido copiável:

```text
HVB banco — 077 incorporada literalmente do histórico aplicado; SHA a7030dde974cf5072d0c9af0eedcb8502664f85fd09aae3c9a43da4f5d494eac confirmado local/remoto (77 registros). Não reescrever a 077 nem 001–076.

BANCO — decisão/novo delta necessário: consumir_senha_temporaria retorna 42702 (usuario_id ambíguo); reproduzido local e Supabase com fixtures sintéticas/rollback. Rever a função canônica e demais referências ambíguas. O backend não criou 078 nem alterou schema. Propor a correção e seu meio de publicação/aplicação conforme autorização do usuário.

Segundo ponto: emitir recuperação mantém credencial de sessão humana anterior válida em hvb.autenticar; teste local com fixture ativa direta. Alinhar revogação imediata exigida na recuperação, sem confundir com NFC/usuario.ativo, sem dar leitura de hashes/tabelas privadas ao runtime.

Diagnóstico reproduzível: node --env-file=.env scripts/verify-human-access-077.ts (somente hvb_sistema_test local; rollback; falhas esperadas até correção canônica). Runner de migrations foi ajustado para não restaurar SELECT nas cinco tabelas privadas. Informar preparo dos roles locais exigidos pela 077, sem editar a migration.

Disponibilizar CA confiável para pg no ambiente privado; manter credenciais fora de chat/Git. Não remover verify-full. Devolver contrato SQL corrigido e evidências, preservando histórico. Nenhuma autorização para criar 078 é inferida deste pedido.
```

## Funções verificadas e limites

As funções abaixo foram consumidas **no diagnóstico**, não por endpoints de login publicados: `acesso_humano_emitir_senha_temporaria`, `acesso_humano_marcar_senha_temporaria_enviada`, `acesso_humano_obter_prova`, `acesso_humano_consumir_senha_temporaria`, `acesso_humano_criar_sessao`, `acesso_humano_encerrar_sessao`, `acesso_humano_bloquear`, `acesso_humano_desbloquear`, `limite_acesso_humano_consultar`, `limite_acesso_humano_registrar_falha`, `limite_acesso_humano_limpar`, além de `hvb.autenticar` preservada. Eventos de identidade são gerados pelas funções; registro de tentativas do backend e leitura administrativa de status ainda não estão integrados.

Não houve edição de BFF/frontend nem alteração de `/ready`: login humano ainda não foi habilitado, e prontidão atual continua sendo a da API existente. Quando habilitado, readiness da capacidade humana deve verificar a 077 e suas funções, sem considerar o atual /ready prova de login humano pronto.

## Testes e evidências

| Ambiente/comando | Resultado |
|---|---|
| Node local: `node --test tests/human-access-password.test.ts` | PASS, 5 testes de PHC/custo/salt, política, verificação, fronteira de email e erros sem segredo |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| Biome lint dos arquivos TS afetados | PASS |
| PostgreSQL local: `node --env-file=.env --test --test-concurrency=1 tests/database-runtime.test.ts tests/operational-registration.test.ts` | PASS, 14 testes; health/ready/Bearer, herança, tenant/rollback, onboarding com/sem NFC e regressões operacionais |
| `node --env-file=.env scripts/verify-human-access-077.ts` | FAIL: 12 verificações PASS, 2 FAIL (42702 e sessão viva após emissão de recuperação); rollback |
| Supabase conector, transação sintética com rollback | FAIL 42702 no consumo; não é E2E da API/BFF. Primeira tentativa de fixture revelou permissão acesso:administrar ausente no catálogo remoto; segunda incluiu somente essa permissão na transação, sem persistir seed |
| Node/pg com ambiente privado remoto | FAIL `SELF_SIGNED_CERT_IN_CHAIN` antes de SQL; verify-full preservado |
| Provedor real de email, navegador/BFF, jornada E2E humana remota | NÃO EXECUTADO; configuração/integração e correção canônica pendentes |

Os PASS do diagnóstico de sessão/logout/bloqueio partem de fixture direta ativa. Provam funções isoladas, não uma entrada real com senha. O isolamento A×B foi confirmado para obtenção de prova; rate limit por conta/origem foi confirmado nas funções. Isso não prova aplicação desses controles em um endpoint ainda inexistente.

### Cobertura dos 25 itens pedidos

| Itens | Evidência disponível / o que falta |
|---|---|
| 1–4 | PASS local das funções de ativação/CPF inválido/PHC/recusa antes de marcar envio; não E2E HTTP |
| 5–9 | NÃO EXECUTADO no E2E; consumo canônico FAIL 42702 impede concluir definição e uso único. Expirada/invalidada/reuso e primeira entrada HTTP ainda precisam de teste |
| 10–11 | PASS somente do verificador Argon2 local; login HTTP humano NÃO IMPLEMENTADO |
| 12–14 | PASS local em fixture direta: criação de sessão/API, hvb.autenticar e logout |
| 15 | FAIL para revogação ao emitir recuperação; troca efetiva bloqueada pelo 42702 |
| 16–17 | PASS local em fixture direta: bloqueio revoga, desbloqueio não ressuscita |
| 18–19 | PASS das funções locais compartilhadas; aplicação em endpoint e concorrência multi-instância NÃO EXECUTADAS |
| 20 | PASS local para prova A×B; E2E multi-tenant NÃO EXECUTADO |
| 21 | NÃO EXECUTADO no fluxo humano |
| 22 | PASS das saídas controladas e erros da fronteira de envio; análise integrada de logs/tracing de login ainda NÃO EXECUTADA |
| 23–25 | PASS nas regressões locais da API existente/onboarding sem e com NFC |

## Frontend/NFC e retomada

O frontend publicou sua integração NFC até `3c0abe1`, com 48 verificações isoladas declaradas pelo responsável em `docs/evidencias/frontend-nfc-mvp11.json`; essa entrega foi reaproveitada, sem editar seu conteúdo. Nenhum retorno demonstrou defeito concreto no backend NFC. Contratos C18↔onboarding e leitura administrativa permanecem compatíveis, com regressão local aprovada. Não duplicar NFC em credencial nem habilitar login humano simulado. Após o banco resolver os pontos canônicos, implementar handlers privados/BFF, política compartilhada de conta/origem, autenticação/redefinição/logout/bloqueio e integração de email configurada, então executar a matriz E2E completa.

Manifesto de evidências/arquivos e hashes: [login-humano-077.json](evidencias/login-humano-077.json). O SHA final publicado será o commit que contém esta entrega; hashes são do conteúdo testado, sem autorreferência ao próprio manifesto.

Migration 077: SINCRONIZADA
Backend login humano: PENDENTE
E2E Supabase: NÃO EXECUTADO
NFC backend: COMPATÍVEL
Frontend: NÃO ALTERADO
Terminal/C18: NÃO ALTERADO
Migrations 001–076: PRESERVADAS
Migration 078: NÃO CRIADA
