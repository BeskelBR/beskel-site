# ADR 0006 — Comercial e financeiro em simulação

Data: 13/09/2026. Recorte M5 implementado e validado em simulação, autorizado pela continuidade do usuário.

Manter catálogo e preço versionados, conta por episódio, evento com origem tipada, avaliação comercial, responsabilidade por pagador e título separados. A conta não bloqueia alta. Uma origem não gera cobrança duplicada. Valor zero continua documentado, sem responsabilidade ou título fictício. Cobertura M4 ambígua ou alterada permanece pendente.

O recorte usa BRL e valores exatos em centavos, sem arredondamento silencioso. Quantidade mantém seis casas; o produto quantidade/preço precisa resultar em centavos exatos. Preços são informados e versionados, sem impostos, juros ou regra fiscal inferida. Todos os registros são fictícios e comandos comerciais/financeiros exigem confirmação de simulação.

Recebimento identificado não é liquidação: alocações explícitas limitam o valor disponível de recebimento e título. Adiantamento pode originar crédito do mesmo pagador, sem duplicar dinheiro. Crédito aplicado liquida título sem novo recebimento. Reversões preservam origem e exigem desfazer dependências antes.

Caixa registra sessão, abertura e conferência explícitas; dinheiro físico é distinto de cartão e transferência. Parcelas da adquirente preservam bruto, taxa e líquido esperado. Depósito informado e sua alocação são separados do recebimento do tutor; conciliação humana exige evidência. Nenhum banco, adquirente, pagamento ou canal externo será acionado.

Concorrência financeira inicialmente serializada por unidade hospitalar, com advisory lock transacional no banco, transações curtas, idempotência e auditoria/outbox existentes. A trava não concede atualização ao cadastro da unidade. É uma limitação mensurável do DEV, a revisar com carga representativa. FKs compostas, RLS e validação SQL protegem contexto e limites inclusive fora da API. Não há transferência financeira entre unidades no recorte.

Regras operacionais, estornos de cartão/chargeback, cancelamento após conciliação, rateio de taxas, despesas, comissões e obrigações fiscais permanecem pendentes; não serão inferidas do legado.

Foram aprovados 19 testes novos e 69 regressões, inclusive em banco vazio. O benchmark mediu mil recebimentos fictícios, com saldos preservados. A linhagem clínica e a substituição de consumo vinculado à mesma execução impedem emitir novo valor enquanto houver item anterior ativo. Reavaliação e reversão comercial não alteram estoque ou fato assistencial. Evidências e limites estão no [relatório M5](../RELATORIO-M5.md).
