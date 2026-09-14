# Relatório M6C — Documentos gerais

Data: 14/09/2026. Continuidade nos mesmos parâmetros: somente SISTEMA e hvb-sistema-dev, dados fictícios, código no GitHub e pendências preservadas. Sem Vercel/Cloudflare, produção, mensagens ou infraestrutura externa.

## Entrega

Backend documental com modelos/campos versionados, solicitação e protocolo, autorização/revogação, preenchimento em texto simples, aprovação, declaração de assinatura não verificada e registro de entrega simulado. **22 operações HTTP novas**, total de **245 operações em 150 caminhos**. Migrations **030–033**, 11 tabelas e três views novas; total de 122 tabelas e 34 views. Sem dependências novas.

| Comportamento | Garantia verificada |
|---|---|
| Modelo | Versão consecutiva, campos atômicos, aprovação e marcadores conhecidos |
| Conteúdo | Texto exato, preenchimento sem recursão, obrigatório presente, hash reproduzível |
| Solicitação | Paciente/episódio coerentes, protocolo persistente e retry com efeito único |
| Autorização | Ausência/negação bloqueiam aprovação; revogação bloqueia entrega |
| Correção | Expectativa de versão, concorrência, conteúdo e evidência antigos preservados |
| Público | Documento interno e destinatário divergente não admitem entrega ao responsável |
| Assinatura | Declaração não verificada, hash exato, sem promoção a assinatura validada |
| Acesso | Metadados separados de conteúdo, unidade/RLS e versão obrigatória para consulta do texto |

Seed executado duas vezes sem duplicação: solicitação, autorização, documento aprovado e entrega fictícia registrada. Nenhum envio ocorreu. Referências em `.local/documents-demo.json`, ignorado pelo Git.

## Verificação

**126 testes aprovados**: cinco unitários e 121 integrações PostgreSQL, incluindo 11 cenários documentais e os 115 anteriores. TypeScript estrito, lint, formatação e OpenAPI aprovados. Migrations 001–033 verificadas em TEST vazio no cluster adicional, preservando a base anterior por renomeação. Node 24.19.0 e PostgreSQL 17.10 no Windows; Docker/Linux e workflow manual não executados. Banco adicional encerrado após validação, com dados preservados.

A suíte revelou uma fragilidade no teste antigo de lease do worker: ele selecionava um evento global potencialmente próximo do limite de tentativas após várias execuções preservadas do TEST. O teste passou a criar e identificar seu próprio evento, posicionando-o para os cenários de expiração/recuperação. A lógica de produção do worker não foi alterada.

HTTP real local confirmou registro de entrega e retry com mesmo ID; consulta privada de conteúdo retornou 200 e SHA-256 foi reproduzido no cliente. Ensaio com mil documentos fictícios preservou estoque em 20 unidades, sem criar execução clínica ou cobrança. Evidências: [checks-m6c.json](evidencias/checks-m6c.json) e [benchmark-m6c.json](evidencias/benchmark-m6c.json); evidências anteriores preservadas.

| Operação | p50 | p95 | Statements totais |
|---|---:|---:|---:|
| Lista de até 50 versões | 13,80 ms | 16,32 ms | 7 |
| Preencher versão, três campos | 6,47 ms | 7,18 ms | 12 |
| Aprovar documento | 2,78 ms | 5,05 ms | 9 |

Mil documentos preparados por comandos, um paciente, três campos por versão, dez aquecimentos e cem medições. Preparação de solicitação/autorização fora da janela medida. Contagem inclui transação/contexto e exclui SQL interno dos triggers. Preenchimento tem nove statements funcionais: autenticação/escopo, comando, verificação/trava da solicitação, versão, inserção e conclusão atômica. Esses tempos locais não são SLA; documentos extensos, 50 campos, histórico longo e carga concorrente exigem medição posterior.

## Limites e continuidade

O artefato atual é texto privado no banco, consultável por API. PDF/DOCX, anexos, apresentação visual, download, armazenamento de arquivos e entrega externa continuam pendentes. O texto é preservado literalmente; interfaces futuras devem exibi-lo como texto, sem interpretar HTML.

Dados de campos são informados explicitamente. Aprovação humana deve conferir identificação e adequação do conteúdo; não há preenchimento automático a partir do prontuário, escolha de orientação clínica ou validade jurídica presumida. Tipo `termo` não confirma consentimento. Assinatura declarada não verifica certificado, identidade profissional ou aceite real.

Autorização de solicitante controla aprovação/assinatura/entrega. O acesso de operadores internos ao conteúdo usa RBAC/ABAC específico; revogação do solicitante não apaga histórico nem revoga permissões dos operadores. O vínculo paciente/responsável não concede acesso por inferência; decisão e evidência são explícitas. Identidade, poderes e critérios reais precisam de aprovação hospitalar.

Uma autorização por solicitação, com revogação; renovação, reconsideração de negativa, cancelamento, múltiplos destinatários e reabertura de prazo exigem fluxo posterior. Prazo vencido considera ausência de entrega registrada na solicitação; correção posterior não reabre prazo automaticamente. A declaração de assinatura não é requisito automático para entrega de todos os tipos: política por modelo continua pendente. Instantes informados de assinatura/entrega devem ser posteriores à aprovação; registro retrospectivo anterior exige política própria.

M6 segue em andamento. Próximo recorte: **agenda**; portal/comunicação e interface permanecem futuros. Migração real, SimplesVet e infraestrutura paga não foram iniciados.

Referências: [ADR 0009](adr/0009-documentos-gerais.md), [dicionário](DADOS-M6C.md), [pendências](PENDENCIAS-HVB.md) e [roteiro de economia de cota](ROTEIRO-CHAT-E-TESTES.md).
