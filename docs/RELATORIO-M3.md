# Relatório do recorte M3 — HVB Sistema

Data: 13/09/2026. Continuação autorizada do backlog, exclusivamente em `SISTEMA` e `hvb-sistema-dev`, com ambiente local e dados fictícios. As pendências anteriores foram preservadas e ampliadas, conforme solicitado.

## Resultado

Backend de clínica operacional implementado: item clínico, prescrição, ordem e versão, programação, execução confirmada, retificação, material previsto, consumo identificado, estorno e pendências clínicas. São **23 operações HTTP clínicas**, totalizando **97 operações em 66 caminhos**. As migrations **011–013** acrescentam 12 tabelas e quatro views; nenhuma migration M0/M1/M2 foi reescrita. Não foram adicionadas dependências.

| Entrega | Comportamento verificado |
|---|---|
| Prescrição e ordem | Autor autenticado, assinatura declarada, versão esperada, vigência e histórico preservados |
| Programação | Horário explícito e versão exata, mapa por unidade/período, não execução motivada |
| Execução | Confirmação explícita; planejado/ocorrido/registrado separados; parcial/integral; conclusão única por programação |
| Retificação | Novo fato referenciando o original; contexto preservado; consumo ativo exige estorno anterior |
| Material desconhecido | Execução permanece confirmada, saldo intacto e pendência de conciliação aberta |
| Consumo | Posições/lotes identificados, até 20 itens distintos, baixa atômica e custo exato; não gera cobrança |
| Tutor | Material restrito ao paciente/episódio compatível, sem custo de aquisição HVB |
| Estorno | Compensação integral vinculada de todos os itens; execução preservada e pendência reaberta |
| Revisão | Sobreposição, nova versão, alta, validade e custo desconhecido produzem pendências, sem decisão clínica automática |

Exemplo de integridade testado: retirar duas unidades da origem coloca duas no destino; confirmar execução não muda esse saldo; consumir uma do destino reduz somente o destino. Se faltar saldo em outro item do mesmo consumo, todas as baixas e o cabeçalho são desfeitos, enquanto a execução previamente confirmada continua registrada.

`db:seed:clinical` cria um cenário explicitamente fictício e deixa a execução simulada com material pendente. A repetição foi verificada sem duplicação. As referências ficam em `.local/clinical-demo.json`, ignorado pelo Git. A confirmação do seed não representa ato assistencial real.

## Verificação

- **52 testes aprovados**, sem ignorados: cinco unitários e 47 de integração PostgreSQL, incluindo 17 cenários novos de M3 e as regressões M1/M2.
- TypeScript estrito, lint, formatação e OpenAPI aprovados.
- Migrations 001–013 executadas em TEST vazio no cluster adicional `127.0.0.1:55433`; a base anterior foi preservada por renomeação. DEV principal não foi reinicializado.
- Execução e repetição com a mesma chave por **HTTP real local** retornaram 200, mesmo ID e resultado idempotente.
- Testes cobrem concorrência de conclusão/versão/consumo, timeout simulado, reserva, rollback de múltiplos itens, retificação/estorno, precisão de custo, tutor incorreto, outra unidade/organização, confirmação explícita, histórico temporal e bloqueio de escrita SQL incompatível.
- Reconciliação do livro com saldo físico: **zero divergências** nos testes e no benchmark.

Evidências: [checks-m3.json](evidencias/checks-m3.json) e [benchmark-m3.json](evidencias/benchmark-m3.json). Relatórios e evidências M1/M2 foram preservados. Ambiente validado: Node 24.19.0 e PostgreSQL 17.10 nativo no Windows. Docker/Linux e workflow manual continuam sem execução neste host.

## Desempenho observado

Mil programações fictícias criadas por comandos, concentradas em um episódio; dez aquecimentos e cem medições por operação. Fastify inject e PostgreSQL no mesmo computador, sem TLS ou rede externa. O consumo medido usa um item; no cenário vinculado, a execução de preparação foi criada fora da janela de medição.

| Operação | p50 | p95 | Statements totais / funcionais |
|---|---:|---:|---:|
| Mapa de até 50 programações | 2,26 ms | 2,62 ms | 7 / 4 |
| Confirmar execução | 2,56 ms | 3,10 ms | 13 / 10 |
| Consumo avulso de um item | 5,02 ms | 5,85 ms | 18 / 15 |
| Consumo vinculado à execução | 5,29 ms | 5,90 ms | 19 / 16 |

O consumo excedeu o orçamento provisório e foi investigado. Removida uma consulta repetida de lock por item; os demais statements preservam autorização, validação física, qualidade, histórico e resolução de pendência. O número cresce com os itens, limitado a 20 por comando. Não foi introduzida infraestrutura adicional. O total inclui BEGIN/contexto/COMMIT; consultas internas dos triggers não entram nessa contagem. O plano do mapa registrou execução de 0,414 ms no ensaio.

Essas medições não representam SLA, diversidade de episódios/produtos, rede, concorrência hospitalar ou carga máxima de 20 itens. A serialização por episódio e o orçamento SQL continuam registrados para avaliação futura.

## Limites e continuidade

O módulo não calcula dose, escolhe tratamento, infere concentração, gera programação por frequência ou interpreta material previsto como material efetivamente usado. Autoria DEV e confirmação explícita não substituem os requisitos operacionais de identidade profissional e assinatura. Retificação não troca versão/programação nem anula um ato sem substituto; esses fluxos permanecem pendentes.

Alta hospitalar e programação futura continuam fatos separados. Nova execução após o limite hospitalar é recusada neste recorte; fato anterior pode ser registrado tardiamente. Alta retroativa mantém os fatos e abre revisão quando há conflito. Regras para exceção assistencial e continuidade domiciliar exigem validação da equipe.

Conciliação física não transforma custo nulo em zero. Uso declarado com validade pendente/incompatível pode ser registrado com alerta para revisão; isso não recomenda ou autoriza utilizar tal material. Pendência de material requer consumo identificado ou retificação para resolução; revisão de outras pendências registra decisão e motivo sem corrigir valores por inferência.

Um consumo ativo por execução, integralmente confirmado, admite até 20 posições. Conciliação parcelada, novos materiais posteriores e correção parcial de custo/quantidade precisam de fluxo futuro; o recorte atual usa estorno integral e novo consumo. Responsável, prazo e escalonamento da fila clínica também permanecem em aberto.

Não houve acesso a SimplesVet, dados reais, produção ou serviços pagos. Nenhuma outra pasta ou branch do HVB foi alterada; Terminal e site continuam separados. O próximo marco é M4, com modelo de diária configurável; regras reais de cobertura e cobrança continuam pendentes e não foram ativadas.

Documentação complementar: [pendências cumulativas](PENDENCIAS-HVB.md), [dicionário M3](DADOS-M3.md), [ADR 0004](adr/0004-clinica-consumo.md) e [OpenAPI](../openapi/hvb-sistema.json).
