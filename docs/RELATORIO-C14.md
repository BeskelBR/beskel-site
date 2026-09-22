# Relatório C14 — Terminal de Acesso V2

16/09/2026, versão 0.23.0. Ajuste arquitetural implementado localmente em SISTEMA/hvb-sistema-dev após a auditoria [IMPACTO-C14-TERMINAL-V2.md](IMPACTO-C14-TERMINAL-V2.md). A ADR 0015 e as migrations 047/048 permanecem históricas, sem edição.

Entregues ordens/itens/submit/cancelamento, challenge/evidência assinada DEV, autenticação curta, sessão com múltiplas ordens e escopo sensível fixo, eventos de barreira e consultas auditadas. Entrada confirmada inicia separação; autorização de porta não inicia. Retirada legada está deprecated, bloqueada para novos comandos na API e no banco. Nenhuma ação V2 chama o estoque. Contrato de fulfillment preparado, sem gravador ou UI Mobile. Hardware, biometria e política hospitalar permanecem posteriores.

Migrations 065–066: nove tabelas, duas views, seis permissões, 15 operações novas. Totais DEV/TEST: **193 tabelas, 72 views, 125 permissões, 399 operações em 242 caminhos**. Nenhuma operação antiga foi removida; a alteração intencional de comportamento é POST /terminal/retiradas. As 66 migrations coincidem com os ledgers; 001–052 coincidem em bytes com o último commit. RLS forçada nas nove tabelas. Evidência: [c14-integridade.json](evidencias/c14-integridade.json).

## Verificação pontual

**41 testes aprovados:** cinco unitários, 15 da fundação, oito legados e 13 V2. Comando: pnpm check:terminal-access. Evidência: [checks-c14-focused.json](evidencias/checks-c14-focused.json). TypeScript, lint, formato, migrations e OpenAPI passaram. Duas sugestões de estilo novas foram corrigidas e o runner passou a identificar corretamente o recorte C14 no arquivo de evidência; a execução final foi repetida com esses ajustes. A primeira execução já havia selecionado os mesmos testes, mas rotulava o arquivo como completo; esse arquivo foi retirado de docs e preservado somente em .local como diagnóstico. Não houve suíte geral neste lote. Permanece a informação preexistente de estilo em teste C11.

Os testes demonstram ausência de estoque/execução/evento cobrável na autenticação/acesso, entrada distinta de autorização, sessão com duas ordens, idempotência concorrente/conflito, referência duplicada, evidência adulterada/expirada/futura/negativa, adaptador ausente, escopo sensível, sequência do armário, concorrência pela ordem, organização/unidade, RLS, episódio encerrado, dispositivo divergente/desativado, vínculo à credencial original, imutabilidade, consultas tipadas, auditoria e outbox. A simulação não prova face/PAD/hardware reais.

Seed C14 executado duas vezes: uma ordem sensível em EM_SEPARACAO, sessão ACCESS_CLOSED com 11 eventos, saldo 20 preservado. A segunda execução reutilizou o manifesto concluído e verificou os registros, sem novos comandos de acesso. Retries HTTP concorrentes são exercitados nos testes. O manifesto .local/terminal-access-demo.json contém apenas referências, sem token, chave HMAC ou envelope. Execução interrompida antes do manifesto preserva o histórico e uma nova tentativa produz cenário sintético próprio. Seed C5 foi adaptado para identificação, sem nova retirada.

## Pendências e continuidade

Três registros afetados foram retirados da lista ativa por resolução ou substituição de requisito; rastreabilidade em [PENDENCIAS-RESOLVIDAS-C14.md](PENDENCIAS-RESOLVIDAS-C14.md). Pendências parciais atualizadas e trabalho Mobile/fulfillment, biometria, intertravamento físico, timeout/saída, step-up, offline e homologação explicitados em [PENDENCIAS-HVB.md](PENDENCIAS-HVB.md). Expiração de autorização não comprova saída física. Não se declara sistema completo.

O próximo refinamento do núcleo continua sendo correção clínica. Suíte geral, instalação vazia, carga e publicação seguem posteriores. C8–C14 permanecem locais; último commit publicado C7, 789ee1f26241be9e636ea0ad328d03a1cea6f04b. Não houve nova tentativa de escrita no Git nem mudança em outra pasta/branch, hardware, dados reais, SimplesVet/M7, DNS, Vercel/Cloudflare ou infraestrutura paga.
