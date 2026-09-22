# Pendências afetadas e resolvidas — C17

22/09/2026. Histórico; não substitui a lista ativa nem encerra itens não relacionados.

Trecho anterior M5: “um vínculo por par, reabertura do mesmo par após reversão e correção de depósito/extrato exigem fluxo futuro”.

**Resolvido em DEV:** correção de depósito/extrato por sucessora e cancelamento sem sucessora; revisão exige compensações prévias explícitas, mantém referência/histórico e preserva recebimento/parcelas. Conciliação e alocação de depósito podem ser refeitas por vínculo novo ao mesmo par, com predecessor explícito e limite revalidado. Referências históricas não ficam disponíveis para duplicação por outra cadeia.

Evidências: migrations 071–072, [56 testes do recorte](evidencias/checks-c17-focused.json), [integridade](evidencias/c17-integridade.json), seed executado duas vezes e [relatório C17](RELATORIO-C17.md).

**Mantido na lista ativa:** dados manuais de simulação, integração/importação bancária, comprovação e retenção de evidências, políticas/alçadas, restauração e transferência entre unidades, estorno real/chargeback/antecipação e correção de parcelas. A parte resolvida foi retirada da descrição ativa; não foi baixada toda a linha como concluída.
