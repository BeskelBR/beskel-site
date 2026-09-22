# Pendências retiradas da lista ativa em C14

16/09/2026. Revisão limitada aos itens atingidos pela mudança V2, conforme pedido do usuário. O histórico abaixo conserva as descrições anteriores; outras pendências não foram encerradas por suposição.

| Registro anterior | Resolução verificada | Evidência |
|---|---|---|
| Contratos mínimos para retomar Terminal — PENDENTE após M2 | Contrato backend V2 implementado em SISTEMA; nenhuma alteração na branch do Terminal | DADOS-C14, OpenAPI, testes de sessões/ordens/barreiras |
| Terminal/NFC — FALTA FUNCIONAL em SISTEMA para C5 | Fundação simulada entregue em C5 e fronteira atualizada em C14. A falta genérica de contrato backend está resolvida; NFC físico permanece pendência própria | ADR 0015 histórica e ADR 0024 vigente; testes legados e V2 |
| Retirada e execução — movimento físico com confirmação pelo Terminal | Requisito substituído: novas retiradas pelo Terminal bloqueadas; acesso não cria estoque/clínica/cobrança. Homologação do picking passa ao Mobile e continua ativa como item específico | Trigger 066, endpoint deprecated, teste de ausência de efeitos |

Não foram encerrados hardware, biometria, login operacional, contingência, fulfillment/Mobile, suporte, retenção, homologação ou publicação. Atualizações parciais constam em PENDENCIAS-HVB.md. A aprovação de um recorte de testes não substitui a verificação geral posterior.
