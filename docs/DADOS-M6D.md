# Dicionário M6D — Agenda

Migrations 034–035. Oito tabelas e três views novas; total acumulado: 130 tabelas e 37 views. Todas as tabelas novas têm organização, unidade, autor, comando, motivo e instante de registro. FKs tipadas, RLS forçada por organização, escopo de unidade na API e registros imutáveis.

| Entidade | Conteúdo e invariantes |
|---|---|
| `equipe_agenda` | Identidade e nome da equipe; membros ainda pendentes |
| `recurso_agenda` | Tipo profissional/equipe/sala/institucional e FK correspondente; unicidade do vínculo por unidade |
| `disponibilidade_agenda` | Recurso, tipo disponível/bloqueio, início e fim; duração positiva até 366 dias |
| `revogacao_disponibilidade_agenda` | Uma revogação por disponibilidade/bloqueio, sem apagar o intervalo original |
| `agendamento` | Paciente, responsável, tipo e referência UUID única por organização/unidade |
| `agendamento_versao` | Versão consecutiva, predecessor, horário de até 24 horas e observação; exige alocação atômica |
| `agendamento_recurso` | Versão exata e recurso da mesma unidade; não duplica recurso nem aceita comando diferente da versão |
| `transicao_agendamento` | Versão exata, sequência, estado anterior/novo e instante ocorrido; autor humano identificado |
| `agendamento_versao_consulta` | Histórico com situação, flag atual e necessidade de revisão calculadas |
| `agenda_mapa_consulta` | Somente versões atuais; estados terminais continuam consultáveis |
| `disponibilidade_agenda_consulta` | Disponibilidade com flag de revogação |

API sob `/v1/agenda`: sete POST (`equipes`, `recursos`, `disponibilidades`, `revogacoes`, `agendamentos`, `versoes`, `transicoes`) e nove GET (os mesmos caminhos, mais `alocacoes` e `mapa`). Total acumulado: 261 operações em 159 caminhos. Criar agendamento retorna também `agendamento_versao_id`.

Permissões: `agenda:ler`, `agenda:configurar`, `agenda:disponibilidade`, `agenda:agendar`, `agenda:reprogramar`, `agenda:transicionar`. Escritas exigem chave de idempotência, confirmação humana e `simulacao=true`. Nenhum papel real é concedido automaticamente; seed amplia apenas o administrador da organização sintética original.

Todos os instantes exigem fuso. Mapa usa interseção `[inicio,fim)` de até sete dias, com paginação UUID; não pressupõe horário de verão ou fuso hospitalar aprovado. Ver [ADR 0010](adr/0010-agenda.md) e [relatório](RELATORIO-M6D.md).
