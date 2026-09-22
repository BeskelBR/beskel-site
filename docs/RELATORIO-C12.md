# Relatório C12 — Vínculos e auditoria

Data: 16/09/2026. Versão 0.21.0. Implementação local em SISTEMA/hvb-sistema-dev.

Entregues vínculo explícito agenda–episódio, revogação/histórico, sinalização de cancelamento posterior e auditoria persistente de consultas identificadas internas e do portal. Resultado de leitura só é liberado após gravação da trilha. Textos clínicos, tokens e termos de busca não são copiados para os eventos.

Migrations 061–062: três tabelas, uma view, duas permissões e cinco operações novas. Totais: 182 tabelas, 69 views, 117 permissões e 370 operações em 224 caminhos. Nenhuma dependência ou serviço externo novo. Comparação com C11 não encontrou diferenças nos contratos anteriores; a persistência de auditoria acrescenta dependência de escrita às leituras identificadas. As 62 migrations coincidem com os ledgers DEV/TEST e 001–052 permanecem iguais ao HEAD publicado. Evidência: [c12-integridade.json](evidencias/c12-integridade.json).

## Verificação pontual

**58 testes aprovados:** cinco unitários, 15 da fundação, 12 novos de vínculos/auditoria, 14 do portal e 12 da agenda. Comando pnpm check:links-audit, evidência [checks-c12-focused.json](evidencias/checks-c12-focused.json). O recorte completo passou na primeira execução.

Casos novos: vínculo sem ato clínico inferido, paciente/unidade/estado/versão, concorrência, revogação/revínculo, cancelamento posterior e concorrente, conteúdo privado, omissão de termos/tokens, recusas 403/404, HEAD, consulta da auditoria, permissão global, janela/paginação, RLS, imutabilidade, identidade do portal e falha injetada de gravação com rollback real da transação.

TypeScript, lint, formatação, migrations e OpenAPI aprovados; persiste apenas a sugestão informativa de estilo de C11. O seed foi acrescentado e depois conferido por TypeScript/lint. Executado duas vezes, manteve um vínculo, não criou execução e registrou cada nova consulta separadamente. Referências em .local/links-audit-demo.json, ignoradas pelo Git e sem credenciais. Não houve suíte geral, instalação vazia, benchmark ou homologação operacional.

## Fechamento da sequência planejada

Os grupos previstos na sequência C1–C12 têm agora entregas DEV. Isso fecha essa sequência de implementação básica, não certifica completude de todo o escopo ou prontidão operacional. A conferência das pendências antigas identifica refinamentos funcionais ainda sem implementação; eles estão enumerados em [FECHAMENTO-CICLO-BASICO.md](FECHAMENTO-CICLO-BASICO.md), separados de decisões humanas e bloqueios externos. Não foram apagados ou marcados como resolvidos.

O próximo trabalho deve partir desse inventário consolidado, evitando repetir descoberta de escopo, testes gerais ou tentativas de publicação. A prioridade do usuário permanece concluir funções necessárias antes de pedir decisões hospitalares. Publicação C8–C12 continua adiada, sem nova tentativa de Git. Último commit publicado C7: 789ee1f26241be9e636ea0ad328d03a1cea6f04b.

Nenhuma alteração fora de SISTEMA, nas demais branches, em Terminal físico, dados reais, SimplesVet/M7, Vercel/Cloudflare/DNS ou infraestrutura paga. Ver [dicionário](DADOS-C12.md) e [ADR](adr/0022-vinculos-auditoria.md).
