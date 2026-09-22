# Precedência e fontes — atualização 16/09/2026

1. Pedido inicial do usuário: executar primeiro M0/M1; pedidos posteriores de continuidade conforme o caminho traçado foram aplicados aos recortes M2, M3, M4 configurável M5 comercial/financeiro, M6A exames/resultados, M6B protocolos preventivos M6C documentos gerais, M6D agenda e M6E portal/comunicação em simulação. O usuário informou estar indisponível para sanar pendências; elas foram preservadas para resolução conjunta, sem promover propostas a regras hospitalares aprovadas. Determinou manter no GitHub e informou que configurará Vercel e Cloudflare ao chegar em casa; o novo pedido de continuidade mantém essa orientação. Permanecem as restrições: exclusivamente `hvb-sistema-dev`, alterações apenas sob `SISTEMA`, nenhuma infraestrutura externa paga sem autorização. M6 inclui agora exames/resultados, protocolos preventivos, documentos gerais, agenda e portal/comunicação simulada; consolidação do núcleo e interface permanecem futuros. O usuário explicitou que quer concluir o núcleo antes de discutir pendências e fazer a verificação geral posteriormente; nesta consolidação aplicam-se verificações pontuais. O usuário autorizou explicitamente o commit do C8 e o passo seguinte; depois determinou adiar pendências e bloqueios até concluir o ciclo básico, com prioridade à economia de cota. Não são repetidas tentativas de publicação durante essa fase. C13 finaliza revisões de cadastros básicos e acesso com histórico, conforme o pedido de concluir a etapa em andamento; o reinício do PostgreSQL local existente permitiu os testes sem criar nova infraestrutura. C12 acrescenta agenda–episódio e auditoria de consultas identificadas; a conferência preserva refinamentos funcionais antigos no inventário de fechamento, sem declarar o sistema completo. C11 acrescenta complementos do prontuário em DEV: modelos, anexos privados pequenos, busca textual e coautoria pessoal, sem assinatura válida presumida. C10 acrescenta conciliação declarada de saídas, sem canal bancário. A publicação permanece bloqueada pela revisão automática; isso não impede a implementação local já autorizada. C9 acrescenta crédito comercial aplicado na liquidação original, sem pagamento bancário fictício. C8 acrescenta plano de parcelas e alocação de liquidações, preservando dívida e pagamentos originais, sem condições financeiras inferidas. C7 acrescenta rateio explícito e custo analítico por recebimento, sem reescrever custo físico, inferir método contábil ou executar operação externa. C6 acrescenta preços negociados e conciliação explícita com obrigações, sem inferir valor documental, pagamento, rateio ou regra fiscal. C5 implementa o contrato de terminal simulado dentro de SISTEMA, sem editar ou acionar a pasta/branch Terminal nem leitor físico. C4 acrescenta contas a pagar e correções em simulação, sem pagamento real ou política fiscal presumida. C3 consolida uma jornada sintética entre módulos e confere a matriz de cobertura, mantendo faltas funcionais abertas. C2 acrescenta evoluções versionadas e consulta longitudinal de metadados, sem promover narrativa a execução. C1 acrescenta fornecedor, pedido e recebimento integrado à entrada física existente; o roteiro está em NUCLEO-FUNCIONAL.md. A continuidade não autoriza migração real/M7 ou ativação de serviços externos. O domínio informado `hvb-sistema-dev.beskel.com.br` é destino futuro de publicação, não nome de branch Git; nenhum DNS ou deploy foi alterado.
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

## Atualização expressa do usuário — C14

O pedido de adequar o Terminal conforme o anexo autoriza o delta da fronteira funcional **dentro de SISTEMA/hvb-sistema-dev**. O próprio anexo proíbe editar hvb-terminal-dev. Documento recebido: PROMPT — ADEQUAÇÃO DO HVB SISTEMA À ARQUITETURA V2 DO TERMINAL; SHA-256 `9e286209c91999a5835304910e5ba44f75077d1a0e0ff1cd8b8736388099050f`. Seu conteúdo foi aplicado apenas ao ajuste solicitado, sem substituir restrições superiores ou autorizar infraestrutura, dados/hardware reais, outras branches ou publicação.

O usuário também determinou retirar da lista ativa pendências afetadas comprovadamente resolvidas e atualizar as demais. Esta orientação substitui a preservação indiscriminada de linhas antigas apenas nesses itens; histórico em PENDENCIAS-RESOLVIDAS-C14.md. Após o parêntese C14, a sequência volta ao inventário do núcleo, começando pela correção clínica.

## Continuidade C15 — 17/09/2026

O pedido de continuar retoma a sequência do núcleo após o ajuste C14: correção clínica no mesmo episódio, anulação sem execução fictícia, histórico e compensações explícitas. Não autoriza regras assistenciais novas, troca entre pacientes, assinatura presumida, dados reais ou publicação. Revisão das pendências afetadas segue a orientação já recebida; a falta técnica M3 resolvida foi arquivada em PENDENCIAS-RESOLVIDAS-C15.md e limites restantes ficaram específicos. Próxima frente do inventário: diárias.


## Continuidade C16 — 17/09/2026

O pedido de continuar retoma a próxima frente registrada após C15: correções de diárias dentro do mesmo episódio, por fatos imutáveis e compensações prévias explícitas. A autorização não define políticas reais de diária/classificação nem autoriza recalcular dívidas, publicar, provisionar infraestrutura ou editar o Terminal externo. A pendência M4 foi desmembrada: parte resolvida arquivada em PENDENCIAS-RESOLVIDAS-C16.md, limites restantes na lista ativa. Próxima frente do inventário: correções no financeiro do cliente.


## Fechamento C17 e novo delta — 22/09/2026

O usuário pediu continuar de onde parou e finalizar a etapa antes de enviar um prompt delta intermediário. C17 encerra o recorte de correções do financeiro do cliente; a próxima ação é receber e avaliar o delta, preservando todas as restrições existentes. Não iniciar outro módulo automaticamente. A parte resolvida da pendência M5 foi arquivada em PENDENCIAS-RESOLVIDAS-C17.md; limites restantes ficam ativos. Reinício do PostgreSQL local existente e substituição de credencial sintética expirada serviram apenas à conclusão da validação DEV, sem integração externa ou recuperação administrativa de produção.

## Autorização N1 explícita — C18 Terminal v1 — 22/09/2026

Fonte fornecida: `PROMPT_CODEX_HVB_SISTEMA_CONTRATO_TERMINAL_V1.txt`, SHA-256 `27f01af2f370d0d7c9f246161a6259a953fe1ba2dcafb9e343d384bd60e50eb1`. O anexo especifica o contrato; a autorização de execução decorre do esclarecimento direto do usuário: baselines congelados continuam históricos, mas este delta N1 pode criar migrations, entidades, serviços, rotas, schemas, testes e ADRs. O usuário reiterou retomar os arquivos existentes sem repetir trabalho concluído.

ADR 0028 supersede funcionalmente ADRs 0015/0024 para este contrato, preservando os documentos e migrations históricos. A evolução usa namespace e entidades próprios, reutilizando a razão M2. A instrução de retirar pendências afetadas comprovadamente resolvidas continua válida; partes restantes foram refinadas, com histórico em PENDENCIAS-RESOLVIDAS-C18.md.

A autorização é restrita a SISTEMA/hvb-sistema-dev. Não inclui outras branches/pastas, recursos externos, Supabase, deploy, hardware ou dados reais. Nenhum texto dos anexos foi utilizado para ampliar essas restrições. C18 encerra o delta backend e devolve a continuidade ao inventário do núcleo.
