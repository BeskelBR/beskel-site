# Auditoria de impacto C14 — Terminal de Acesso V2

Auditoria anterior à implementação, 16/09/2026, branch hvb-sistema-dev. Requisito: anexo de adequação V2 recebido nesta conversa. Delta incorporado ao ciclo C14; próximo refinamento clínico temporariamente suspenso.

| Área | Decisão baseada no código atual |
|---|---|
| A — válido | Usuários, credenciais, dispositivos, RBAC por unidade, RLS, command, hash/idempotência, auditoria, outbox, estoque e episódios existentes são reutilizados. |
| B — legado | Etiquetas, leituras e retirada_terminal, migrations 047/048 e ADR 0015 permanecem como histórico. Etiqueta identifica contexto; não autentica pessoa. |
| C — descontinuar | POST /terminal/retiradas deixa de produzir estoque. Novos comandos recebem 409; retry de comando histórico já confirmado conserva o resultado original. Guard adicional impede novos INSERTs na tabela legada. |
| D — acrescentar | Ordem/itens/eventos, challenge/evidência, AuthSession, AccessSession/relação N ordens/eventos de barreira, permissões específicas. |
| E — contratos | Novos endpoints /retiradas/ordens e /terminal/acesso; legado deprecated. Adaptador confiável injetado no servidor, desabilitado por padrão; simulação DEV assinada, nunca face_match da UI. |
| F — migrations | 065 modelo e 066 integridade, aditivas. Nenhuma alteração histórica. Apenas 047/048 referenciam diretamente o modelo legado nas migrations auditadas. |
| G — testes | Substituir expectativa de nova retirada C5 por bloqueio; preservar leitura e regressões. Acrescentar recorte C14 com fluxo, negativos, expiração, RBAC, RLS, replay, concorrência e ausência de efeitos financeiros/clínicos/estoque. |
| H — regressões | Seed C5 antigo produz retirada e precisa adequação. Responses/listas genéricas precisam tipos e filtros novos. Consumidores antigos precisam migrar; dados e consultas históricas serão preservados. |

Implementar P0 e P1 deste delta: ordens ligadas a episódio/produto, acesso simulado com evidência verificada, entrada confirmada altera estado, contrato de fulfillment separado. P2/P3 ficam no registro de pendências: picking/Mobile, compensações, offline, política sensível, biometria, controlador e Edge. Não se declara RETIRADA_CONFIRMADA sem futuro fulfillment válido.

Ordens são criadas com itens imutáveis: corrigir rascunho significa cancelar/recriar nesta etapa. Sessões têm escopo fixo, múltiplas ordens e exclusão concorrente por ordem. Sensível exige permissão explícita e porta fechada após entrada. Sem adaptador DEV instalado no processo, autenticação/eventos simulados falham fechados. Nenhum controlador físico recebe autorização deste lote.
