# Backend — sincronização canônica 102

25/09/2026, `hvb-sistema-dev`. HEAD recebido: `a24bf2bdce2615a35120c969b345fae9f8ba1f04`. Atualizado por fast-forward até `3ccd15a`, reaproveitando os arquivos do frontend/BFF sem editá-los. O delta local anterior de login humano permanece não publicado e não integra esta entrega. Sua última prova de funções remotas teve 20 PASS / 0 FAIL, antes deste delta; não era teste dos handlers HTTP em elaboração.

## Migrations e escopo

Incorporadas **078–102**, literalmente de `supabase_migrations.schema_migrations.statements[1]`, projeto `yetmjjjjamyshnyqshym`. Os 25 textos recuperados correspondem aos hashes do ledger `public.schema_migration`. Também foi feita comparação dos **102 arquivos locais**, sem divergências. Manifesto completo: [evidencias/sincronizacao-102.json](evidencias/sincronizacao-102.json).

A 078 já estava aplicada e registrada pelo responsável do banco; esta entrega incorpora esse histórico, não inventa outra correção. Migrations 001–077 não foram editadas. Nenhum DDL, grant ou alteração de dados permanente foi aplicado no Supabase por este delta. `hvb.autenticar`, Bearer, Terminal/C18/NFC, estoque, financeiro, regras documentais e orçamento foram preservados.

O TEST fora do OneDrive recebeu 078–102 pelo runner existente. A 086 pressupõe a função de plataforma `public.rls_auto_enable()`, ausente no PostgreSQL comum. Para reproduzir esse ambiente, a definição observada no Supabase foi instalada **somente no TEST**, como pré-requisito separado; não foi alterada a migration nem criado um event trigger novo. Instalações locais novas precisam desse pré-requisito e dos roles de plataforma exigidos pela 077. O cluster antigo sob OneDrive não foi utilizado.

## Contratos existentes atualizados

Não houve nova rota: OpenAPI permanece com **293 paths**. Nove paths relacionados tiveram schemas ampliados; todos os paths Terminal permaneceram idênticos.

| Contrato | Comportamento atual |
|---|---|
| POST/GET `/v1/responsaveis` | Campos pessoais e endereço estruturado da 098; `numero` é texto, datas são `YYYY-MM-DD`, opcionais aceitam null; banco normaliza os valores |
| POST/GET `/v1/pacientes` | Campos atuais, microchip opcional, contato de emergência estruturado; não aceita os três campos legados removidos |
| POST `/v1/pacientes` | **Exige `responsavel_id` e `papel_responsavel`** (`legal`, `financeiro`, `contato`), além dos três campos básicos. Cria paciente + vínculo inicial vigente na mesma transação e idempotency-key. Necessário pela constraint diferida da 085; não cria responsável fictício nem presume seu papel |
| GET `/v1/responsaveis?q=...` | Nome contém texto literal, CPF/telefone com pontuação normalizada para busca exata, email exato sem distinguir caixa e UUID; sempre dentro da organização autenticada |
| GET `/v1/pacientes?q=...` | Nome literal, UUID ou microchip exato normalizado; mantém envelope `{items,next_cursor}` e paginação UUID |
| GET `/v1/vinculos?paciente_id=...` ou `?responsavel_id=...` | Usa `paciente_responsavel_consulta`; expõe nomes/estado/autor/data, mantém `id` como alias de `vinculo_id` para preservar cursor e consumidores |
| GET `/v1/episodios?unidade_id=...` | Usa `episodio_consulta`: paciente_nome e estado canônico. Filtros anteriores preservados; `ativos=true` continua significando ainda não encerrado, inclusive alta clínica |
| GET `/v1/ocupacoes?unidade_id=...` | Usa `ocupacao_consulta`, com filtros opcionais episodio_id/paciente_id; nomes e estados vêm da view |
| GET `/v1/atribuicoes` e `/{id}/revisoes` | Novos nomes, `escopo` global/unidade e unidade_nome; global continua sendo unidade_id ausente na escrita e null na leitura |
| POST/GET revisões de paciente/responsável | Reutiliza revisao_cadastro e suas funções; opcionais omitidos preservam valores existentes, null limpa campo quando permitido. Schemas de snapshots antigos não exigem campos que não existiam na versão histórica |
| `/ready` | Exige registro/hash canônico 102 e os 102 números do ledger, mantendo verificações anteriores de herança, privilégios e ausência de superuser/BYPASSRLS |

Exemplo mínimo do cadastro de paciente pelo contrato atual:

```json
{
  "nome": "Paciente sintético",
  "especie_codigo": "canina",
  "estado_vital": "vivo",
  "responsavel_id": "UUID_DO_RESPONSAVEL_JA_CADASTRADO",
  "papel_responsavel": "legal",
  "microchip": null
}
```

Essa mudança é incompatível com o fluxo antigo que criava paciente e só depois seu primeiro vínculo em outra requisição. O frontend deve enviar o vínculo inicial no próprio cadastro. Não alterar a regra do banco para conservar esse fluxo antigo. Os endpoints de vínculos adicionais e encerramento continuam existentes; o último responsável vigente não pode ser retirado sem sucessor, conforme a 085.

## Evidências

