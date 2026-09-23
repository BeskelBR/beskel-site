# HVB Sistema — regras de continuidade

- Trabalhar exclusivamente em SISTEMA e `hvb-sistema-dev`; preservar as outras pastas/branches do HVB e o trabalho não commitado.
- Seguir a prioridade e os critérios de aceite em [docs/PLANO-ENTREGA-SEMANA.md](docs/PLANO-ENTREGA-SEMANA.md). O usuário prioriza uma jornada utilizável nesta semana e dedica a cota ao projeto; não expandir indefinidamente o backend.
- Conferir branch, working tree, ponto de parada e, quando necessário à integração/publicação, o remoto. Reaproveitar entregas de outros chats; não supor ausência de interface com base em checkout desatualizado.
- Distinguir implementado, testado, publicado e homologado. Publicação só está concluída após confirmar o SHA remoto. Não usar force push nem descartar mudanças para integrar.
- Baselines e migrations aplicadas são históricos imutáveis; deltas explicitamente autorizados são aditivos, com supersessão documentada. Não reinterpretar C5/C14 silenciosamente.
- Preservar RBAC/RLS e as distinções entre prescrever, programar, executar, retirar, consumir, cobrar, receber e conciliar. Simuladores não constituem integração real.
- Por orientação do usuário em 23/09/2026, verificar apenas integridade a cada desenvolvimento: sintaxe, tipos, lint, diff e consistência dos contratos. Não executar testes funcionais nem automação de navegador/mouse sem nova solicitação; registrar a validação funcional para etapa posterior. Preservar testes/evidências existentes e distinguir resultados anteriores de alterações ainda não testadas. Não criar subagentes ou novos chats sem autorização explícita.
- Dados locais/sintéticos e segredos ficam privados; nunca adicionar .env, .local, banco ou credenciais ao Git. Sem recursos externos pagos, hardware, migração real ou deploy por inferência.
- Manter pendências em docs/PENDENCIAS-HVB.md. Arquivar apenas as partes afetadas comprovadamente resolvidas, preservando histórico; não converter falta de software em mera “homologação”.
