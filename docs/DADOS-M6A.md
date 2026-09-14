# Dicionário M6A — Exames e resultados

Migrations 024–025, em complemento aos dicionários M1–M5. São 14 tabelas novas e três views; total atual de 100 tabelas e 27 views no schema `hvb`. Registros de domínio têm UUID, organização, unidade, autor, comando, motivo e instante de registro. FKs compostas impedem vínculos entre organizações/unidades; RLS forçada protege organização. A API verifica permissão e unidade antes de consultar ou escrever.

| Tabela | Identidade e finalidade |
|---|---|
| `laboratorio_exame` | Laboratório interno/externo declarado, sem conexão externa |
| `exame_catalogo` | Especialização única de item clínico; código por unidade |
| `exame_versao` | Versão consecutiva da estrutura, método, laboratório, material e necessidade explícita de coleta |
| `atributo_exame_versao` | Código, ordem, tipo, unidade textual e obrigatoriedade; gravado atomicamente com a versão |
| `aprovacao_exame_versao` | Aprovação humana da estrutura para simulação, única por versão |
| `referencia_analito_versao` | Referência versionada por atributo/código, espécie e faixa etária opcional; limites e inclusão das fronteiras explícitos |
| `solicitacao_exame` | Episódio, indicação, instante ocorrido e UUID persistente do fato |
| `item_exame` | Versão técnica exata solicitada; todos os itens pertencem ao comando da solicitação |
| `cancelamento_item_exame` | Cancelamento com autoria/motivo, permitido antes de qualquer resultado liberado |
| `coleta_exame` | Material, instante e referência persistente; execução interna identificada ou coletor externo informado |
| `decisao_amostra` | Aceitação/rejeição única por coleta, com instante e motivo |
| `resultado_versao` | Item, versão consecutiva, anterior, coleta opcional, produção, referência persistente e contexto de idade |
| `valor_resultado` | Atributo exato, texto original, número/booleano, qualificador, referência explícita e situação; atômico com resultado |
| `liberacao_resultado` | Resultado exato, hash SHA-256, confirmação das pendências, autoria e instante |

Todas essas tabelas são imutáveis; inserção exige comando ainda aberto com autor correspondente. Correção de estrutura ou resultado cria nova versão. Os resultados aceitam até 100 valores; solicitações, até 20 itens. Um item não repete a mesma versão técnica dentro da mesma solicitação.

`decimal_resultado` aceita número finito, módulo menor que 10^16 e até oito casas decimais, sem arredondamento. Na API, número é **string decimal**, inclusive negativo. `numero` e limites ausentes retornam `null`; `booleano: false` não é ausência. `texto_original` é preservado independentemente da representação tipada. `nao_obtido` não inventa número, booleano ou referência.

Referência pertence ao atributo e, por ele, à versão técnica/método/laboratório. Espécie precisa coincidir com o paciente. Referência com faixa etária exige idade informada e dentro das fronteiras declaradas; idade estimada não confirma essa compatibilidade. Não há escolha automática de referência, cálculo de idade nem interpretação dos limites.

| View/função | Semântica |
|---|---|
| `coleta_exame_consulta` | Situação da amostra e atividade da execução de origem |
| `resultado_exame_consulta` | Liberação, substituição, nova versão pendente, atributos obrigatórios ausentes, pendências e necessidade de revisão |
| `documento_resultado_consulta` | Conteúdo técnico serializado e metadados da liberação; API exige resultado específico |
| `conteudo_resultado` | JSONB com resultado, item, solicitação, ID do paciente, versão técnica, laboratório, coleta/decisão e valores/referências ordenados |
| `hash_resultado` | SHA-256 dos bytes UTF-8 da representação textual exata desse JSONB |

Para verificar o hash, usar a string `conteudo_json` retornada, sem reserializar o objeto. O documento é um contrato técnico DEV, sem apresentação de laudo, assinatura profissional validada ou envio ao tutor. Metadados evolutivos de revisão são consultados separadamente; o conteúdo liberado permanece preservado.

Escritas de resultado/liberação travam o episódio e o item de exame. Nova versão exige `versao_esperada`; publicar uma versão antiga depois de criar outra é recusado. Uma correção em rascunho deixa a publicação anterior vigente e sinaliza pendência; somente nova liberação a marca como substituída. Ausência de atributo obrigatório bloqueia liberação; valor explicitamente não obtido ou referência pendente exige confirmação das pendências.

Contratos: [OpenAPI](../openapi/hvb-sistema.json). Contexto e limites: [relatório](RELATORIO-M6A.md) e [ADR 0007](adr/0007-exames-resultados.md).
