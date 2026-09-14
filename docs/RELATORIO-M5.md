# Relatório do recorte M5 — HVB Sistema

Data: 13/09/2026. Continuação autorizada do backlog, exclusivamente em `SISTEMA` e `hvb-sistema-dev`. Dados fictícios e ambiente local; pendências anteriores preservadas. Código destinado ao GitHub. Vercel/Cloudflare seguem a cargo do usuário.

## Resultado

Núcleo comercial e financeiro implementado em **simulação**: catálogo/preço, conta, avaliação, responsabilidade, título, recebimento, liquidação, crédito, caixa, parcelas, depósitos e conciliação. **46 operações HTTP novas**, total de **176 operações em 112 caminhos**. Migrations **017–023** acrescentam 24 tabelas e 15 views; nenhuma migration anterior a M5 foi reescrita. Sem dependências novas.

| Fluxo | Comportamento verificado |
|---|---|
| Origem e preço | Execução/consumo/período tipados; preço versionado e vigente, sem associação pelo nome |
| Avaliação | Bruto, desconto, benefício e final separados; reavaliação com versão esperada |
| Pendência | Preço ausente, diária ambígua, execução parcial e material do tutor não geram dívida |
| Valor zero | Item documentado e rastreável, sem responsabilidade ou título fictício |
| Rateio | Responsabilidades fecham item e alocações fecham título atomicamente; falha desfaz comando e documento |
| Recebimento | Referência persistente e idempotência; não liquida título automaticamente |
| Liquidação/crédito | Disponibilidade protegida nos dois lados; crédito não duplica dinheiro e só atende o mesmo pagador/unidade |
| Caixa | Uma sessão aberta, abertura/entrada/conferência distintas, diferença explícita e fechamento preservado |
| Cartão | Quitação do tutor separada de parcela, taxa, depósito, extrato e conciliação |
| Reversão | Evento vinculado preserva histórico; dependências precisam ser desfeitas antes |
| Origem substituta | Documento anterior ativo impede emitir nova dívida pela execução retificada ou consumo substituto vinculado |

O seed M5 foi executado duas vezes sem duplicação: título de R$ 100, recebimento fictício de R$ 120, liquidação de R$ 100 e crédito de R$ 20. Referências em `.local/financial-demo.json`, ignorado pelo Git. Nenhum dinheiro foi recebido ou transferido externamente.

Diária incluída produz item comercial zero somente com avaliação de cobertura identificada e vigente. Benefício não elimina custo ou saldo físico. Cobertura omitida em contexto de diária permanece pendente. Reversão da cobertura e retificação da origem sinalizam revisão; o financeiro não bloqueia ato assistencial nem apaga dívida histórica por inferência.

## Verificação

- **88 testes aprovados**: cinco unitários e 83 integrações PostgreSQL, incluindo 19 cenários M5 e 69 testes anteriores.
- TypeScript estrito, lint, formatação e OpenAPI aprovados.
- Migrations 001–023 executadas em TEST vazio no cluster adicional `127.0.0.1:55433`; base anterior preservada por renomeação e DEV principal preservado.
- Recebimento por HTTP real local e retry retornaram 200 com mesmo ID e efeito único.
- Mil recebimentos fictícios no benchmark; zero saldos negativos. Liquidações medidas deixaram título em R$ 98,90 e estoque em 20 unidades, conforme esperado.
- Concorrência de título, liquidação, crédito, sessão e conciliação; rateio incompleto; coerção/precisão; origem duplicada; RLS/RBAC/contexto; fechamento; revisão e reversões cobertos.

Evidências: [checks-m5.json](evidencias/checks-m5.json) e [benchmark-m5.json](evidencias/benchmark-m5.json). Evidências M1–M4 preservadas. Dois testes antigos verificavam ausência da tabela comercial; foram atualizados para verificar ausência de **itens criados** pelas operações de estoque/diária, mantendo a garantia funcional agora que M5 existe.

Ambiente validado: Node 24.19.0 e PostgreSQL 17.10 no Windows. Docker/Linux e workflow manual continuam sem execução. Banco adicional encerrado após validação, preservando os dados.

