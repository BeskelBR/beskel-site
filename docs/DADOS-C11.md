# Dicionário C11 — Complementos do prontuário

Migrations 059–060, versão 0.20.0. Seis tabelas, quatro views, três permissões e 16 operações novas. Totais DEV conferidos: 179 tabelas, 68 views, 115 permissões, 365 operações em 221 caminhos.

Todas as tabelas novas têm organização, unidade, autor autenticado, comando aberto, motivo, criação, FKs, RLS e proteção contra alteração/exclusão.

| Entidade | Conteúdo e invariantes |
|---|---|
| modelo_evolucao_versao | Código por unidade, nome, tipo, versão, anterior e 1–16 campos ordenados; código de campo único, rótulo e obrigatoriedade |
| preenchimento_modelo_evolucao | Modelo exato, versão inicial da evolução original e respostas explícitas; mesmo comando e texto conferido pelo banco |
| anexo_evolucao | Versão exata, hash da evolução, nome, MIME, bytes, SHA-256 e tamanho calculados; até 262144 bytes |
| revogacao_anexo_evolucao | Um registro por anexo, pelo próprio autor; preserva bytes e bloqueia consulta de conteúdo pela API |
| coautoria_evolucao | Declaração do usuário autenticado sobre versão/hash; distinta do autor original e única por usuário/versão |
| revogacao_coautoria_evolucao | Revogação única pelo próprio coautor; histórico preservado |

Views: modelo_evolucao_consulta, preenchimento_evolucao_consulta, anexo_evolucao_consulta e coautoria_evolucao_consulta. Não expõem campos/respostas/bytes em listagens. Indicadores atual, revogada e vigente são booleanos; tamanho é inteiro. Coautoria vigente exige versão atual registrada e declaração não revogada.

## Contratos sob /v1/prontuario

| Método | Caminho | Permissão |
|---|---|---|
| POST | /modelos | prontuario:modelar |
| POST | /evolucoes-modeladas | prontuario:escrever |
| POST | /anexos, /revogacoes-anexos | prontuario:anexar e prontuario:conteudo |
| POST | /coautorias, /revogacoes-coautorias | prontuario:coautoria e prontuario:conteudo |
| GET | /modelos, /preenchimentos, /anexos, /coautorias, /revogacoes-anexos, /revogacoes-coautorias | prontuario:ler |
| GET | /modelos/:id | prontuario:ler |
| GET | /preenchimentos/:id | prontuario:conteudo |
| GET | /anexos/:id/conteudo | prontuario:conteudo |
| GET | /busca | prontuario:conteudo |

POST exige unidade, motivo, simulação e confirmação humana verdadeiras, além de chave idempotente. Modelo recebe versao_esperada=0 na criação e versão atual nas revisões. Evolução modelada recebe paciente/episódio, referência, instante, modelo_versao_id e respostas [{codigo,valor}]. Reutiliza evolução nativa e retorna os mesmos tipos de IDs. Uma versão histórica de modelo pode ser escolhida explicitamente; não há troca silenciosa pela versão mais nova.

Anexo recebe evolucao_versao_id, hash_evolucao, nome, mime e conteudo_base64 canônico. MIME limitado a PDF/PNG/JPEG, com conferência do cabeçalho binário. Somente essa rota permite corpo HTTP de até 360000 bytes; as outras preservam o limite de 32768. Conteúdo privado retorna JSON/base64, sem renderização ou URL pública. Revogação recebe anexo_id. Coautoria recebe versão/hash; o autor vem da autenticação. Revogação recebe coautoria_id.

Listagens exigem unidade, usam cursor UUID e filtros contextuais presentes em cada resposta. Detalhes exigem unidade e ID. Busca exige unidade, paciente e q de 3–160 caracteres; aceita episódio, historico=false, cursor e limit de 1–50. Pesquisa textual PostgreSQL em português com índice GIN; resposta contém metadados e next_cursor, sem trechos clínicos. Por padrão considera apenas versões atuais registradas; historico=true inclui anteriores e invalidadas. O texto permanece na rota privada C2.

Ver [OpenAPI](../openapi/hvb-sistema.json), [ADR 0021](adr/0021-complementos-prontuario.md) e [relatório](RELATORIO-C11.md).
