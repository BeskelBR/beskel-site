# ADR 0025 — Correção de contexto e anulação clínica

17/09/2026. Aceita para DEV sintético. Continuidade do inventário do núcleo após C14; não aprova regras assistenciais nem uso real.

## Decisão

Uma execução não é editada nem apagada. A correção de contexto registra revisao_execucao e cria uma execução sucessora ligada por correcao_de_id. Permite declarar executor, versão da ordem e programação corretos, inclusive programação null explicitamente, dentro do mesmo episódio/unidade/organização. A sucessora segue as validações existentes de vigência, tempo ocorrido, unidade de medida, programação e quantidade. Não transfere fatos entre pacientes/episódios.

Anulação registra somente um fato de revisão, sem execução substituta, quantidade negativa ou aplicação fictícia. Exige motivo, confirmação literal e modo de simulação. Pode ser registrada depois do encerramento do episódio porque corrige documentação histórica; não reabre episódio nem autoriza assistência posterior.

O autor da revisão é o usuário autenticado e permanece separado do executor declarado na sucessora. Corrigir a atribuição não significa que esse executor assinou ou confirmou a correção. O executor deve existir na mesma organização e estar ativo; representação profissional, assinatura e dupla validação continuam pendentes de política hospitalar. O novo caminho exige clinica:corrigir_contexto e clinica:executar; anular exige clinica:anular. Retificação anterior continua disponível, preservando seu contrato.

## Integridade

ID da execução vigente funciona como versão esperada: execução já substituída/anulada não aceita nova decisão concorrente. Trava do episódio serializa com consumo, programação, retificação e efeitos vinculados. Fato de revisão e sucessora são atômicos; FK e validação diferidas impedem revisão de contexto sem a sucessora correspondente. RLS, FKs compostas, comando aberto, idempotência, auditoria e outbox existentes são reutilizados.

Consumo ativo impede anular ou corrigir contexto. O operador precisa usar o estorno agregado existente, com suas permissões e compensações de estoque, antes da revisão. A revisão clínica nunca devolve material nem altera saldo por conta própria. Não existe restauração automática da anulação.

## Propagação

execucao_vigente considera ausência de sucessora e ausência de anulação. Programação e conciliação material, cobertura/diária, evento cobrável, coleta/resultado e aplicação preventiva usam a origem atual. Uma programação sem execuções vigentes aparece novamente prevista, sem criar outra tarefa, confirmar aplicação ou apagar seus fatos anteriores. Cancelamento explícito da programação é possível se não restar execução vigente.

Anulação resolve pendências materiais/temporais abertas da própria execução, com FK para o fato de anulação. Correção com sucessora continua resolvendo a pendência material como antes; outras revisões humanas não são encerradas genericamente. Novos consumos, coletas e aplicações internas não podem usar execução anulada/substituída.

Avaliações e documentos derivados não são reescritos. Cobertura e cobrança passam a exigir revisão; dívida, preço, responsabilidade, título, pagamento e reservas de limite permanecem nos fatos originais até compensação explícita pelo domínio responsável. Resultados/coletas e protocolos conservam identidade e conteúdo. O prontuário mostra a origem anulada como não atual e o fato de correção com sua autoria/instante.

## Limites

Não resolve troca de paciente/episódio, execução atribuída a usuário inativo, restauração de anulação, novas regras para parciais/doses, edição retroativa de prescrições ou invalidação externa de protocolos. A correção invalida a origem dos efeitos derivados, sem presumir que é clinicamente ou financeiramente correto apagar esses efeitos. Operação, assinatura, alçadas, comunicação ao responsável e regularização dos documentos precisam de política/homologação posteriores.
