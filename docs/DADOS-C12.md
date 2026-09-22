# Dicionário C12 — Vínculos e auditoria de consultas

Versão 0.21.0, migrations 061–062. Três tabelas, uma view, duas permissões e cinco operações novas. Totais conferidos: 182 tabelas, 69 views, 117 permissões e 370 operações em 224 caminhos.

| Entidade | Conteúdo e invariantes |
|---|---|
| vinculo_agendamento_episodio | Versão exata do agendamento, episódio e versão esperada; mesmo paciente/unidade; agenda atual em chegou/concluido; um vínculo não revogado por agendamento |
| revogacao_vinculo_agendamento | Vínculo original, autor, motivo e comando; uma revogação por vínculo |
| vinculo_agendamento_consulta | Contexto do paciente, agenda, episódio, atual, revogada, vigente e necessita_revisao |
| leitura_auditada | Organização, unidade conhecida opcional, usuário/credencial interna OU conta/credencial do portal, correlação única, rota parametrizada, método, resultado da consulta, IDs solicitados e instante |

Todas têm RLS e proteção contra alteração/exclusão. Vínculos seguem comandos idempotentes, auditoria de comandos e outbox existentes. Leitura gera um evento por requisição GET/HEAD identificada, sem comando de negócio e sem marcar mensagem como lida. A migration acrescenta unicidade organização/ID à credencial do portal para a FK composta da auditoria.

## Contratos sob /v1

| Método | Caminho | Permissão |
|---|---|---|
| POST | /agenda/vinculos-episodios | agenda:vincular_episodio + episodios:ler na unidade |
| POST | /agenda/revogacoes-vinculos | agenda:vincular_episodio + episodios:ler na unidade |
| GET | /agenda/vinculos-episodios | agenda:vincular_episodio na unidade |
| GET | /agenda/revogacoes-vinculos | agenda:vincular_episodio na unidade |
| GET | /auditoria/leituras | auditoria:leituras com atribuição global na organização |

Vincular recebe agendamento_versao_id, episodio_id e episodio_versao_esperada; revogar recebe vinculo_id. Ambos exigem unidade, motivo, simulação, confirmação humana e chave idempotente. Não criam episódio, execução ou cobrança. Vários agendamentos podem apontar para um episódio; um agendamento precisa ter o vínculo revogado antes de receber outro.

Consultas de vínculos usam unidade, cursor UUID e filtros contextuais publicados no OpenAPI. Auditoria exige inicio/fim com intervalo positivo de até 31 dias, limite 1–100, cursor UUID e filtros opcionais por unidade, usuário, conta do portal ou correlação. O fim é exclusivo. Resposta omite IDs de credenciais e contém apenas metadados. Papel restrito à unidade não autoriza consulta de auditoria global, mesmo com filtro de unidade.

Os contratos anteriores permanecem iguais. Leituras autenticadas agora dependem também da persistência da auditoria: falha de gravação retém o resultado e retorna 503. A trilha registra a consulta realizada ou recusada após identificação; não comprova que o cliente recebeu, leu ou aceitou o conteúdo. Ver [ADR](adr/0022-vinculos-auditoria.md), [relatório](RELATORIO-C12.md) e [OpenAPI](../openapi/hvb-sistema.json).
