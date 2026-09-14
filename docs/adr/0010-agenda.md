# ADR 0010 — Agenda com recursos e histórico

Data: 14/09/2026. Estado: proposta implementada em DEV, sujeita às decisões hospitalares pendentes.

O modelo do pacote distingue planejamento, escala, confirmação e execução. Um recurso institucional não representa um profissional, e registrar chegada não comprova execução clínica. Implementamos esse recorte sem mensagens, integrações ou atribuição automática de autoria assistencial.

## Decisão

- Recursos tipados: profissional aponta para usuário; equipe para equipe; sala para local; institucional pertence à unidade. Campos incompatíveis são rejeitados. Usuário profissional deve estar ativo para disponibilidade efetiva.
- Disponibilidades e bloqueios são intervalos explícitos imutáveis, com revogação separada. Um intervalo disponível deve cobrir todo o compromisso; bloqueio sobreposto prevalece. Não há união automática de intervalos adjacentes.
- Agendamento identifica paciente, responsável, tipo e referência de deduplicação. Cada versão registra horário, observação e de um a dez recursos distintos; criação completa é atômica. Intervalos usam início inclusivo e fim exclusivo.
- Reprogramação exige versão esperada e estado planejado/confirmado. Preserva versões e alocações anteriores; a nova versão começa planejada. Estados terminais exigem novo agendamento, enquanto reabertura permanece pendente.
- Trava transacional por organização/unidade serializa alterações de agenda. Conflitos consideram versões atuais planejadas, confirmadas ou com chegada registrada, para cada recurso. A trava simplifica consistência e limita vazão por unidade; capacidade e estratégia mais granular serão medidas antes de uso real.
- Transições têm autor, comando, motivo, sequência e instante ocorrido. Planejado admite confirmação, chegada, cancelamento e ausência; confirmado admite chegada, cancelamento e ausência; chegou admite conclusão ou cancelamento. Ausência exige fim planejado alcançado; conclusão exige chegada prévia e início alcançado. Instantes futuros e regressão temporal entre transições são recusados.
- Revogar disponibilidade ou bloquear recurso sinaliza `necessita_revisao`; não apaga nem libera reservas ativas. Confirmação e chegada são impedidas enquanto os recursos não estiverem disponíveis. Reprogramação, cancelamento ou nova disponibilidade permitem tratamento explícito.
- Mapa apresenta versões atuais, inclusive terminais para histórico operacional, com interseção de intervalo de até sete dias, filtros de paciente/recurso e paginação por UUID. Limite máximo de cem registros; ordenação cronológica visual fica para a interface.

## Limites

Não há escala trabalhista, composição de equipes, habilitação profissional, capacidade maior que um por recurso, recorrência de agenda ou checagem de conflito do mesmo paciente em recursos distintos. O conflito atual é por recurso dentro da unidade: profissionais com agendas em várias unidades exigem política e validação adicionais. Local tipado como sala usa FK de local, sem homologação do tipo físico.

Horários passados podem ser declarados em DEV; o momento de registro permanece separado. Isso não prova que o planejamento existia naquela data. `necessita_revisao` é calculado pela disponibilidade atual, inclusive nas versões históricas, e não é um snapshot da disponibilidade original.

Responsável informado não concede acesso ao prontuário nem comprova representação. Confirmação, chegada e conclusão são declarações operacionais simuladas, sem criar episódio, ocupação, execução, consumo, diária, cobrança ou mensagem. A identidade do recurso nunca substitui o usuário autor de fatos clínicos.

Referências: modelo 12 do pacote, seção Agenda e complemento de recursos; backlog 07/M6; [pendências](../PENDENCIAS-HVB.md).
