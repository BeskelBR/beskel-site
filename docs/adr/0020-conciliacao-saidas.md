# ADR 0020 — Conciliação de saídas de fornecedores

Estado: proposta implementada em DEV, C10, 15/09/2026. Apenas SISTEMA/hvb-sistema-dev, dados fictícios e nenhuma operação bancária. Pendências e bloqueios serão tratados após o ciclo básico, conforme a orientação mais recente do usuário.

## Decisão

Saída de extrato é uma evidência declarada com conta financeira, referência interna, identificador externo, instante ocorrido, valor positivo e descrição da evidência. A conta reutiliza o cadastro financeiro existente. O registro de débitos fica separado do extrato de entradas M5 para preservar aquele contrato; não representa importação bancária ou extrato completo da conta.

Conciliação relaciona explicitamente pagamento_fornecedor e saída da mesma conta/unidade, com valor e evidência. Pode ser parcial e admitir agrupamento: um pagamento em várias saídas ou uma saída para vários pagamentos, inclusive fornecedores diferentes da mesma conta. O valor não ultrapassa o restante de nenhum dos lados. Não há pareamento por data, nome ou valor. Datas de pagamento e lançamento bancário podem diferir; ambas devem ser fatos já ocorridos, sem impor ordem temporal não aprovada.

Registrar saída ou conciliar não registra outro pagamento, não liquida obrigação e não altera estoque. Saldo disponível para liquidar dívida é distinto do valor ainda sem conciliação bancária. Exemplo: pagamento declarado 60, saída 100 e vínculo 60 deixam 40 sem conciliar no extrato; a dívida 100 continua intacta se nenhuma liquidação foi registrada.

Crédito comercial C9 não é pagamento bancário. Crédito e liquidação por crédito não podem ocupar pagamento_id; a FK aponta exclusivamente para pagamento_fornecedor. Tarifas, diferenças e devoluções reais não são inferidas do residual; ficam para classificação explícita futura.

## Correção e reversão

Reverter a conciliação recompõe os dois saldos, preservando vínculo, motivo e autoria. Reverter a saída exige primeiro desfazer seus vínculos ativos. Correção da saída exige registro anterior revertido, mesma conta/unidade/identificador externo, nova referência e uma única sucessora. Valores e datas anteriores são preservados. O identificador externo original é único por conta, sem normalização presumida.

Reversão do pagamento segue C4: suas liquidações precisam ser revertidas antes. Ao reverter o pagamento, a conciliação fica inativa por consulta e a saída permanece registrada e sem conciliação. Isso não comprova estorno bancário nem crédito em conta. A saída pode ser revisada ou reconciliada com outro pagamento explícito; não há transferência automática de vínculo.

Históricos podem mostrar valor não conciliado em pagamento/saída revertidos; o indicador revertido impede novo vínculo. Corrigir uma origem não transporta conciliações antigas para a sucessora.

## Integridade e acesso

Três tabelas imutáveis e três views com RLS. FKs de organização/unidade, comandos abertos, idempotência, autoria, motivo e auditoria/outbox seguem a fundação. A trava de contas a pagar da unidade serializa conciliações e reversões com C4; saldos e vigência são reconsultados sob a trava.

Registrar/corrigir extrato exige pagar:extrato_saida; conciliar exige pagar:conciliar_saida; reverter exige pagar:reverter. Consultas exigem pagar:ler e unidade. Nenhuma dessas permissões autoriza débito externo. API nova preserva os contratos anteriores; leitores precisam distinguir disponivel, nao_conciliado e revertido.

## Limites

Sem Open Finance, acesso bancário, importação OFX/CSV, evidência real, saldo inicial/final de banco, detecção automática de fraudes, juros/tarifas, aprovação operacional ou movimentação de dinheiro. Conciliação DEV demonstra vínculo declarado; não certifica extrato bancário real. Política hospitalar, canais, alçadas e homologação continuam nas pendências.
