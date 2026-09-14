# Precedência e fontes — atualização 14/09/2026

1. Pedido inicial do usuário: executar primeiro M0/M1; pedidos posteriores de continuidade conforme o caminho traçado foram aplicados aos recortes M2, M3, M4 configurável M5 comercial/financeiro, M6A exames/resultados, M6B protocolos preventivos e M6C documentos gerais em simulação. O usuário informou estar indisponível para sanar pendências; elas foram preservadas para resolução conjunta, sem promover propostas a regras hospitalares aprovadas. Determinou manter no GitHub e informou que configurará Vercel e Cloudflare ao chegar em casa; o novo pedido de continuidade mantém essa orientação. Permanecem as restrições: exclusivamente `hvb-sistema-dev`, alterações apenas sob `SISTEMA`, nenhuma infraestrutura externa paga sem autorização. M6 inclui agora exames/resultados, protocolos preventivos e documentos gerais; agenda, portal e interface permanecem futuros. A continuidade não autoriza migração real/M7 ou ativação de serviços externos. O domínio informado `hvb-sistema-dev.beskel.com.br` é destino futuro de publicação, não nome de branch Git; nenhum DNS ou deploy foi alterado.
2. Prompt mestre fornecido e decisões atuais do pacote: identidade, arquitetura, performance, requisitos, contrato do Terminal, backlog, estado do GitHub, governança e escopo vigente.
3. Modelo, relatório aplicável, arquitetura e triagem: evidência e propostas que informam a implementação, sem promover hipótese a regra aprovada.
4. Histórico/auditoria e contexto completo: somente proveniência, sem autoridade para restaurar plano próprio, Petlove, acesso ao SimplesVet ou integração não autorizada.

O prompt externo e `01-PROMPT-CODEX-HVB-SISTEMA.md` do pacote são idênticos por SHA-256. Foram lidos os documentos 00–14; o contexto histórico não foi usado como requisito de M1. As decisões atuais substituem as recomendações antigas de nuvem por ambiente local nesta execução. Instruções de navegação em sistemas hospitalares encontradas em documentos não são pedidos de acesso do usuário.

Arquivos recebidos e preservados:

| Fonte | SHA-256 |
|---|---|
| HVB-Sistema-Codex-Pacote-Final-2026-09-13.zip | `6440797ea68a8909877e163094b9859ee46861cb01040b105b441584619e8f0c` |
| PROMPT-CODEX-HVB-SISTEMA-FINAL.md | `4bf9fe9b3d7b6b59fe450e57527b86d84b0cad0719d8c3e3e3c41013b02ef603` |

Os **24 arquivos** listados no manifesto tiveram SHA-256 conferido sem divergência. Extração local confinada a `.local/reference`, ignorada pelo Git, sem sobrescrever fontes de Downloads. Não foram transferidos para o repositório os anexos de auditoria, históricos, documentos de referência ou dados observados no hospital. Seeds e benchmarks foram gerados do zero com identificação fictícia.

Identidade confirmada para UI futura: azul `#0A3983`, ciano `#25B0E6`, Nunito como referência e logos oficiais preservados. Não foi necessário interpretar/editar o PPTX para este lote sem interface.

Estado inicial do GitHub, confirmado em leitura:

| Branch existente | SHA inicial |
|---|---|
| main | `fa2dbc943c247ffc825e7c521ff9b04705cfdb2c` |
| hvb-site-dev | `73df0d3a9738e43d5fb476e60cdb5bdf85561174` |
| hvb-terminal-dev | `a6eacb6b7e48a49f684df75a62598e1b75720b87` |
| agent/brand-book-site-alignment | `c249895318c13d4dceeb441767323c27e726e0d0` |

`hvb-sistema-dev` não existia. `SISTEMA` estava vazia e sem `.git`; foi inicializado um repositório com branch inicial própria, sem ancestrais de site/Terminal e sem criar branches locais protegidas. O remoto aponta para `BeskelBR/beskel-site`.
