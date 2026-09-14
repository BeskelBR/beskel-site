# Relatório M6B — Protocolos preventivos

Data: 14/09/2026. Continuidade autorizada nos mesmos parâmetros: somente SISTEMA e hvb-sistema-dev, dados fictícios, código no GitHub e pendências cumulativas. Nenhuma configuração de Vercel/Cloudflare ou infraestrutura externa.

## Resultado

Protocolos preventivos em simulação: catálogo e etapas versionadas, aprovação, adesão do paciente, ocorrências, aplicações internas/externas, correções, vínculo de consumo físico, revisão de atraso e encerramento com sucessor explícito. **21 operações HTTP novas**, total de **223 operações em 138 caminhos**. Migrations **026–029** acrescentam 11 tabelas e quatro views. Nenhuma dependência nova; migrations aplicadas foram preservadas, e os ajustes posteriores estão em migrations adicionais.

| Fluxo | Comportamento verificado |
|---|---|
| Aprovação | Etapas atômicas e imutáveis; adesão exige versão aprovada e espécie compatível |
| Recorrência | Dias e meses distintos, âncora original, fevereiro e ano bissexto |
| Ocorrência | Data confere com regra; chave única adesão/etapa/sequência e retry concorrente |
| Atraso | Revisão humana persistente; resolução não inventa aplicação |
| Origem interna | Mesma identidade da execução clínica, paciente/item/horário conferidos, integral e ativa |
| Origem externa | Profissional e lote/fabricante declarados, sem criar execução ou usuário |
| Material | Vínculo ao item consumido identifica lote físico, sem segunda baixa; estorno sinaliza revisão |
| Correção | Sucessor único e histórico preservado; interna acompanha linhagem clínica |
| Substituição | Adesão sucessora explícita, mesmo paciente, sem migrar ocorrências por inferência |
| Proteção | Permissões, unidade, RLS, comando fechado, imutabilidade e horizonte de datas |

Seed executado duas vezes sem duplicação. Contém protocolo/ocorrência fictícios, revisão de atraso e aplicação externa declarada com resolução de revisão. Referências em `.local/preventive-demo.json`, ignorado pelo Git. Nenhum ato ou consumo hospitalar foi criado pelo seed.

## Validação

- **115 testes aprovados**: cinco unitários e 110 integrações PostgreSQL, incluindo 13 testes M6B e os 102 anteriores.
- Typecheck, lint, formatação e contrato OpenAPI aprovados.
- Migrations 001–029 verificadas em TEST vazio no cluster adicional local, preservando a base anterior por renomeação.
- HTTP real local de aplicação e retry: 200, mesmo ID, efeito único.
- Benchmark com mil ocorrências preparadas e 111 aplicações externas ao final; zero execuções hospitalares, zero cobranças e estoque preservado em 20 unidades.

Evidências: [checks-m6b.json](evidencias/checks-m6b.json) e [benchmark-m6b.json](evidencias/benchmark-m6b.json). Evidências anteriores preservadas. Ambiente: Node 24.19.0, PostgreSQL 17.10, Windows. Docker/Linux e workflow manual não executados. O banco adicional foi encerrado após validação, preservando os dados.

## Desempenho

Um paciente, duas adesões de estrutura diária fictícia e mil ocorrências preparadas. Dez aquecimentos e cem medições por operação, Fastify inject e PostgreSQL local, com teste HTTP separado. Preparação fora da janela medida.

| Operação | p50 | p95 | Statements totais |
|---|---:|---:|---:|
| Lista de até 50 ocorrências | 4,70 ms | 5,09 ms | 7 |
| Registrar ocorrência | 1,98 ms | 2,41 ms | 9 |
| Registrar aplicação externa | 1,97 ms | 2,39 ms | 9 |

O plano da lista executou em 2,609 ms. Contagem inclui transação/contexto e exclui SQL interno dos triggers. Estados são calculados no mesmo statement, sem uma requisição da API por linha. Não houve infraestrutura extra. Esses números não são SLA; muitos pacientes, história longa, contenção por paciente e versões de até 50 etapas exigem medição posterior.

## Limites e próximos passos

Regras, nomes e intervalos do seed são fictícios. Não há escolha de vacina, dose, produto, equivalência ou recomendação clínica. Aprovação é somente simulação; operação assistencial e assinatura profissional continuam pendentes. Datas planejadas não comprovam aplicação e aplicação antes/depois do planejado não é avaliada clinicamente pelo sistema.

Meses de calendário usam âncora fixa com ajuste ao último dia válido; dias são somados como datas civis. A regra precisa de aprovação hospitalar. O recorte exige comandos explícitos de ocorrência e revisão, sem geração em massa automática, varredura agendada ou mensagens. Adesões distintas podem coexistir; detectar duplicidade assistencial entre protocolos exige política posterior.

Uma revisão e uma resolução por ocorrência; reabertura, reprogramação, suspensão, doses não realizadas e cancelamento individual ainda precisam de fluxo. Encerramento conflitante com aplicação anterior é recusado. Troca de protocolo aponta sucessor sem transferir saldo, ocorrências ou equivalência. Alteração de metadados de aplicação interna mantendo a mesma execução, invalidação sem sucessor e mudança de origem externa/interna permanecem pendentes; não são resolvidas com usuários ou atos fictícios.

Vínculo físico exige item consumido da execução interna e preserva o lote real identificado pela posição. Lote/fabricante declarados não são automaticamente conciliados com o cadastro. Custódia do tutor permanece como no estoque/consumo existente. Aplicação externa não admite consumo hospitalar pelo fluxo preventivo.

M6 continua em andamento. Próximo recorte: **documentos gerais**; agenda, portal/comunicação e interface continuam futuros. Migração real, SimplesVet, produção e integração externa não foram iniciados.

Atendendo ao pedido de economia, foi adicionado um [roteiro de discussão e testes locais](ROTEIRO-CHAT-E-TESTES.md). Testes determinísticos podem ser executados diretamente no terminal sem modelo; discussão de negócio pode ocorrer no chat comum. Isso não torna a assistência do Codex gratuita nem separa a cota de ChatGPT Work, que compartilha uso com Codex.

Referências: [dicionário](DADOS-M6B.md), [ADR 0008](adr/0008-protocolos-preventivos.md), [pendências](PENDENCIAS-HVB.md) e [OpenAPI](../openapi/hvb-sistema.json).
