# Relatório M6A — Exames e resultados

Data: 14/09/2026. Primeiro recorte do M6, autorizado pelos pedidos de continuidade. Trabalho somente em `SISTEMA` e `hvb-sistema-dev`, com dados fictícios. O código permanece no GitHub; Vercel e Cloudflare seguem a cargo do usuário. As pendências anteriores continuam abertas.

## Resultado

Backend de exames com catálogo e estrutura técnica versionados, solicitação, coleta, avaliação da amostra, valores estruturados, correção e liberação humana em simulação. São **26 operações HTTP novas**, total de **202 operações em 127 caminhos**. Migrations **024–025** acrescentam 14 tabelas e três views, total de 100 tabelas e 27 views. Nenhuma dependência nova ou migration anterior foi alterada.

| Fluxo | Comportamento verificado |
|---|---|
| Estrutura | Atributos atômicos, versão consecutiva e aprovação explícita para simulação |
| Solicitação | Episódio e versão técnica identificados; repetição concorrente tem efeito único |
| Coleta | Interna referencia execução integral ativa do mesmo episódio; externa preserva coletor informado sem inventar usuário |
| Amostra | Rejeição permanece histórica; resultado exige amostra aceita do mesmo item |
| Valores | Texto original, decimal exato de até oito casas, booleano falso, qualificador e ausência preservados |
| Referência | Associação explícita ao atributo, espécie e idade compatíveis; nenhuma interpretação automática |
| Correção | Nova versão com expectativa; conflito concorrente não deixa cabeçalho ou valores parciais |
| Liberação | Confirmação humana, obrigatórios presentes, pendências reconhecidas e hash do conteúdo exato |
| Histórico | Rascunho novo não substitui publicação; correção liberada preserva conteúdo/hash anteriores |
| Segurança | Organização, unidade, permissões, RLS e imutabilidade verificadas |

O seed M6A foi executado duas vezes sem duplicação. Gera três valores fictícios e liberação técnica com referência pendente reconhecida; referências ficam em `.local/exams-demo.json`, ignorado pelo Git. Não representa exame ou aprovação assistencial real.

## Verificação

- **102 testes aprovados**: cinco unitários e 97 integrações PostgreSQL, incluindo 14 cenários M6A e os 88 testes anteriores.
- TypeScript estrito, lint, formatação e OpenAPI aprovados.
- Instalação completa das migrations 001–025 em TEST vazio no cluster local adicional `127.0.0.1:55433`, preservando a base anterior por renomeação.
- HTTP real local: registro de resultado e retry retornaram 200, mesmo ID e efeito único; consulta de documento retornou 200 e hash conferido por SHA-256 no cliente.
- Ensaio com mil resultados iniciais: ao final, 1.221 resultados e 111 liberações; nenhuma execução clínica ou cobrança criada e estoque mantido em 20 unidades.

Evidências: [checks-m6a.json](evidencias/checks-m6a.json) e [benchmark-m6a.json](evidencias/benchmark-m6a.json). Evidências anteriores preservadas. Ambiente validado: Node 24.19.0 e PostgreSQL 17.10 no Windows. Docker/Linux e workflow manual não foram executados. O cluster adicional foi encerrado após a validação, com os dados preservados.

## Desempenho observado

Mil resultados com três valores cada, preparados por comandos; um episódio/unidade. Dez aquecimentos e cem medições por operação. Preparação da solicitação/item e resultado da liberação fica fora da janela medida. Fastify inject com banco real local; HTTP separado. O computador também executava verificações durante parte do ensaio, portanto os tempos incluem essa interferência.

| Operação | p50 | p95 | Statements totais / funcionais |
|---|---:|---:|---:|
| Lista de até 50 resultados | 5,75 ms | 50,95 ms | 7 / 4 |
| Resultado com três valores | 3,95 ms | 4,90 ms | 15 / 12 |
| Liberação com hash | 6,96 ms | 7,87 ms | 12 / 9 |

A gravação excede o orçamento provisório de dez statements funcionais. A inspeção identifica autenticação/escopo, idempotência, verificação e trava do item, versão anterior, cabeçalho, três inserções de valores e conclusão atômica com auditoria/outbox. O custo cresce com o número de valores; a API limita a 100. O plano de consulta executou em 2,699 ms. Não há consulta adicional da API por linha listada; as verificações derivadas ocorrem no mesmo statement. Contagens não incluem SQL interno dos triggers; controle transacional/contexto entra somente no total.

Esses números não são SLA. Painéis de 100 valores, histórico longo de correções, múltiplos episódios e contenção precisam de medição posterior. A trava de episódio compartilha a serialização da clínica; nenhuma infraestrutura ou cache foi introduzido para esconder esse custo.

## Limites e próximo recorte

Todos os comandos exigem `simulacao: true`, `confirmacao_humana: true`, unidade e motivo. Catálogos, métodos, laboratórios e referências reais precisam de revisão hospitalar. Não há cálculo de dose, diagnóstico, interpretação de valores ou seleção automática de referência. Unidade do atributo é um rótulo explícito, sem conversões clínicas. A idade é declarada com sua origem, sem cálculo a partir de nascimento.

Coleta interna confere execução, episódio, horário, integralidade e atividade; a associação semântica entre procedimento executado e exame ainda depende de confirmação humana. Não cria execução nem consumo automaticamente. Coleta externa preserva declaração, sem verificar identidade no laboratório. Uma amostra tem decisão única; corrigir decisão, compartilhar amostra entre itens e invalidar laudo já publicado exigem fluxo posterior. Cancelamento é permitido antes da primeira liberação; depois disso, a correção é versionada.

O conteúdo liberado é JSON técnico com hash, não PDF/laudo final nem assinatura eletrônica profissional validada. Não há upload de anexos, portal, envio, integração laboratorial ou apresentação de telas neste recorte. Retificação posterior da execução interna sinaliza revisão sem alterar o documento original.

**M6 ainda está em andamento**: protocolos preventivos, documentos gerais, agenda, portal/comunicação e interface seguem para os próximos recortes. Migração real/M7, SimplesVet, produção e infraestrutura externa não foram iniciados. As decisões pendentes M0–M5 e as novas serão resolvidas em conjunto.

Referências: [pendências](PENDENCIAS-HVB.md), [dicionário M6A](DADOS-M6A.md), [ADR 0007](adr/0007-exames-resultados.md) e [OpenAPI](../openapi/hvb-sistema.json).
