# Dicionário C2 — Prontuário longitudinal

Migrations 041–043; duas tabelas e uma view novas. Total confirmado localmente: 148 tabelas, 44 views, 94 permissões e 43 migrations. Registros novos têm organização, unidade, autor, comando, motivo e data de registro, RLS forçada e histórico imutável.

| Entidade | Conteúdo |
|---|---|
| evolucao_clinica | Paciente, episódio, tipo e referência deduplicável |
| evolucao_clinica_versao | Sequência, anterior, estado, instante ocorrido, texto exato e hash |
| evolucao_clinica_versao_consulta | Metadados, versão atual e divergência temporal derivada do episódio |

| Rota sob /v1 | Operação e permissão |
|---|---|
| /prontuario/evolucoes | POST: prontuario:escrever; GET: prontuario:ler |
| /prontuario/versoes | POST: prontuario:retificar; GET: prontuario:ler |
| /prontuario/versoes/:id | GET de texto: prontuario:conteudo, com unidade_id obrigatório |
| /prontuario/linha-do-tempo | GET: prontuario:ler e permissões das fontes escolhidas |

São seis operações novas; contrato total de 296 operações em 180 caminhos. POST exige Idempotency-Key, simulacao=true, confirmacao_humana=true e motivo. Criação devolve id da evolução e evolucao_versao_id; retificação devolve id da versão.

| Fonte da linha do tempo | Permissões adicionais |
|---|---|
| evolucoes | Nenhuma além de prontuario:ler; metadados |
| clinica | clinica:ler e episodios:ler |
| exames | exames:ler |
| documentos | documentos:ler |
| agenda | agenda:ler |
| preventivos_externos | protocolos:ler |

Fontes padrão: evolucoes,clinica. A seleção é separada por vírgula, sem duplicatas. Filtros obrigatórios: unidade_id, paciente_id, inicio_registro e fim_registro; intervalo de registro fechado no início e aberto no fim. Episodio_id é opcional. Limit padrão 25, máximo 100. O next_cursor devolve registrado_em, tipo e id; reenviar como apos_registro, apos_tipo e apos_id, conservando os demais filtros. Os três componentes são obrigatórios quando há cursor. Datas do cursor mantêm seis casas de microssegundos em UTC.

As duas listas de evoluções/versões mantêm paginação UUID do núcleo, com paciente/episódio e evolução conforme o contrato. Não contêm o texto integral. Semântica dos estados, retrospectividade e limites em [ADR 0013](adr/0013-prontuario-longitudinal.md).
