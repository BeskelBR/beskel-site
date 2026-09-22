# Relatório C15 — Correção clínica

17/09/2026. Versão 0.24.0. Recorte finalizado localmente em SISTEMA/hvb-sistema-dev, após a adequação C14 do Terminal. Auditoria: [IMPACTO-C15-CORRECAO-CLINICA.md](IMPACTO-C15-CORRECAO-CLINICA.md).

Entregues correção de executor/versão/programação no mesmo episódio, com execução sucessora, e anulação sem criar execução fictícia. Histórico, autoria da correção, estoque e documentos derivados são preservados. Consumo ativo exige estorno prévio explícito. Projeções de programação, diárias, cobrança, exames e protocolos consideram anulação; o prontuário mostra a origem não atual e o fato de revisão.

Migrations 067–068 acrescentam uma tabela, referência de anulação à resolução de pendência, função de vigência e atualização aditiva de projeções/guardas. Duas permissões, duas operações de escrita e uma consulta nova. Totais: **194 tabelas, 72 views, 127 permissões, 402 operações em 245 caminhos**. GET de execuções acrescenta anulacao_id; linha do tempo acrescenta correcao_execucao ao cursor e seus fatos. Nenhuma operação removida. As 68 migrations coincidem com os ledgers DEV/TEST; 001–052 permanecem iguais ao último commit publicado. Evidência: [c15-integridade.json](evidencias/c15-integridade.json).

## Validação

**109 testes aprovados**: cinco unitários e 104 integrados — 12 novos, 17 clínicos, 17 de diárias, 19 financeiros, 14 de exames, 13 preventivos e 12 de prontuário. Este recorte abrange os módulos afetados, não a suíte geral. Comando: pnpm check:clinical-corrections. Evidência: [checks-c15-focused.json](evidencias/checks-c15-focused.json).

Verificados: anulação sem sucessora, histórico imutável, alteração/desvinculação de programação, executor declarado distinto do autor, cadeia de retificação, consumo ativo e estorno, retry, concorrência entre decisões e consumo, RLS/RBAC, outro episódio, executor inativo, rollback atômico, programação ocupada, documentação após encerramento, origem de cobrança/cobertura/coleta/protocolo e exposição no prontuário. Testes anteriores de dívida histórica, resultados, regras e linhagem permaneceram aprovados.

A primeira execução identificou um tipo demasiado amplo no helper de teste e dois payloads de cenário incompatíveis com contratos existentes (item financeiro e identificação externa em coleta interna). Corrigidos os cenários, sem alterar contratos históricos para acomodá-los. Não houve reescrita de migration já aplicada.

TypeScript, lint, formatação, migrations e OpenAPI passaram. Permanece apenas a sugestão informativa de estilo preexistente em teste C11. Seed acrescentado depois do recorte e validado por TypeScript/lint: executado duas vezes pelos mesmos comandos, preservou exatamente duas revisões, origem/sucessora, anulação e saldo 20. Referências privadas, sem credenciais, em .local/clinical-corrections-demo.json.

## Continuidade

Pendência técnica M3 resolvida no recorte e retirada da lista ativa, com histórico em [PENDENCIAS-RESOLVIDAS-C15.md](PENDENCIAS-RESOLVIDAS-C15.md). Limites e decisões humanas continuam em [PENDENCIAS-HVB.md](PENDENCIAS-HVB.md); não se declara o sistema completo. Próxima frente: correção de associação/período de diárias.

C8–C15 continuam locais. Último commit publicado: C7, 789ee1f26241be9e636ea0ad328d03a1cea6f04b. Revisão final sem segredos locais nos arquivos alterados e sem erros de whitespace: [c15-revisao-final.json](evidencias/c15-revisao-final.json). Nenhuma nova tentativa de escrita no Git, mudança em outra branch/pasta, serviço externo, infraestrutura paga, hardware, dado real ou deploy. Publicação, instalação vazia, carga e verificação geral permanecem adiadas conforme a sequência autorizada.
