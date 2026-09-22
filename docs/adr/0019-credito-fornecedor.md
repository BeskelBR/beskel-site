# ADR 0019 — Crédito comercial de fornecedor

Estado: proposta implementada em DEV, C9, 15/09/2026. Somente SISTEMA/hvb-sistema-dev e dados fictícios. Sem emissão fiscal, pagamento real, contato externo ou compensação inferida.

## Decisão

Crédito comercial é um registro explícito com fornecedor, documento/referência, origem declarada (devolução, abatimento ou outro), descrição, data e valor. Pode referenciar uma obrigação de origem do mesmo fornecedor/unidade; essa referência é proveniência, não cálculo automático de crédito nem prova de devolução física. Crédito declarado não reduz dívida até ser aplicado. Pode ser usado em outra obrigação do mesmo fornecedor e unidade.

A aplicação usa a própria liquidacao_fornecedor, com o mesmo ID e efeitos sobre o saldo da obrigação. A fonte passa a ser exatamente uma entre pagamento_id e credito_id, garantida no banco. A rota antiga de liquidação por pagamento mantém sua entrada obrigatória de pagamento; a nova rota aplicacoes-creditos exige crédito. Não existe pagamento bancário fictício, segunda baixa ou registro paralelo de aplicação somado novamente.

A liquidação por crédito pode ser alocada às parcelas C8 existentes pelo seu ID original. A parcela quitada e liquidado_sem_parcela passam a considerar tanto dinheiro declarado como crédito aplicado. Os limites de obrigação, disponibilidade do pagamento/crédito e parcela continuam explícitos e independentes. Origem documental não restringe a compensação àquela obrigação; não se permite compensar entre fornecedores ou unidades.

## Integridade, correção e reversão

Crédito e aplicação exigem data ocorrida; a aplicação não pode anteceder crédito ou obrigação. Valores positivos de centavos exatos. O mesmo documento original não pode gerar créditos duplicados para o mesmo fornecedor/unidade. Referências de operação são únicas na unidade e retries usam a mesma chave.

A trava de contas a pagar da unidade serializa aplicações, pagamentos, alocações e reversões. Pagamento e crédito concorrentes não ultrapassam o saldo da mesma dívida, e aplicações em dívidas diferentes não excedem o saldo de crédito.

A aplicação é revertida pela rota C4 de reversões, usando liquidacao_id. Isso recompõe crédito e dívida e inativa suas alocações de parcelas. Crédito não pode ser revertido enquanto tiver aplicações ativas. Correção documental exige crédito anterior revertido, mesma origem/fornecedor/unidade/documento e uma única sucessora; valores antigos permanecem consultáveis. Nova referência é obrigatória, sem transferência automática de aplicações.

RLS, FKs de unidade, comandos abertos, idempotência, autoria, motivo e auditoria/outbox seguem a fundação. Tabelas existentes não são regravadas; migrations novas ampliam a liquidação e preservam registros anteriores. A origem pode ser uma obrigação histórica revertida; ela não cancela automaticamente o crédito declarado, que tem ciclo próprio.

## Contratos e interpretação

Registrar/corrigir exige pagar:creditar; aplicar exige pagar:aplicar_credito; reverter crédito ou liquidação exige pagar:reverter. Leituras exigem pagar:ler. Nenhuma dessas ações movimenta estoque.

GET liquidacoes e liquidacoes-para-parcelas acrescentam credito_id e seu filtro. Para aplicações de crédito, pagamento_id é nulo; consumidores devem distinguir a fonte. As entradas antigas permanecem iguais. Consultas de histórico podem mostrar disponivel positivo em crédito revertido; o indicador revertido impede nova aplicação. Não interpretar esse saldo como crédito utilizável.

C9 também corrige quatro campos que eram serializados como texto: preco_atual, recebimento_revertido, obrigacao_revertida e revertida agora são booleanos. Essa correção de contrato deve ser considerada por clientes; os testes verificam o tipo nas respostas reais de aquisição e parcelas.

## Limites

Sem reconhecimento fiscal automático, emissão de nota de crédito, avaliação de direito a abatimento, devolução física, recebimento de dinheiro de fornecedor, alçadas aprovadas ou compensação entre entidades. Evidência e valores são declarações fictícias. Conciliação bancária de saídas permanece o próximo recorte e tratará pagamentos; créditos comerciais não são débitos bancários.
