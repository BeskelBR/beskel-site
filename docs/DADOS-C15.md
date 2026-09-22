# Dicionário C15 — Revisão de execução

Migrations aditivas 067–068; migrations anteriores preservadas.

| Objeto | Contrato |
|---|---|
| revisao_execucao | Fato imutável de tipo contexto/anulacao; organização, unidade, episódio, execucao_id, substituta_id opcional, autor, comando, motivo e criada_em |
| Unicidade/linhagem | Uma revisão por execução e uma revisão por sucessora; FKs de episódio/unidade; sucessora obrigatória apenas para contexto; vínculo diferido exige correcao_de_id igual à origem |
| resolucao_pendencia_clinica.anulacao_id | Referência tipada à anulação da mesma execução; não pode coexistir com consumo ou sucessora na mesma resolução |
| execucao_vigente(org,id) | Consulta com RLS: execução existente, sem sucessora e sem anulação |
| execucao_consulta | Conserva campos anteriores e acrescenta anulacao_id; conciliacao_material pode ser anulada |
| Projeções dependentes | Programação, cobertura, período de diária, evento cobrável, coleta e aplicação preventiva consideram anulação; resultados/avaliações derivados herdam necessidade de revisão |

## Operações novas

- POST /v1/clinica/execucoes/{id}/corrigir-contexto: campos completos de clinicalCorrection mais ordem_versao_id, programacao_id obrigatório (UUID ou null), executor_id e simulacao=true. Usa clinica:corrigir_contexto e clinica:executar. Retorna o ID da execução sucessora.
- POST /v1/clinica/execucoes/{id}/anular: motivo, confirmacao_humana=true, simulacao=true. Usa clinica:anular. Retorna o ID da revisão de anulação.
- GET /v1/clinica/revisoes-execucao: clinica:ler, unidade_id obrigatório, filtros execucao_id/episodio_id, cursor e limite da paginação existentes. Exibe autor, origem, sucessora, tipo, comando, motivo e recebimento.

POSTs preservam Bearer, Idempotency-Key e comando transacional. Não exigem dispositivo físico. Retry exato retorna o mesmo resultado; corpo diferente com a mesma chave conflita. ID de origem já substituída/anulada é conflito de decisão. Erros de schema são 400; autorização 403; registro não visível 404; incompatibilidade de contexto, consumo ativo, concorrência ou FK 409.

No prontuário, correcao_execucao é um novo tipo de evento da fonte clinica, com autor da revisão e instante de registro. A execução original continua com o executor original; quando anulada aparece situacao=anulada e atual=false. O fato de correção não representa uma segunda administração.

Ordens/prescrições não são alteradas por esses comandos. A nova execução precisa pertencer a versão válida no instante declarado e a programação compatível. Reverter consumo, regularizar cobranças, corrigir resultado e revisar protocolo continuam ações separadas. Ver ADR 0025.
