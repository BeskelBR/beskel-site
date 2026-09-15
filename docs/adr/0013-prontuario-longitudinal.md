# ADR 0013 — Prontuário longitudinal e evoluções

Data: 15/09/2026. Proposta técnica implementada em DEV; políticas hospitalares continuam pendentes.

O núcleo já possui fatos clínicos separados por domínio. C2 acrescenta narrativa versionada e uma consulta integrada aos registros originais. Não cria um segundo livro de execuções, consumos ou resultados.

## Decisões

- Evolução vinculada explicitamente a paciente, episódio e unidade; tipo anamnese/evolução/observação. Cabeçalho e primeira versão nascem atomicamente no mesmo comando. Referência UUID deduplica a intenção por organização/unidade.
- Texto exato de até oito mil caracteres, autor autenticado, motivo, data ocorrida, data de registro e SHA-256 calculado no banco. Hash não constitui assinatura profissional. As escritas exigem simulação e confirmação humana explícitas.
- Correção gera uma versão completa com anterior, número sequencial e versão esperada. A trava por evolução impede sucessores concorrentes; somente um vence. Invalidação também gera versão, preservando todos os textos. Reativar exige outra versão explícita; não equivale a aprovação clínica.
- Inserção exige data não futura, a partir da admissão e até a saída física quando conhecida; na ausência de saída, até a alta clínica, quando conhecida. Limites inclusivos para narrativa. Esse recorte difere da execução M3 e precisa de homologação humana. Registro tardio dentro desses limites é permitido na simulação.
- Alta/saída retroativa não apaga relato. A view calcula revisão temporal para versões registradas fora do intervalo atual. Versões antigas também podem apresentar divergência; o indicador atual distingue a sucessora vigente. Uma retificação pode corrigir o instante mantendo o original consultável. A revisão é derivada, sem produzir uma pendência clínica duplicada.
- Listas e linha do tempo exigem prontuario:ler; o texto integral exige prontuario:conteudo. Escrever e retificar têm permissões próprias. Cada fonte adicional da linha do tempo exige suas permissões originais na unidade. Credenciais de portal não dão acesso às rotas da equipe.
- A linha do tempo conserva o ID de cada fonte e distingue relato, planejamento, execução, consumo, estorno, resultado e declaração externa. Aplicação preventiva interna já está representada pela execução clínica; apenas declarações externas entram como fonte preventiva separada.
- Consulta por paciente/unidade, episódio opcional e janela obrigatória de registro de até 366 dias. Ordenação crescente por instante de registro, tipo e UUID; cursor com os três campos preserva microssegundos. Até cem itens por página, sem deslocamento por offset.

## Limites

A consulta apresenta metadados. Não reúne textos de documentos, valores de exames ou narrativa sem sua permissão específica; o conteúdo permanece nas rotas próprias. Documento usa data ocorrida nula, sem inferir atendimento da geração de um arquivo. Agenda e aplicação externa não recebem episódio inferido e ficam fora da consulta filtrada por episódio.

A linha do tempo não é um snapshot congelado: estados derivados podem mudar e novos registros podem aparecer entre páginas. A janela usa a data de registro; a data ocorrida aparece separadamente e pode ser anterior. Atual indica sucessão/reversão segundo cada fonte, não uma aprovação universal; uma evolução invalidada pode ser a última versão. O episódio aparece como admissão com estado atual, sem representar todas as transições como eventos separados.

Não há assinatura válida, interpretação clínica automática, anexos da evolução, leitura no portal, acesso entre unidades ou autorização de uso assistencial. Desempenho em histórico longo, busca textual, modelos clínicos, coautoria, segregação de funções e políticas de registro tardio permanecem para etapas próprias. Verificação geral e discussão das pendências continuam posteriores à consolidação.
