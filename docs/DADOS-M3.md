# Dicionário físico resumido — M3

As migrations 011–013 acrescentam 12 tabelas clínicas ao schema `hvb`, totalizando 46 tabelas, além de `public.schema_migration`. Quatro novas views complementam a view de estoque de M2. As migrations anteriores foram preservadas.

| Tabela | Identidade e integridade |
|---|---|
| item_clinico | Identidade organizacional do medicamento/procedimento/cuidado/outro; distinta do produto físico |
| prescricao | Episódio e unidade hospitalar tipados, prescritor autenticado, instante informado de assinatura, registro e motivo |
| ordem | Identidade estável dentro da prescrição e episódio |
| ordem_versao | Sequência única por ordem, item, quantidade/unidade de medida, via/orientação, vigência, autor e motivo; imutável |
| programacao | Horário explícito, versão exata da ordem e autoria; única por versão/instante; não execução motivada preservada |
| execucao | Fato confirmado, versão/programação, evento de referência, autor, tempos ocorrido/registrado, quantidade/unidade, parcial/integral, declaração de material e retificação tipada |
| material_previsto | Associação item clínico/produto com versão consecutiva, quantidade base, critério e aprovador; não comprova uso |
| consumo | Episódio, execução opcional, evento, comando tipado, instante ocorrido, finalidade/motivo e confirmação dos itens |
| consumo_item | Posição física, lançamento negativo e transação de estoque únicos, quantidade e custo total preservado |
| estorno_consumo | Compensação integral única do consumo, autoria, tempo e motivo; todos os itens precisam ser revertidos no commit |
| pendencia_clinica | Origem tipada e exclusiva: execução, consumo, programação ou versão; tipo, descrição e criação |
| resolucao_pendencia_clinica | Resolução imutável por pendência, autoria/motivo e evidência tipada de consumo ou execução substituta quando necessária |

Views sob `security_invoker=true`, preservando RLS: `programacao_consulta` deriva estado prevista/parcial/concluída/não executada; `execucao_consulta` mostra substituição e conciliação de material; `consumo_consulta` mostra estorno; `pendencia_clinica_consulta` mostra resolução sem sobrescrever a pendência original.

Quantidades usam `numeric(20,6)` e strings na API. `custo_total_snapshot` usa `numeric(40,12)` para preservar exatamente o produto entre quantidade e custo unitário com seis casas, sem arredondamento monetário implícito. Valor desconhecido continua nulo; custódia do tutor não recebe custo de aquisição hospitalar.

O movimento `consumo` usa a contrapartida virtual `consumido`. Cada item aponta para o lançamento negativo integral correspondente, sem dividir um lançamento entre pacientes. O cabeçalho, os itens e o livro são gravados no mesmo comando. Triggers recusam movimentos sem consumo correspondente, itens anexados a comando já finalizado e estorno incompleto. A migration 013 vincula os consumos sintéticos criados durante 011/012 ao comando já auditado antes de exigir o novo campo; nenhum vínculo é inferido por nome.

Índices atendem versão/vigência por ordem, mapa por unidade/tempo, histórico por episódio, execução por programação, consumo por execução e itens/pendências por origem. A paginação continua por UUID, com limite máximo 100. O mapa exige janela explícita de até sete dias e não promete ordenação cronológica por cursor.

Limites e decisões operacionais pendentes estão em `PENDENCIAS-HVB.md`. Não há prontuário completo, assinatura operacional certificada, cálculo terapêutico, regra de cobertura ou cobrança neste recorte.
