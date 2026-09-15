# Relatório C2 — Consolidação do prontuário

Data: 15/09/2026. Continuidade autorizada do núcleo; pendências e verificação geral permanecem para depois. Trabalho somente em SISTEMA/hvb-sistema-dev.

## Entrega

Evoluções com autoria, texto exato, hash, versões e invalidação sem apagar histórico. Consulta longitudinal reúne metadados de clínica, exames, documentos, agenda e aplicações preventivas externas usando seus IDs originais e permissões próprias. Planejamento não é promovido a atendimento; relato não movimenta estoque ou gera cobrança. Alta/saída retroativa sinaliza revisão temporal sem apagar o registro.

Migrations 041–043, duas tabelas e uma view; quatro permissões e seis operações novas. Total confirmado: 148 tabelas, 44 views, 94 permissões, 296 operações em 180 caminhos. Versão 0.12.0, sem dependências novas. Seed sintético com evolução e retificação executado; referências em .local/medical-record-demo.json, ignoradas pelo Git.

## Verificação pontual

**34 testes aprovados**: cinco unitários, dezessete de clínica e doze de prontuário. Incluem versões concorrentes, repetição idempotente, referência duplicada, paciente/unidade incompatíveis, datas e conteúdo inválidos, IDs originais de execução/consumo/estorno, permissões por fonte, documento/agenda/exame/aplicação externa, paginação com instantes idênticos e microssegundos, saída retroativa, RLS e imutabilidade SQL.

TypeScript estrito, lint, formatação, migrations nas bases locais existentes e geração OpenAPI aprovados. Evidência reproduzível: [checks-c2-focused.json](evidencias/checks-c2-focused.json), comando pnpm check:medical. Os testes HTTP usam a injeção Fastify com PostgreSQL local real.

A suíte geral anterior de 152 testes do M6E e o recorte C1 de 29 testes são evidências históricas separadas. A suíte geral atual, instalação vazia, benchmark, HTTP por socket separado e CI não foram executados neste bloco. O comando pnpm check inclui C2 quando a verificação geral for retomada; CI continua manual.

## Continuidade

C2 fecha este recorte de narrativa e consulta integrada; não declara o núcleo completo. Próximos trabalhos: conferir cobertura capacidade por capacidade e consolidar jornadas entre execução/consumo/cobertura/cobrança/documentos/portal. O financeiro de aquisição identificado em C1 continua aberto na matriz, junto às pendências anteriores.

Regras reais de prontuário, assinatura, coautoria e registro tardio aguardam validação. Sem interface, dados reais, mensagens externas, SimplesVet/M7, deploy, DNS ou infraestrutura paga. Ver [roteiro](NUCLEO-FUNCIONAL.md), [dicionário](DADOS-C2.md), [ADR](adr/0013-prontuario-longitudinal.md) e [pendências cumulativas](PENDENCIAS-HVB.md).
