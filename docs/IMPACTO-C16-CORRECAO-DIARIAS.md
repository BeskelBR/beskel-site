# Auditoria de impacto C16 — Diárias

17/09/2026. Continuidade do inventário após C15. Alterações somente em SISTEMA/hvb-sistema-dev.

| Dependência encontrada | Tratamento implementado |
|---|---|
| Associação/período imutáveis e exclusão incluindo histórico | Revisões tipadas com sucessora opcional; guarda de intervalo vigente no banco sob trava do episódio |
| Períodos dependentes da associação | Associação não pode ser revisada enquanto houver período vigente; tratar filhos explicitamente |
| Reserva e uso compartilhado de limite | Reserva ativa bloqueia revisão, mesmo que vencida até expiração explícita; uso antigo não é transferido |
| Avaliação/alocação de cobertura | Reversão prévia explícita; valores e decisões antigos preservados; reavaliação na sucessora é outro comando |
| Documento financeiro da diária ou de cobertura | Item ativo, inclusive de valor zero, bloqueia revisão; compensação financeira permanece independente |
| Origem antiga após correção | necessita_revisao se propaga às regras de cobertura e projeções financeiras existentes |
| Omissão comercial de diária | Barreira histórica preservada; cancelamento não transforma eventos automaticamente em serviços avulsos |
| Classificação, alta e fuso | Guardas M4/C15 mantidas e aplicadas à sucessora; classificação original não é retificada neste recorte |
| Contratos e autorização | Quatro POST e dois GET novos, dois GET acrescidos de situação/vínculos, uma permissão; nenhuma operação removida |
| Terminal V2 | Não requer alteração; contrato C14 preservado |

As migrations 001–068 foram preservadas; 069–070 aplicadas no DEV e TEST com hashes verificados. Nenhuma reescrita de valores de diárias, cobranças ou estoque. A evidência de concorrência inclui INSERT SQL pelo papel da aplicação, além das rotas, para conferir a substituição da exclusão temporal.

A falta anterior combinava associação, período e classificação. Associação/período foram resolvidos no recorte; classificação e automações retroativas continuam explicitamente pendentes, sem baixar a linha inteira como concluída. Ver [histórico de pendências C16](PENDENCIAS-RESOLVIDAS-C16.md).
