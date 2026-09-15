# Relatório C3 — Jornada integrada e cobertura do núcleo

Data: 15/09/2026. Versão 0.12.1. Trabalho somente em SISTEMA/hvb-sistema-dev.

## Entrega

Composição sintética reutilizável em scripts/core-journey.ts liga diária, execução, consumo, cobrança, prontuário, documento e portal ao mesmo paciente/episódio. Os geradores de cenário documental, portal e prontuário aceitam um contexto clínico existente; o financeiro permite escolher material pendente no cenário. Os padrões dos cenários anteriores foram preservados.

O seed db:seed:core demonstra entrada hospitalar de dez unidades, consumo de duas a custo 1,25 (saldo oito e custo 2,50), cobertura da execução e item de cobrança zero sem responsável devedor criado para esse item. Evolução e documento permanecem entidades distintas. Mensagem é apenas preparada localmente; o seed não gera entrega nem credencial de portal. IDs em .local/core-journey-demo.json, ignorados pelo Git. Executado na organização sintética DEV existente.

A [matriz de cobertura](COBERTURA-NUCLEO.md) percorre todas as capacidades listadas no escopo vigente, distinguindo base implementada, falta funcional e decisão operacional. Nenhuma nova migration, tabela, permissão, dependência ou rota foi necessária neste bloco: continuam 43 migrations, 148 tabelas, 44 views, 94 permissões e 296 operações em 180 caminhos. OpenAPI atualizado somente na versão.

## Verificação pontual

**Nove testes aprovados:** cinco unitários e quatro jornadas integradas com Fastify e PostgreSQL local real. Evidência: [checks-c3-focused.json](evidencias/checks-c3-focused.json), comando pnpm check:journeys.

- Mesmo episódio/IDs na linha do tempo; custo preservado e cobrança incluída sem dívida.
- Reexecução da jornada e retry do consumo sem duplicar fatos, cobertura ou documento.
- Falha de consumo adicional não deixa efeito parcial; estorno devolve material sem desfazer execução/cobertura; retificação clínica sinaliza revisão comercial.
- Entrega apenas simulada nos testes libera o documento exato; credencial de portal não lê prontuário interno, e revogação documental bloqueia acesso sem apagar custo ou narrativa.

TypeScript, lint, formatação, migrations existentes e OpenAPI aprovados. A primeira tentativa encontrou o banco parado; após retomada autorizada, o ensaio identificou apenas uma asserção de custo com escala decimal menor que a armazenada, ajustada sem arredondar o valor. Não foi necessário corrigir regra de produção nos quatro cenários executados.

A suíte geral e benchmarks não foram repetidos. Testes históricos permanecem como evidência dos respectivos recortes; pnpm check incorpora a nova jornada para a verificação geral futura. CI permanece manual, sem execução neste bloco.

## Limites e continuidade

A jornada é composição de comandos explícitos, não orquestrador de produção: cada comando tem atomicidade própria, e uma falha posterior não desfaz fatos anteriores. O seed deve usar seu prefixo estável; alterar uma intenção exige comando novo, não reaproveitar chave com corpo diferente.

Cobertura da execução não prova que todo material consumido está incluído; o cenário valida o custo separado da cobrança de serviço. Documento contém campos fictícios informados, não uma síntese clínica automática. Correção não atualiza nem reenvia documento histórico por inferência.

Núcleo ainda não concluído. Próximo recorte: financeiro de aquisição/despesas em simulação; depois, fluxo de terminal simulado dentro de SISTEMA e fechamento das faltas de vínculos. Pendências humanas acumuladas e verificação geral seguem para depois. Nenhum dado real, SimplesVet/M7, mensagem externa, deploy, DNS ou infraestrutura paga.
