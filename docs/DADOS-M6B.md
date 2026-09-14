# Dicionário M6B — Protocolos preventivos

Migrations 026–029, em complemento a M1–M6A: 11 tabelas e quatro views novas. Total de 111 tabelas e 31 views no schema `hvb`. Todas as tabelas deste recorte têm organização, unidade, UUID, comando, autor, motivo e instante de registro; são imutáveis, com RLS forçada e FKs compostas.

| Tabela | Finalidade e identidade |
|---|---|
| `protocolo_catalogo` | Código por unidade e nome do protocolo |
| `protocolo_versao` | Versão consecutiva, descrição e espécie |
| `etapa_protocolo` | Item clínico exato, ordem, deslocamento, recorrência e intervalo; atômica com versão |
| `aprovacao_protocolo` | Aprovação única por versão, somente simulação |
| `protocolo_paciente` | Adesão do paciente à versão aprovada, data inicial e referência persistente |
| `encerramento_protocolo` | Encerramento único da adesão, instante e sucessor opcional identificado |
| `ocorrencia_preventiva` | Única por adesão/etapa/sequência; data planejada validada contra regra |
| `aplicacao_preventiva` | Fato ocorrido; origem, evidência, profissional externo ou execução interna, declaração de lote/fabricante e correção vinculada |
| `vinculo_consumo_preventivo` | Associação única do item de consumo à aplicação interna correspondente |
| `revisao_preventiva` | Revisão de atraso, única por ocorrência, com instante observado e descrição |
| `resolucao_revisao_preventiva` | Resolução humana única, sem produzir aplicação ou consumo |

Na origem interna, `aplicacao_preventiva.id = execucao_id`; a aplicação estende o mesmo fato clínico. Na externa, recebe UUID próprio, profissional informado e evidência declarada. `autor_id` identifica quem registrou no sistema; não transforma o profissional externo em usuário local. Referências persistentes e chaves idempotentes têm finalidades distintas e devem ser preservadas em retries.

`dia_preventivo` guarda texto ISO de data civil válida entre 2020-01-01 e 2100-12-31, sem conversão implícita para UTC. Instantes de aplicação, observação e encerramento são `timestamptz` finitos. A consulta de atraso usa o fuso da unidade; programação no dia atual ainda não é atraso.

Cada versão admite até 50 etapas; cada etapa admite sequências 1–1.000. Recorrência única permite apenas a sequência 1 e intervalo zero; recorrências em dias/meses exigem intervalo positivo. O banco valida datas e horizonte antes de aceitar o planejamento. Não há inferência de adequação clínica dos intervalos.

| View | Campos derivados principais |
|---|---|
| `aplicacao_preventiva_consulta` | `ativa` exclui aplicação substituída ou execução retificada; `material_revisao` sinaliza consumo estornado |
| `ocorrencia_preventiva_consulta` | Paciente e item; situação `realizada`, `revisao`, `encerrada`, `atrasada` ou `planejada` |
| `revisao_preventiva_consulta` | Situação da ocorrência e revisão `aberta`/`resolvida` separadas |
| `consumo_preventivo_consulta` | Consumo, posição, lote físico, fabricante, quantidade exata e estado de estorno |

Um fato realizado permanece visível após encerramento da adesão. Execução retificada sem aplicação sucessora deixa ocorrência em revisão. Texto do lote declarado e identificação do lote físico coexistem; não há conciliação por semelhança de nome/código.

As 11 listas têm paginação por UUID e limite máximo 100. Adesões, ocorrências, aplicações e revisões permitem filtro de paciente; demais filtros tipados constam no [OpenAPI](../openapi/hvb-sistema.json). Não há busca irrestrita de documentos ou dados de outra unidade.

Ver [ADR 0008](adr/0008-protocolos-preventivos.md), [relatório](RELATORIO-M6B.md) e [pendências](PENDENCIAS-HVB.md).
