# ADR 0004 — Execução confirmada e consumo identificado

Data: 13/09/2026. Implementado no ambiente DEV sintético; regras clínicas e operacionais continuam pendentes de validação humana.

## Decisão

Manter o monólito modular, PostgreSQL, SQL explícito e contratos derivados dos schemas. Não adicionar dependências. Separar prescrição, ordem lógica, versão da ordem, programação, execução e consumo. Uma referência UUID do fato é distinta da chave idempotente de transporte. A mesma chave/corpo repete o resultado; o mesmo evento com outra chave gera conflito. Clientes futuros devem persistir ambas as identidades antes do envio.

A API exige confirmação booleana explícita para execução, declaração de assinatura de prescrição e aprovação de material previsto. Strings como `"true"` não são aceitas por coerção. A autenticação identifica o autor; a confirmação não comprova por si só um ato assistencial no mundo real nem substitui assinatura operacional aprovada. Seeds e benchmarks declaram fatos exclusivamente simulados.

Ordens evoluem por versões consecutivas imutáveis. `versao_esperada` impede atualização concorrente silenciosa. A versão nova precisa começar depois da anterior e não pode invalidar retroativamente uma execução já registrada. Programações antigas mantêm sua versão e recebem pendência de revisão quando afetadas. Sobreposição potencial do mesmo item gera alerta, sem excluir a ordem ou escolher tratamento.

Execução pode ser sob demanda, com motivo, ou referenciar uma programação. Parciais e conclusão são declaradas; o servidor impede uma segunda conclusão ativa da mesma programação. Não calcula adequação da dose ou soma clínica esperada. A retificação é outro fato que referencia o original, na mesma versão/programação. Exige estornar antes qualquer consumo ativo da execução original. Alterar autoria/contexto ou anular um registro sem fato substituto requer fluxo futuro.

O horário ocorrido é comparado à vigência da versão e aos limites do episódio, independentemente do horário do registro. No recorte hospitalar DEV, aceita-se documentação tardia de fato anterior à alta/saída; nova execução posterior ao limite é recusada. Alta retroativa não apaga nem impede o registro da própria alta: gera revisão de fatos conflitantes e programações abertas. Destino das programações, cuidados domiciliares e exceções continuam decisões humanas.

## Conciliação física

Execução declarada com material pendente é confirmada sem exigir lote e sem debitar estoque. Cria pendência persistente, também exigida por constraint no commit. `material_previsto` é uma associação versionada de referência; não escolhe o lote e não produz consumo automático.

O consumo é um comando separado, com episódio, execução opcional, instante ocorrido e até 20 posições distintas explicitamente confirmadas. Cada posição determina lote, recipiente, custódia e unidade hospitalar. Material do tutor só pode ser alocado ao paciente/episódio compatível. Consumo vinculado mantém o horário da execução; avulso exige finalidade e motivo. Um único consumo ativo concilia integralmente uma execução; acréscimos requerem estorno e novo registro neste recorte.

Reutilizar os lançamentos balanceados de M2 com contrapartida `consumido`. Retirada anterior continua sendo transferência: o consumo baixa do destino indicado. Quantidade e custo são exatos, o material do tutor não recebe custo hospitalar, e custo desconhecido não é zero. Uso já declarado de material com validade problemática é conciliado fisicamente com pendência de revisão, preservando o fato; o fluxo não recomenda nem autoriza esse uso.

Estorno é integral, vinculado e único. Todos os lançamentos precisam ser compensados na mesma transação, sem permitir o atalho de reverter um único item pela rota genérica de estoque. A execução continua registrada e uma nova pendência de material é aberta. Revisar pendência não altera validade, custo ou fato original. Pendência de material só pode ser resolvida por consumo identificado ou retificação correspondente.

## Concorrência e custo

Serializar escrita clínica com alta pela linha do episódio; versões também usam lock por ordem. Programação protege conclusão, e posições físicas são bloqueadas em ordem determinística, uma vez para todo o lote de consumo. O lock do episódio é uma opção conservadora do DEV: pode limitar múltiplos operadores no mesmo episódio, devendo ser medido com carga representativa. Não há integração externa dentro da transação.

Auditoria, outbox e resultado permanecem atômicos ao comando. A conciliação contém FKs de comando/cabeçalho/item/livro. RLS e permissões clínicas específicas restringem organização e unidade; consumo também exige movimentação de estoque, e estorno exige reversão física. Os campos decimais aninhados são validados antes da coerção do framework.

O benchmark mostrou 7 statements totais/4 funcionais para mapa, 13/10 para execução, 18/15 para consumo avulso de um item e 19/16 quando vinculado à execução. Foi removida uma consulta de lock repetida por item. O restante foi inspecionado: inclui identidade/permissões, lock de episódio e posições, cabeçalho, validação de metadados, transação/livro, itens, qualidade e resolução da pendência. A expansão por item é limitada a 20; não foi substituída por infraestrutura adicional. A contagem é do SQL enviado pelo cliente e não inclui comandos internos dos triggers.

## Validação

52 testes passaram, sendo 17 novos cenários clínicos. Foram verificados concorrência, repetição, reversão, retificação, histórico, custódia, falha atômica, precisão de custo em 12 casas, temporalidade, isolamento, privilégios e limites das listas. O teste antigo M2 passou a verificar zero consumos na organização após retirada, em vez de exigir que a tabela de consumo não existisse.

Mil programações foram geradas por comandos. O mapa foi analisado com `EXPLAIN (ANALYZE, BUFFERS)`, execução/reenvio foram exercitados por HTTP real e a reconciliação encontrou zero divergências de saldo. A sequência 001–013 passou em TEST vazio. Evidências e limitações constam no relatório M3; nenhuma medição caracteriza SLA.
