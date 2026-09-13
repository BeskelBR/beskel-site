# Relatório do recorte M4 — HVB Sistema

Data: 13/09/2026. Continuação autorizada dentro de `SISTEMA`, exclusivamente em `hvb-sistema-dev`. Código destinado ao GitHub; configuração de Vercel/Cloudflare a cargo do usuário. Ambiente local, dados fictícios e pendências anteriores preservadas.

## Resultado

Backend de diária configurável implementado **somente como simulação**. São 33 operações HTTP novas, totalizando **130 operações em 88 caminhos**. Migrations **014–016** acrescentam 16 tabelas e quatro views, preservando as migrations anteriores. Nenhuma dependência nova.

| Entrega | Comportamento verificado |
|---|---|
| Classificação e peso | Versões e histórico; medição de massa referenciada quando informada; sem classificação inferida |
| Pacotes e grupos | Alvos tipados, políticas explícitas, aprovação apenas de simulação e congelamento de regras/membros |
| Períodos | Intervalos explícitos [início, fim), associação e classificação compatíveis, sem sobreposição |
| Cobertura | Quantidade física, administrações integrais ou itens clínicos distintos; prioridade máxima única; conflito vira pendência |
| Limites | Alocações e reservas serializadas por episódio; quantidade incluída e excedente conferidas no banco |
| Histórico | Reavaliação exige versão esperada, compensa anterior e registra nova avaliação atomicamente |
| Revisão | Retificação, estorno e mudança de classificação/encerramento sinalizam revisão sem apagar decisões |
| Separação física/comercial | Cobertura mantém consumo, saldo e custo; não cria preço, cobrança, conta, título ou recebimento |

Exemplo testado: um consumo físico de 0,3 com limite simulado de 0,2 resulta em 0,2 incluído e 0,1 excedente. O custo físico de 0,375 e o saldo após consumo de 4,7 permanecem intactos. O resultado excedente não cria cobrança. Material do tutor mantém custo hospitalar nulo e cobertura física pendente.

Para itens distintos, duas execuções do mesmo item compartilham uma identidade comprometida; reverter uma delas mantém a capacidade usada pela outra. Reservas participam do mesmo conjunto. Para administrações, duas avaliações concorrentes com limite um produzem uma incluída e uma excedente.

`db:seed:daily` foi executado duas vezes sem duplicação. Referências fictícias em `.local/daily-demo.json`, ignorado pelo Git. As confirmações do seed não representam atos assistenciais ou aprovação das regras reais do HVB.

## Verificação

- **69 testes aprovados**, sem ignorados: cinco unitários e 64 de integração PostgreSQL, incluindo 17 cenários M4 e as regressões anteriores.
- TypeScript estrito, lint, formatação e OpenAPI aprovados.
- Migrations 001–016 executadas em TEST vazio no cluster adicional `127.0.0.1:55433`; TEST anterior preservado por renomeação, DEV principal preservado.
- Avaliação por HTTP real local e repetição retornaram 200 com mesmo ID e efeito único.
- Benchmark com mil avaliações fictícias: zero limites ultrapassados; saldo físico de 20 preservado.
- Concorrência, idempotência, versão esperada, reservas/expiração, reversão, precisão decimal, origem alterada, prioridade, classificação, permissões/isolamento, congelamento e listas paginadas cobertos pelos testes.

Evidências: [checks-m4.json](evidencias/checks-m4.json) e [benchmark-m4.json](evidencias/benchmark-m4.json). Evidências históricas preservadas. Node 24.19.0 e PostgreSQL 17.10 nativo no Windows. Docker/Linux e workflow manual não executados.

## Desempenho observado

Mil avaliações preparadas por comandos, concentradas em um episódio/pacote/regra. Dez aquecimentos e cem medições por operação. Preparação de execução e evento ocorre fora da medição da avaliação. Fastify inject e banco local, sem TLS ou rede externa; HTTP verificado separadamente.

| Operação | p50 | p95 | Statements totais / funcionais |
|---|---:|---:|---:|
| Lista de até 50 avaliações | 5,80 ms | 6,66 ms | 7 / 4 |
| Avaliação | 21,01 ms | 23,26 ms | 17 / 14 |
| Reavaliação | 28,25 ms | 31,85 ms | 19 / 16 |

O orçamento provisório de dez consultas foi ultrapassado e investigado. O fluxo lê autenticação/escopo/permissão, registra idempotência, trava episódio, confere versão/origem/período, seleciona regra, obtém uso/compromisso, grava avaliação/alocação e confirma auditoria/outbox. Reavaliação acrescenta permissão e compensação. Não há consulta por membro de grupo no serviço: seleção de candidatos e compromisso são operações em conjunto no banco. Contagem não inclui SQL interno dos triggers; BEGIN/contexto/COMMIT entram apenas no total.

O plano real da lista executou em 1,473 ms e usou índice para limitar avaliações a 50. Também fez varredura de 1.111 execuções para revisão e scans de tabelas pequenas de configuração. Isso permanece como ponto de observação com histórico longo: não foi adicionado índice ou cache sem evidência de ganho. O compromisso recalcula o histórico por uso, e o lock de episódio pode limitar concorrência naquele agregado. Não são métricas de SLA, rede, muitas regras ou carga hospitalar representativa.

## Limites e continuidade

Regras reais de classes, peso, diárias, medicamentos, tolerância, preços e exceções continuam abertas. Apenas políticas explícitas do recorte simulado podem ser aprovadas; configurações `pendente` bloqueiam a aprovação. Não há inferência de janela de 24 horas, calendário, dose ou equivalência entre produtos e itens clínicos.

Execução parcial e material físico do tutor permanecem pendentes. Reservas exigem um evento já identificado, cobertura integral e validade DEV de até 24 horas; a expiração é explícita. Origem ou período alterado deixa capacidade conservadoramente comprometida até revisão/reversão explícita. Isso preserva limite e histórico, mas ainda exige fluxo operacional de acompanhamento.

Classificação admite encerramento único; associação e período são imutáveis. Cancelamento, substituição, correção retroativa e migração de pacote exigem fluxo futuro, sem contornar histórico por SQL manual. A avaliação de cobertura é não monetária e deverá ser referenciada pelo futuro módulo comercial, preservando a identidade clínica e física.

Não houve provisionamento externo, deploy, DNS, acesso ao SimplesVet ou uso de dados reais. O backend atual depende de PostgreSQL local; publicar apenas a branch na Vercel não constitui implantação funcional da API/worker. As decisões de hospedagem e autenticação operacional permanecem registradas. M5 é o próximo marco e não foi iniciado neste recorte.

Referências: [pendências cumulativas](PENDENCIAS-HVB.md), [dicionário M4](DADOS-M4.md), [ADR 0005](adr/0005-diaria-configuravel.md) e [OpenAPI](../openapi/hvb-sistema.json).
