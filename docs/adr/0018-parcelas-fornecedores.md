# ADR 0018 — Parcelas de fornecedores e alocação de liquidações

Estado: proposta implementada em DEV, C8, 15/09/2026. Somente SISTEMA/hvb-sistema-dev, dados fictícios e nenhum pagamento externo. Necessidades do escopo não aprovam condições financeiras hospitalares.

## Decisão

O plano versionado distribui o valor integral de uma obrigação de compra ou despesa existente. Não cria outra dívida e não altera valor, vencimento original, documento, pagamento ou estoque. Cada plano contém de uma a 120 parcelas positivas, numeradas pela ordem informada, com datas explícitas não decrescentes; datas iguais são permitidas. A soma precisa coincidir exatamente com o valor original da obrigação, inclusive quando parte já foi liquidada. Cabeçalho e parcelas são atômicos e imutáveis.

O comando não calcula juros, multa, desconto, recorrência ou ajuste por dia útil. Datas anteriores são permitidas para registro retrospectivo; não significam autorização de atraso. Valor e data de cada parcela são decisões explícitas. Quantias entram como texto decimal de centavos, sem divisão ou arredondamento automático.

Liquidações C4 existentes podem ser alocadas parcialmente a parcelas da mesma obrigação. Uma liquidação pode cobrir mais de uma parcela e uma parcela pode receber mais de uma alocação. Os limites são o saldo da parcela e o valor da liquidação ainda sem alocação. O vínculo não gera outro pagamento nem outra baixa da obrigação. Exemplo: obrigação 100, parcelas 40/60 e liquidação 60; alocações 40/20 deixam saldos 0/40 e dívida 40.

Liquidações anteriores ou novas sem alocação ficam visíveis. A soma dos saldos das parcelas vigentes corresponde ao saldo da obrigação mais o liquidado ainda sem parcela; por isso não se deve interpretar toda parcela sem vínculo como dívida adicional ou inadimplência. Alocar não exige executar novamente a liquidação. Os comandos existentes de C4 continuam válidos e não escolhem parcelas automaticamente.

## Correção, concorrência e histórico

Reverter uma alocação libera sua parcela e a capacidade da liquidação sem desfazer o efeito financeiro original. Reprogramar exige reverter todas as alocações ativas da obrigação, criar uma nova versão completa e realocar explicitamente as liquidações. Versão esperada impede duas sucessoras; o plano anterior e suas parcelas continuam consultáveis, mas não aceitam novos vínculos.

Reversão da liquidação inativa suas alocações por consulta. A reversão da obrigação continua exigindo primeiro reverter liquidações C4; suas parcelas ficam não vigentes. Uma obrigação corrigida tem identidade própria e começa sem plano ou alocações herdadas. Não há transferência automática, correção retroativa destrutiva ou mudança de fornecedor.

Todas as operações usam a trava de contas a pagar da unidade, compartilhada com liquidações/reversões C4, e reconsultam saldos depois da trava. RLS por organização, FKs de unidade, comando aberto, autoria, motivo, idempotência e auditoria/outbox seguem a fundação. Trigger diferido verifica soma, sequência contínua e ordem de vencimentos; não há plano parcialmente gravado.

## Acesso e leitura

Criar/reprogramar exige pagar:parcelar. Alocar/reverter exige pagar:alocar_parcela. Consultas exigem pagar:ler e unidade. Permissões de pagar ou liquidar não são implicitamente concedidas por essas ações. Paginação UUID e filtros preservam o contrato da API.

atual identifica a última versão do plano mesmo se a obrigação foi revertida; obrigacao_revertida indica essa condição. vigente nas parcelas exige última versão e obrigação não revertida. nao_alocado em uma liquidação revertida é histórico, sem disponibilidade para novo vínculo; é obrigatório considerar revertida. liquidado_sem_parcela é agregado atual da obrigação, inclusive quando consultado por uma versão histórica do plano.

## Limites

Sem débito agendado, envio ao fornecedor, cobrança automática, aprovação financeira, conciliação bancária ou renegociação de valor. O vencimento original da obrigação permanece documental; o plano acrescenta o cronograma explícito. Interface e política de vencimento operacional devem distinguir os dois.

Crédito comercial e conciliação de saídas são os próximos complementos do grupo financeiro. Alçadas, juros/multas, dia útil, notas complementares e condições reais ficam para decisão posterior. A suíte geral e homologação permanecem após a consolidação do núcleo.
