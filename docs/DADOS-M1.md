# Dicionário físico resumido — M1

DDL executável e completo em `migrations/`. UUID é identidade interna; instantes são `timestamptz`; campos de quantidade monetária/estoque não existem em M1. Valores futuros deverão usar tipos exatos e unidades explícitas.

| Grupo | Tabelas | Garantias principais |
|---|---|---|
| Institucional | organizacao, unidade_hospitalar | Organização própria, unidade com fuso explícito |
| Acesso | usuario, papel, permissao, usuario_papel, papel_permissao | Conta individual; unicidades; atribuição opcional por unidade; FKs organizacionais |
| Identificação | credencial, dispositivo | Token somente em hash; tipo API/NFC distinto; validade/revogação; dispositivo por unidade |
| Cadastros | responsavel, especie, paciente | Espécie explícita em catálogo; estado vital pode ser desconhecido; sem inferência por nome |
| Vínculos | paciente_responsavel | Papel legal/financeiro/contato e vigência; sobreposição do mesmo vínculo impedida |
| Episódio | episodio | Admissão/registro/alta/saída separados; autoria por fato; versão e motivos |
| Espaço físico | local, ocupacao | Hierarquia tipada dentro da unidade; capacidade explícita; vaga e intervalo; exclusividade por episódio |
| Comandos | comando | Chave idempotente contextual, hash, resultado e timestamps no mesmo commit |
| Auditoria | evento_auditoria | Append-only, autoria, correlação e motivo; sem snapshot integral de prontuário |
| Automação | outbox, inbox | Intenção atômica, lease, tentativas, pendência e consumo local deduplicado |
| Proveniência | lote_importacao, id_externo | Origem sintética única neste lote; vínculo tipado e exclusivo a paciente, responsável ou episódio; qualidade explícita |

São 22 tabelas no schema `hvb`, além de `public.schema_migration`. FKs não apagam fatos em cascata. `id_externo` não usa um ID genérico sem integridade: mantém colunas com FKs próprias e constraint de exatamente uma entidade compatível. Lote de importação não importa arquivos nem acessa legado.

Índices seguem listas keyset, histórico do paciente, episódios ativos, papéis por usuário e outbox disponível. As unicidades `(organizacao_id,id)` também atendem as listas; índices duplicados identificados no benchmark foram removidos. Índices de exclusão GiST protegem intervalos. Veja os planos reais em `docs/evidencias/benchmark-m1.json`.

Limitações deliberadas: catálogo de espécies mínimo e proposto; sem raça, contato, documento pessoal, peso, prontuário, prescrição ou estoque. Não preencher campos desconhecidos com valores inventados. As organizações do seed não representam a estrutura real aprovada do HVB.