| Ambiente / verificação | Resultado |
|---|---|
| Arquivos locais × ledger canônico, 001–102 | **PASS, 102 hashes iguais** |
| TEST isolado em `AppData/Local/HVB/postgres-test-20260924` | 102 migrations registradas, sem alteração das históricas |
| TypeScript do backend (`tsc --noEmit -p .local/tsconfig.backend.json`, inclui src/scripts/tests) | **PASS** |
| TypeScript global (`tsc --noEmit`) | **FAIL**, quatro diagnósticos no `api/gateway.ts` recebido do frontend, não editado neste delta |
| Lint dos dez arquivos TS do delta e diff check | **PASS** |
| OpenAPI | **PASS**, 293 paths, nenhum removido/adicionado, Terminal inalterado |
| TEST: database-runtime + operational-registration + registry-corrections + registration-102 | **28 PASS / 3 FAIL**, 31 testes; app do delta 102 isolado em memória do trabalho pendente de login humano |
| Novos testes 102 dentro da contagem anterior | **5 PASS / 1 FAIL**: busca de responsável nos cinco modos, nome/microchip/UUID de paciente, microchip null, normalização, contato, vínculo nos dois sentidos, RLS/tenant, revisões, episódio/ocupação e escopo global passaram |
| Node/pg Supabase verify-full, `scripts/verify-schema-102.ts <arquivo-privado>` | **8 PASS / 7 FAIL / 1 BLOCKED**, rollback confirmado |

As três falhas locais derivam do mesmo bloqueio: `hvb_app` não pode executar `hvb.cpf_valido(text)`, agora usada pela constraint de responsável. Falham o cadastro pelo runtime, a fixture de responsável de uma regressão de revisão e o INSERT que antecede o teste de rollback. O teste novo de cadastro **continua esperando sucesso**, sem converter o defeito em teste verde.

Os testes independentes de leitura/revisão usaram responsáveis sintéticos criados pelo administrador do TEST; isso está explícito no teste e **não comprova cadastro de responsável pelo runtime**.

No Supabase, passaram TLS, 102 registros, todos os hashes, quatro views security_invoker, /ready, Bearer existente, escopo global do administrador sintético e preservação de `hvb.autenticar`. Falharam a capacidade EXECUTE de cpf_valido e seis rotas da fixture com HTTP 403 (cadastros/vínculos/episódios/ocupações). Portanto a jornada remota de cadastro ficou bloqueada antes da criação. Leitura do catálogo confirmou que o problema de cpf_valido também existe no remoto.

O verificador remoto mantém as operações da API em savepoints dentro de uma transação externa, revertida ao final. Isso valida handlers/SQL com Node/pg real, mas não simula commits independentes ou navegador. Não houve cadastro sintético remoto persistido. As verificações anteriores de transações independentes continuam documentadas no E2E remoto, sem serem substituídas por esta técnica.

## Pendências e pedidos por responsável

**Banco/configuração — bloqueadores comprovados:**

```text
Supabase DEV 102: o runtime herda hvb_app, mas has_function_privilege('hvb_app','hvb.cpf_valido(text)','EXECUTE') retorna false. A constraint de responsavel adicionada pela 096 exige essa função; INSERT de responsável, inclusive CPF NULL, falha 42501. Avaliar e aplicar a concessão mínima canônica de EXECUTE a hvb_app, preservando NOLOGIN/RLS e sem reescrever migrations aplicadas. Não dar acesso às tabelas privadas de identidade.

A fixture tenant_a de e2e-fixture.json autentica e tem acesso:administrar global, mas retorna 403 em cadastros e episódios. Preparar permissões apenas para essa fixture sintética: cadastros:ler/escrever/retificar, episodios:ler/escrever e locais:ler/escrever, conforme catálogo e contratos existentes. Não ampliar contas reais. Informar o novo estado/artefato canônico e como reproduzi-lo no TEST. Não enviar segredos.
```

**Frontend — adaptação de contrato e CEP:**

```text
Integrar OpenAPI 102 preservando BFF/session e Terminal. POST /v1/pacientes agora precisa de responsavel_id + papel_responsavel na mesma requisição; o banco proíbe paciente sem vínculo vigente ao commit. Usar campos estruturados e buscas q atualizadas; vínculos são consultados pelos dois IDs; episódio/ocupação/atribuição já devolvem estados/escopo canônicos.

Autocomplete de CEP pertence à aplicação/BFF, com serviço de CEP a configurar. Preencher logradouro/bairro/cidade/UF e manter TODOS editáveis; número/complemento preenchíveis. Não criar HTTP no PostgreSQL nem rota paralela de cadastro. Backend persiste o endereço estruturado recebido; este delta não implementa UI nem escolhe provedor.

Corrigir também o typecheck do api/gateway.ts recebido em 3ccd15a: method string não compatível com HTTPMethods (linha 180); efeitos de inferência de app.inject em statusCode/headers/body (186/187/191). Arquivo preservado por este chat.
```

**Backend:** repetir os três testes falhos e a jornada remota após o ajuste canônico/fixture; retomar o delta de login humano local em etapa própria. **Decisão humana:** orçamento/aceite continua intocado; serviço real de email/ambiente humano permanece pendente. **Evidência insuficiente:** jornada completa remota, navegador/BFF com os campos novos, CEP real e homologação não estão aprovados. Não declarar sistema funcional a partir de /ready isolado.
