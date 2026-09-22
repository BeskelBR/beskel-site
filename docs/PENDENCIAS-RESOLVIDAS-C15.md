# Pendência técnica retirada da lista ativa em C15

17/09/2026. Item anterior da continuação M3: “Retificação de executor, versão ou programação incorretos e anulação de ato registrado por engano — PENDENTE; retificação atual preserva versão/programação e exige estornar consumo ativo antes”.

Resolvido no recorte definido: correção de executor/versão/programação por execução sucessora no mesmo episódio e anulação sem sucessora, com histórico e autoria. O requisito de estornar consumo ativo continua como proteção, não falta de implementação. Evidências: tests/clinical-corrections.test.ts, checks-c15-focused.json, ADR 0025 e RELATORIO-C15.md.

Permanecem ativos como itens específicos: transferência entre pacientes/episódios, atribuição a executor inativo, restauração de anulação, assinatura/alçadas, revisão de efeitos derivados e invalidação externa de protocolo sem sucessora. Não foram encerradas pendências de outros módulos por inferência.
