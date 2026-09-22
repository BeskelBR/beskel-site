# ADR 0022 — Vínculo explícito e auditoria minimizada

Estado: proposta implementada em DEV, C12, 16/09/2026. Somente SISTEMA/hvb-sistema-dev, dados fictícios.

## Vínculo agenda–episódio

Relacionar atendimento planejado e episódio é um comando humano explícito. A versão da agenda deve ser atual e ter chegada ou conclusão registradas; episódio e agendamento devem apontar para o mesmo paciente/unidade. A versão esperada do episódio detecta alteração concorrente. Episódio encerrado pode ser relacionado retrospectivamente: o vínculo descreve uma correlação, não outro ato clínico nem mudança de data. As datas planejadas e reais permanecem distintas.

O banco trava o episódio para leitura e a agenda pela trava existente da unidade. Um agendamento admite apenas um vínculo não revogado, mesmo que sua situação mude posteriormente. Vários agendamentos podem se relacionar ao mesmo episódio. Correção exige revogação com motivo antes de novo vínculo; todas as versões permanecem acessíveis. Revogar não cancela episódio ou agenda.

Cancelamento posterior inativa o vínculo em consulta e sinaliza necessita_revisao. Nenhuma correção de origem transfere ou apaga fatos automaticamente. A configuração de permissões DEV não define alçadas hospitalares de vinculação/revogação; estas serão homologadas depois.

## Auditoria de consultas

Os dois pontos de autenticação, interno e portal, usam a mesma transação auditada para GET/HEAD. Após obter identidade válida, consulta e inserção de trilha acontecem na mesma transação. Recusas de domínio 4xx são capturadas sob savepoint, a consulta é desfeita e a recusa é registrada antes de devolver o erro. Falha na inserção não libera o resultado. Retry de deadlock/serialização segue o limite transacional existente e não duplica eventos confirmados.

Cada evento registra organização, identidade e credencial tipadas, unidade solicitada quando pertence à organização, rota parametrizada, método, correlação gerada no servidor e IDs solicitados. Parâmetros aceitam somente chaves id/*_id com valores UUID; o banco confere esse formato e a relação da credencial com a identidade. Termos de busca, narrativa, anexos, tokens, URL bruta, IP e user-agent não entram na trilha. Para listagens, registram-se filtros identificadores, não uma cópia dos registros retornados.

O resultado 200 descreve execução da consulta antes da serialização/resposta. Não é recibo de entrega, assinatura, prova de leitura perceptiva ou aceite; a consulta do portal não marca mensagem como lida. HEAD também gera evento. Consultar a própria auditoria gera exatamente outro evento, sem recursão.

A consulta administrativa exige permissão global da organização, janela de até 31 dias e paginação. RLS isola organizações. Não há rota para apagar ou editar eventos; retenção, expurgo autorizado, exportação, particionamento e acesso de suporte ficam pendentes. Uma janela encerrada evita incluir novas leituras da própria auditoria durante paginação; consultas com fim futuro não oferecem snapshot entre requisições.

## Limites explícitos

Sem identidade conhecida, requisições recusadas pela autenticação inicial não geram evento atribuído. Validação HTTP anterior à autenticação, rotas inexistentes, health/readiness e erros de infraestrutura não são eventos de leitura de domínio; o log HTTP minimizado existente cobre método/rota/status/correlação, sem substituir monitoramento operacional futuro. Falhas de serialização após a transação podem ocorrer depois do registro de consulta bem-sucedida. Retenção e trilha de tentativas anônimas precisam ser homologadas na etapa de segurança operacional.

Vínculos diretos agenda–exame/protocolo/executor, correção de estados terminais e demais refinamentos funcionais previamente registrados continuam no inventário de pendências. Não foram inferidos a partir do vínculo agenda–episódio nem transformados em ações clínicas automáticas.