## Desempenho observado

Mil recebimentos preparados por comandos, um pagador/unidade e dez aquecimentos com cem medições por operação. Preparação de execução/evento e recebimento da liquidação fica fora da janela medida. Fastify inject com PostgreSQL local, sem rede externa/TLS; smoke HTTP separado.

| Operação | p50 | p95 | Statements totais / funcionais |
|---|---:|---:|---:|
| Lista de até 50 recebimentos | 2,89 ms | 3,33 ms | 7 / 4 |
| Avaliação comercial | 9,70 ms | 10,53 ms | 14 / 11 |
| Recebimento | 1,87 ms | 2,27 ms | 10 / 7 |
| Liquidação | 2,05 ms | 2,49 ms | 10 / 7 |

A avaliação excedeu o orçamento provisório e foi investigada. Consulta separada da associação de diária foi incorporada ao contexto da origem, reduzindo um round-trip. Permanecem autenticação, escopo, idempotência, trava financeira, origem/linhagem, trava clínica, versão, preço, inserção e auditoria/outbox. Contagem exclui SQL interno dos triggers; BEGIN/contexto/COMMIT entram somente no total.

O plano da lista executou em 0,378 ms: índice limita 50 recebimentos, com consultas indexadas de alocações, créditos e reversões no mesmo statement. Não há requisição adicional por linha na API. A proteção de linhagem verifica histórico no banco; seu custo foi incluído no benchmark final.

Esses números não são SLA. O advisory lock serializa escrita financeira da unidade; histórico longo, vários pagadores, até 20 rateios e carga hospitalar concorrente exigem medição futura. Nenhum cache ou infraestrutura adicional foi introduzido.

## Limites operacionais

Todos os comandos financeiros exigem confirmação explícita de simulação. Moeda única BRL, centavos exatos; não há arredondamento, juros, imposto, nota fiscal ou cálculo contábil automático. Preço real, desconto, responsabilidade e regras de diária continuam sem aprovação hospitalar. Catálogo atual cobre serviço/produto, sem composição de conjuntos ou múltiplas tabelas comerciais.

Um evento por origem impede repetição, mas não adivinha se identificadores novos e sem linhagem representam o mesmo fato. Consumo avulso substituto exige conciliação humana. Documentos emitidos precisam de reversão antes de reavaliação; cancelamentos após pagamento seguem a cadeia de dependências, sem apagar fatos.

Crédito nasce somente de saldo disponível de recebimento; crédito reconhecido sem recebimento, reserva futura, devolução real e transferência entre clientes/unidades não foram implementados. O recorte não movimenta dinheiro nem confirma evidência bancária automaticamente.

Caixa inclui abertura, entrada em dinheiro e conferência. Suprimento, sangria, ajuste de sessão fechada e revisão operacional continuam pendentes. Recebimento vinculado a parcela de adquirente não admite reversão simples; estorno, chargeback, antecipação e acerto de taxas exigem fluxo posterior.

Depósito/extrato são registros manuais fictícios. Divergência permanece saldo em aberto. Há um vínculo por par depósito/parcela ou depósito/extrato; correção de valores, reabertura do mesmo par após reversão e novos repasses ao mesmo par exigem refinamento. Alocações parciais e depósitos com múltiplas parcelas foram testados, sem inferir correspondência pelo texto.

Despesas, compras, contas a pagar, comissões, fiscal, dashboards e fila comercial agregada permanecem no backlog de refinamento. `revertido` e `necessita_revisao` precisam ser considerados junto com valores originais nas consultas. Nenhuma regra de relatório de receita/lucro foi presumida.

Não houve deploy, DNS, provisão paga, acesso ao SimplesVet, importação real, comunicação ou integração bancária. Outras pastas e branches permaneceram separadas. M6 é o próximo marco; as pendências M0–M5 continuam cumulativas.

Referências: [pendências](PENDENCIAS-HVB.md), [dicionário M5](DADOS-M5.md), [ADR 0006](adr/0006-comercial-financeiro.md) e [OpenAPI](../openapi/hvb-sistema.json).
