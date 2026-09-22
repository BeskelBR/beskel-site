# ADR 0023 — Correções com histórico e acesso revogável

Estado: proposta implementada em DEV, C13, 16/09/2026. Somente SISTEMA/hvb-sistema-dev e dados fictícios.

## Cadastros

Revisões preservam os IDs referenciados por episódios, documentos, dispositivos e demais módulos. Cada revisão guarda antes/depois, autor, motivo, comando, instante, número e predecessora. O cadastro original funciona como estado atual para os consumidores existentes. Correção e histórico são atômicos; falha posterior desfaz ambos. Versão esperada e trava por cadastro impedem duas sucessoras concorrentes.

A aplicação não recebe UPDATE geral nos campos cadastrais. Um trigger SECURITY DEFINER com search_path fixo executa a atualização restrita, usando mapa estático de tabelas/campos, contexto de organização, comando aberto, autor e permissão vigentes. FKs específicas impedem referência polimórfica sem integridade. A função não pode ser chamada diretamente pelo papel da API. Campos fora do contrato não são alterados. O estado anterior é capturado sob trava de linha e comparado à revisão precedente, impedindo continuação silenciosa se houver divergência causada por manutenção externa.

Campos abrangidos: nome/espécie/estado vital do paciente, nome do responsável, nome/login do usuário, nome da unidade/dispositivo e nome/capacidade do local. Alterar login mantém usuário e credenciais opacas existentes; não é recuperação de autenticação. Fuso, unidade de pertencimento, hierarquia/tipo do local, identidade e fatos encerrados permanecem fora desse comando. Corrigir espécie ou estado vital não reescreve evoluções, laudos, atos clínicos ou textos já emitidos; revisão dos efeitos de domínio continua explícita e futura quando necessária.

## Capacidade

Mudança de capacidade usa trava exclusiva por local; ocupações usam trava compartilhada dessa mesma chave, além das travas anteriores de episódio/vaga. Redução é recusada se alguma ocupação ainda aberta ou com fim futuro usar número de vaga superior à nova capacidade. Usa-se a maior vaga, não apenas a quantidade de pacientes. Após encerramento, o registro histórico conserva vaga e intervalo anteriores. A nova capacidade passa a governar as novas ocupações; não há calendário de capacidades futuras ou recomputação retroativa automática.

## Atribuições de papel

Concessão original permanece imutável pela API. Uma sequência de revisões alterna ativo=false (revogação) e ativo=true (restauração); estado inicial é ativo=true, versão zero. Restaurar é uma decisão explícita, sem criar outra atribuição com o mesmo usuário/papel/unidade. Revogar uma atribuição não desativa usuário nem apaga token, e não cancela outros papéis válidos.

Autorização consulta a view de atribuições atuais e adquire trava compartilhada por organização/usuário até o fim da transação. Alterar a atribuição exige trava exclusiva do usuário afetado. Assim, uma operação já autorizada termina antes da revogação; as seguintes observam o estado novo. Deadlocks entre administrações concorrentes usam o retry limitado da fundação. Consultas de identidade, como /me, continuam possíveis com credencial válida mesmo sem permissões de domínio.

Administração exige atribuição global de acesso:administrar. A API não presume número mínimo de administradores nem alçada clínica real. Revogação do último administrador, recuperação administrativa e segregação operacional precisam de procedimento homologado antes de uso real; a demonstração não altera os papéis originais de administração ou operação. Cadastro de novos papéis e atribuições mantém as permissões anteriores.

## Limites

Sem fusão/deduplicação de pessoas/pacientes, transferência de fatos entre IDs, correção de episódio encerrado, troca de hierarquia/unidade de local, alteração de permissões dentro de um papel, autenticação operacional/MFA ou dados reais. Essas capacidades não são declaradas prontas por esta entrega. A história é evidência técnica de correção e não certifica assinatura ou aprovação hospitalar.
