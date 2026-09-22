# Impacto C15 — Correção clínica

17/09/2026. Continuidade autorizada do inventário após C14, exclusivamente SISTEMA/hvb-sistema-dev.

A retificação atual cria execução sucessora na mesma versão/programação e usa o usuário autenticado como executor. Não permite corrigir contexto nem anular sem fabricar sucessora. Consumo ativo precisa ser estornado explicitamente antes. O mesmo bloqueio será preservado.

Delta: fato imutável de revisão (correção de contexto ou anulação), permissão própria por operação, mesma organização/unidade/episódio, motivo e confirmação explícita DEV. Recontextualização cria sucessora da execução existente, com executor declarado separado do autor da correção. Anulação não cria execução fictícia. Não transferir entre pacientes/episódios neste lote.

As dependências auditadas usam ausência de sucessora para interpretar vigência: programação, consumo, pendência material, cobertura/diária, evento cobrável, coleta/resultado, aplicação preventiva e prontuário. Nova função de vigência incluirá anulação; projeções e guardas de novos vínculos serão adaptados por migration aditiva. Histórico, valores, títulos, resultados liberados e estoque não serão reescritos. Fontes invalidadas exigem revisão pelos comandos próprios.

Migrations 067 (modelo/projeções) e 068 (integridade). Reaproveitar comando, auditoria/outbox, RLS, episódios e linhagem existentes. Testar clínica e dependências atingidas; não rodar suíte geral nem publicar. Pendências operacionais/clínicas continuam posteriores, sem converter regra DEV em política hospitalar.
