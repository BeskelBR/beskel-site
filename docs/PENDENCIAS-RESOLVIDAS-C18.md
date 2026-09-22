# Pendências afetadas resolvidas — C18 Terminal v1

Retiradas da descrição ativa somente as faltas técnicas comprovadamente resolvidas pelo delta N1 de 22/09/2026. A origem C14 permanece histórica; esta baixa não encerra módulos ou decisões não relacionados.

| Descrição anterior | Parte resolvida e evidência | Parte que continua ativa |
|---|---|---|
| Mobile e fulfillment: sem rota gravável ou escrituração | Backend canônico de contexto, picking, parcial/indisponível, origem por OR/ajuste e transferência M2; testes de fulfillment e separação clínica | Clientes, operação real, correção após saída e custódia do tutor na sala |
| Sensibilidade declarada na ordem DEV; classificação autoritativa futura | Política de catálogo própria; ajustes não aceitam flags/lote/local; RBAC do funcionário; armário sob demanda sem segunda autenticação | Classificação hospitalar real, revisão de políticas e homologação |
| Dispositivo biométrico integrado ao terminal | ACCESS/BIOMETRIC/PICKING/CONTROLLER distintos; credencial provisionada por dispositivo, sem confiar apenas em ID | Dispositivos e atestação reais, ciclo de provisionamento/rotação, retenção e avaliação de PAD |
| Concorrência na barreira e timeout não tratados | Sala exclusiva por índice/lock; pré-entrada expira; presença preserva sessão/reserva com alerta; falha de confirmação mantém DOOR_CLOSED | Hardware, sensores, emergência, heartbeat do controlador e recuperação supervisionada |
| Continuidade sem reserva/fulfillment | Reservas M2 protegidas, retomada de OR após expiração pré-entrada, confirmação idempotente e distribuição por origem | Cancelamento/abandono em presença, encerramento do episódio durante retirada e correções após encerramento |
| Efetivação parcial/lease da reserva sem mecanismo no Terminal | Tarefa parcial usa quantidade de uma oferta derivada do servidor; confirmação substitui reserva vencida sob lock sem reescrever o prazo | Expiração automática e efetivação parcial genérica fora do Terminal continuam no M2 |

Evidências: [verificação com 78 testes](evidencias/checks-c18-focused.json), [integridade](evidencias/c18-integridade.json), [ADR 0028](adr/0028-terminal-v1-canonico.md). A verificação usa dados sintéticos, não valida hardware nem política hospitalar.
