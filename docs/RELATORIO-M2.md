# Relatório do recorte M2 — HVB Sistema

Data: 13/09/2026. Continuação do backlog após M0/M1, exclusivamente em `SISTEMA` e `hvb-sistema-dev`, com dados fictícios e ambiente local.

## Resultado

Estoque físico implementado como backend executável: catálogo dimensional, apresentações versionadas, lotes, recipientes, custódia hospital/tutor, posições, reservas, entrada, transferência, retirada, devolução parcial, perda, reversão e inventário com ajuste. São **33 operações HTTP novas**, totalizando **74 operações em 50 caminhos**, e cinco migrations novas, 006–010. Nenhuma migration anterior foi reescrita. Não foram adicionadas dependências.

| Entrega | Comportamento verificado |
|---|---|
| Conversão | Unidades explícitas e compatíveis; versão imutável; decimal exato, sem arredondamento silencioso |
| Movimento | Par balanceado; origem/destino identificados; saldo físico separado de reserva e disponível |
| Concorrência | Locks ordenados, reserva protegida, saldo insuficiente rejeitado e efeito único sob repetição |
| Rastreabilidade | Comando, autor, motivo, tempo, raiz e referências tipadas; auditoria/outbox no mesmo commit |
| Retirada/devolução | Retirada transfere fisicamente; devolução limitada ao original, sem registrar consumo ou cobrança |
| Reversão | Compensação integral única, preservando histórico e exigindo desfazer devoluções ativas primeiro |
| Tutor | Custódia ligada ao paciente, episódio opcional compatível, sem custo hospitalar inventado |
| Inventário | Versão do saldo observada pelo cliente; ajuste vinculado à contagem; conflito após movimento/reserva |
| Validade | Retirada bloqueada para validade pendente/vencida e recipiente sem validade utilizável |

O seed M2 cria catálogo e duas posições fictícias, com entrada de duas caixas de dez unidades. A repetição foi verificada sem duplicar entrada. As referências ficam em `.local/inventory-demo.json`, ignorado pelo Git; credenciais permanecem no arquivo DEV privado.

## Verificação

- **35 testes aprovados**, sem ignorados: cinco unitários, 15 de integração M1 e 15 de integração M2, com PostgreSQL 17.10 real e Node 24.19.0 no Windows.
- Typecheck estrito, lint, formatação e geração OpenAPI aprovados.
- Sequência completa 001–010 validada em TEST vazio no cluster adicional `127.0.0.1:55433`. A base anterior foi preservada por renomeação; não houve reset da base DEV principal.
- Testes M2 reconciliam saldo com soma dos lançamentos e reservado com reservas ativas. Cobrem comandos simultâneos/repetidos, insuficiência de saldo, transferências opostas, expiração, devolução/reversão, precisão, inventário obsoleto, permissões, isolamento e rollback de lançamentos incompletos.
- Smoke HTTP real de retirada e reenvio com a mesma chave: respostas 200, mesmo ID e apenas um efeito.

Evidências: [checks-m2.json](evidencias/checks-m2.json) e [benchmark-m2.json](evidencias/benchmark-m2.json). Relatório e evidências históricos de M0/M1 foram preservados. Docker/Linux e o workflow manual de CI permanecem sem execução neste host.

## Desempenho observado

Mil posições fictícias, abastecidas por mil comandos reais da API em TEST. Dez aquecimentos e cem medições por operação, com Fastify inject e PostgreSQL local. A consulta retorna até 50 posições por unidade/produto/disponibilidade; a transferência move uma fração entre duas posições. O smoke HTTP é separado da medição de latência.

| Operação | p50 | p95 | Statements totais / funcionais |
|---|---:|---:|---:|
| Listar posições | 1,73 ms | 2,11 ms | 7 / 4 |
| Transferir | 3,10 ms | 3,80 ms | 13 / 10 |

Foram reduzidos cinco statements por transferência (antes 18/15), consolidando persistência do comando e consultas de metadados e evitando autorização repetida já garantida pelo escopo imutável. O total inclui BEGIN/contexto/COMMIT e não contabiliza SQL interno dos triggers. `EXPLAIN (ANALYZE, BUFFERS)` foi registrado, índices duplicados foram removidos e a reconciliação final encontrou **zero divergências**. A carga é sintética e concentrada em um produto/lote; não representa concorrência hospitalar, diversidade de catálogo, rede/TLS ou SLA.

## Limites e pendências preservadas

Este recorte movimenta dentro da mesma unidade hospitalar, lote, recipiente e custódia. Fracionamento/abertura de estoque existente, mudança de custódia, interunidades, retificação de lote e políticas reais de valoração continuam pendentes. O critério DEV trata validade por data até o fim daquele dia no fuso da unidade; a regra precisa de aprovação operacional. Validade após abertura é informada explicitamente, nunca calculada pelo nome do produto.

Reservas têm validade provisória de até 24 horas, efetivação integral e expiração por comando explícito. Uma reserva vencida continua protegendo saldo até ser processada. Reverter uma efetivação devolve saldo físico sem reativar a reserva. Contagem obsoleta exige nova sessão/contagem; a anterior é preservada e não há cancelamento ou dupla aprovação neste lote.

As pendências anteriores e novas estão reunidas em [PENDENCIAS-HVB.md](PENDENCIAS-HVB.md) para resolução conjunta futura. Os testes não aprovam papéis reais, regras hospitalares, dados de catálogo, custo contábil, prazos ou uso em produção.

M3 clínico não foi iniciado. Não foram alterados site, Terminal ou outras pastas do HVB; não foram acessados SimplesVet, dados reais ou serviços de produção. Não houve provisionamento externo, nuvem paga, DNS, fiscal, mensageria ou integração. Os contratos M2 permitem planejar o próximo marco, sem autorizar mudanças no Terminal.

Referências técnicas: [dicionário M2](DADOS-M2.md), [ADR 0003](adr/0003-estoque-fisico.md) e [OpenAPI](../openapi/hvb-sistema.json).
