# Relatório do lote M0 + M1 — HVB Sistema

Data: 13/09/2026. Escopo autorizado: exclusivamente `SISTEMA`, branch `hvb-sistema-dev`, desenvolvimento local com dados fictícios.

## Resultado

Fundação de backend implementada e validada em PostgreSQL **17.10** local no Windows, Node **24.19.0**. M0/M1 tem código executável, cinco migrations incrementais, seed fictício, API com **41 operações HTTP em 27 caminhos**, contratos OpenAPI, worker, armazenamento privado abstrato, documentação, testes e relatório de performance. O produto completo e os módulos M2 em diante não foram implementados neste lote.

| Marco | Entrega e validação |
|---|---|
| M0 — árvore/branch | Repositório novo em SISTEMA, branch inicial própria, remoto BeskelBR/beskel-site; nenhum arquivo de site/Terminal usado como base |
| M0 — ambiente | PostgreSQL portátil com senhas aleatórias; DEV/TEST separados; loopback; pool e timeouts limitados; Compose alternativo entregue |
| M0 — evolução | Migrations SQL atômicas com checksum e lock; schema inicial e correções incrementais preservados |
| M0 — qualidade | TypeScript estrito, Biome, testes nativos, OpenAPI derivado e CI manual restrita à branch |
| M1 — identidade | Organização, unidade, usuário, papel/permissão, atribuição por unidade, credencial revogável e dispositivo |
| M1 — cadastros | Responsável, paciente, vínculo tipado com vigência, episódio, local hierárquico e ocupação por capacidade/vaga |
| M1 — integridade | FKs por organização/unidade, RLS, menor privilégio, transações, idempotência concorrente, audit trail preservado |
| M1 — automação | Outbox/inbox persistentes, leases, fencing, tentativas, backoff, recuperação em lotes e pendência consultável |
| M1 — proveniência | Lote sintético e IDs externos com FKs reais, sem migração operacional |

## Evidências

- **19 testes aprovados**: 4 unitários e 15 de integração real com PostgreSQL; sem testes ignorados. Cobrem repetição concorrente, rollback, isolamento, credencial expirada/NFC/revogada, usuário/dispositivo desativado, autorização por unidade, capacidade, ocupação simultânea, alta/saída, keyset, privilégios, retry limitado e worker repetido/expirado.
- Instalação das migrations verificada em cluster adicional isolado em `127.0.0.1:55433`, sob `.local/verification-postgres`. A base TEST anterior foi preservada por renomeação para validar a sequência completa em uma nova base vazia.
- Smoke com **HTTP real em loopback**, verificando health/readiness, autenticação, criação, reenvio idempotente, JSON inválido e worker local. O servidor efêmero foi encerrado ao final.
- Manifesto recebido: **24 hashes conferidos**, sem divergência. Prompt externo idêntico ao prompt do ZIP.
- `pnpm audit --prod` consultado em 13/09/2026: nenhum advisory retornado para a árvore consultada; [resultado](evidencias/dependency-audit.json). O resultado é limitado à base de advisories e à data da consulta.

Resultados gerados pelas ferramentas: [checks.json](evidencias/checks.json), [http-smoke.json](evidencias/http-smoke.json), [benchmark-m1.json](evidencias/benchmark-m1.json).

## Performance observada

Carga sintética: 10.000 pacientes, 2.000 episódios. Cada consulta: 10 aquecimentos e 100 medições, página de 50 itens. API por Fastify inject com PostgreSQL real no mesmo computador; não inclui rede HTTP/TLS, concorrência hospitalar ou latência de nuvem.

| Consulta | p50 | p95 | Maior resposta |
|---|---:|---:|---:|
| Página de pacientes | 1,70 ms | 2,41 ms | 9.256 bytes |
| Episódios ativos por unidade | 1,58 ms | 2,13 ms | 13.364 bytes |

`EXPLAIN (ANALYZE, BUFFERS)` confirmou consultas indexadas. Foram removidos três índices que repetiam as unicidades `(organizacao_id,id)`. Não há N+1 nessas listas: uma consulta de dados, mais autenticação/autorização e controle transacional. Criação simples tem oito statements funcionais mais BEGIN/contexto/COMMIT; a revalidação de acesso foi mantida para serializar revogação, apesar do custo adicional. Fluxos de ocupação fazem verificações extras de episódio/local e ficam sujeitos a medição com carga representativa antes de otimização adicional. Não foram introduzidos cache, Redis, réplica, particionamento ou mensageria externa. Os números acima são medições deste ensaio, sem caracterizar SLA.

## Correções encontradas durante a implementação

O teste inicial revelou privilégio incompatível com lock de leitura de local e, depois, deadlock entre inserções concorrentes nos índices de exclusão. Local passou a ser consultado sem lock de alteração, pois é imutável no papel da aplicação, e a ocupação passou a adquirir lock por vaga após bloquear o episódio. Constraints continuaram ativas. Testes posteriores confirmaram um sucesso e um conflito na disputa pela mesma vaga.

Foram acrescentados proteção de vigências encerradas, consistência da saída com ocupações e alta, motivos na auditoria, remoção de índices duplicados, retry limitado e recuperação de outbox esgotada em lotes limitados. Essas alterações constam em migrations novas, sem reescrever migration já aplicada.

## Limites e continuidade

Não foram provisionados serviços externos, nuvem paga, DNS, produção, Vercel/Cloudflare, fiscal, mensageria ou integrações. SimplesVet não foi acessado. Site e Terminal não foram editados; a retomada do Terminal requer recorte posterior de M2 e autorização. Não houve importação de dados reais nem cópia de exemplos hospitalares para o banco.

Docker/Linux e a execução do workflow GitHub ainda não foram validados; o workflow manual não foi disparado. A interface visual, autenticação operacional completa, retificações adicionais, backup/restauração, retenção e papéis reais permanecem documentados em [PENDENCIAS-HVB.md](PENDENCIAS-HVB.md). O banco de desenvolvimento em pasta sincronizada não constitui estratégia de backup ou arquitetura operacional.

Próximo lote técnico previsto pelo backlog: M2, somente quando solicitado. Nenhuma regra ambígua de diária foi ativada. Este relatório não declara sistema hospitalar completo, migração ou produção prontos.
