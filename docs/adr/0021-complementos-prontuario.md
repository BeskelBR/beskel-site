# ADR 0021 — Complementos ligados à versão do prontuário

Estado: proposta implementada em DEV, C11, 16/09/2026. Dados sintéticos, somente SISTEMA/hvb-sistema-dev.

## Decisão

Modelos organizam texto explicitamente informado. Campos são ordenados e identificados por código, com rótulo e obrigatoriedade. Renderização determinística combina rótulo, quebra de linha e valor, separando campos por uma linha vazia. Respostas opcionais ausentes são omitidas; valores não são resumidos, completados ou interpretados. Texto final mantém o limite de 8000 caracteres da evolução. Respostas desconhecidas, repetidas e ausência de obrigatório são rejeitadas.

Cada alteração cria outra versão do modelo sob trava por organização/unidade/código. Quem preenche informa o ID exato, podendo escolher versão histórica. Isso preserva reprodutibilidade e não implica aprovação de um formulário hospitalar. O preenchimento usa a criação C2 para produzir uma evolução nativa e registra sua proveniência na mesma transação. O banco confere modelo, tipo, texto e comando da versão inicial; retificação posterior segue C2, sem transportar respostas anteriores como se fossem novas.

Anexo e coautoria apontam para uma versão exata e seu hash. A inserção usa a mesma trava da evolução e exige versão atual registrada. Retificações preservam anexos e declarações no histórico, sem levá-los à nova versão. Uma coautoria deixa de ser vigente quando a evolução recebe sucessora ou é invalidada. Revogação permanece possível sobre registros históricos, pelo próprio autor, com motivo e evento imutável.

Coautoria é declaração pessoal autenticada: o cliente não escolhe outro usuário como autor. O autor original não declara coautoria de si mesmo. Essa função não certifica assinatura digital, vínculo profissional ou aceite assistencial.

## Anexos e privacidade

Anexos pequenos ficam em bytea no PostgreSQL, sob a mesma transação, RLS, idempotência e auditoria do comando. Isso evita arquivos órfãos e provisionamento de object storage neste recorte. Limite: 256 KiB. Nome é restrito; bytes devem corresponder ao cabeçalho de PDF, PNG ou JPEG. Essa checagem não valida integralmente o formato, nem oferece antivírus ou sanitização. A API devolve JSON/base64 exclusivamente a quem pode ler conteúdo clínico, sem execução, visualização embutida ou endereço público. Revogação bloqueia essa leitura, preservando o registro para retenção futura.

Listagens retornam metadados, nunca bytes, respostas ou narrativa. Nome e motivo devem ser informados considerando essa visibilidade. Detalhes de respostas, anexos e busca exigem prontuario:conteudo. A consulta do modelo usa prontuario:ler porque contém definição do formulário, não respostas do paciente.

## Busca e limites

Busca lexical usa to_tsvector/websearch_to_tsquery em português, índice GIN, parâmetros SQL, paciente e unidade obrigatórios. Não interpreta diagnóstico nem extrai texto dos anexos. A consulta retorna IDs e metadados; a narrativa é obtida pelo controle privado existente. Versões históricas/invalidadas só entram mediante historico=true. Paginação UUID é estável para um conjunto sem inserções; não representa snapshot transacional entre requisições.

Auditoria geral de leituras continua no próximo grupo. Formulários reais, aprovação/retirada de modelos, alçadas para revogação administrativa, assinatura válida, armazenamento de arquivos maiores, antivírus, retenção, criptografia operacional, busca avançada, interface e homologação ficam nas pendências. Nenhuma decisão hospitalar foi deduzida dos exemplos sintéticos.
