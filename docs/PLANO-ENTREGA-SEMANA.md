# Entrega da semana e gestão de trabalho com IA

Atualizado em 22/09/2026. Estratégia de eficiência aceita pelo usuário: primeira versão utilizável, com interface e ambiente de homologação, preservando o restante do escopo como backlog. Meta de planejamento: 27/09/2026; horário final ainda não informado. A meta não equivale a promessa de operação hospitalar completa.

## Fonte de verdade e escopo

Trabalhar apenas em SISTEMA/hvb-sistema-dev. Antes de programar, conferir working tree e branch remota quando houver conectividade. O GitHub já contém frontend MVP 8 até `20fb1e5`, ainda ausente no checkout local no início desta retomada. Reutilizar essa entrega; não reconstruir interface nem concluir que algo falta com base somente em um checkout desatualizado.

Prioridade da semana: publicar C8–C18, integrar frontend existente, completar e verificar uma jornada de login → paciente/episódio → registro de atendimento → consulta de estoque/rastreabilidade da retirada, e disponibilizar ambiente de homologação. O cliente físico do Terminal continua no trabalho/branch próprios; este repositório fornece o contrato canônico e a visão administrativa.

Dados e perfis continuam sintéticos até autorização de uso real. Escritas de piloto podem usar as permissões já existentes e identidades DEV explícitas; não declarar papéis hospitalares homologados. Hospedagem paga, infraestrutura externa e credenciais reais continuam exigindo autorização específica. Não implantar banco ou API por inferência da aceitação deste plano.

## Ordem de execução e aceite

| Prioridade | Entrega | Critério de conclusão |
|---|---|---|
| 1 | Publicação consolidada | Commit local e remoto idênticos em hvb-sistema-dev; frontend remoto preservado; nenhum segredo publicado |
| 2 | Integração da interface existente | Servidor serve apenas arquivos públicos da interface; health/ready/proxy e jornadas de consulta verificadas |
| 3 | Jornada mínima utilizável | Usuário de piloto consegue entrar, localizar/cadastrar paciente, abrir episódio e registrar/consultar atendimento com RBAC e erros compreensíveis |
| 4 | Ambiente e validação integrada | Ambiente definido, sessão/autenticação adequadas ao piloto, jornada verificada no navegador; guia curto de operação |
| 5 | Correções para entrega | Corrigir bloqueadores identificados; registrar limitações restantes sem apresentá-las como concluídas |

Primeiro resolver impedimentos da jornada. Correções clínicas adicionais, fusões, transferências entre contextos, integrações bancárias, fiscal, hardware, offline permissivo e demais ampliações permanecem no backlog. Não eliminar pendências nem reinterpretar baselines para caber no prazo.

## Uso de cota e coordenação

- A cota disponível será dedicada a este projeto, conforme o usuário. Reservar aproximadamente 25% da disponibilidade restante para integração, regressões e correções finais; isso é uma regra de planejamento, não limite automático da plataforma.
- Medir cota em marcos relevantes, não a cada comando. Não prometer uma conversão fixa entre porcentagem de cota e número de execuções.
- Trabalhar em entregas agrupadas e verificáveis. Evitar alternância repetida entre refinamentos sem concluir a jornada.
- Não criar subagentes ou novos chats sem autorização explícita. Aproveitar os trabalhos já existentes através dos commits/contratos, sem enviar mensagens em nome do usuário.
- Antes de auditoria em outro chat, informar branch, SHA publicado, arquivos de contrato, teste executado e limitações. Nunca dizer “no GitHub” quando houver apenas working tree local.
- Fazer pesquisa e leitura pontuais; consultar primeiro evidências e arquivos relevantes. Evitar varreduras amplas de logs, reimpressão de OpenAPI e reconstrução de contexto já documentado.
- Executar testes direcionados por mudança. Repetir somente por alteração, falha ou risco concreto. Uma verificação integrada na versão candidata antecede a entrega; não refazer a suíte geral a cada turno.
- Sem upgrades de dependências, troca de arquitetura ou instalação de ferramentas por conveniência se as ferramentas existentes resolvem o trabalho.
- Documentar de forma curta no artefato existente. Novos relatórios somente quando acrescentam evidência, decisão ou contrato necessário.

## Evidência, segurança e limites de autonomia

Separar implementado, testado, publicado e homologado. Resultados de simulação não provam hardware, biometria real, uso clínico ou funcionamento em produção. Preservar migrations aplicadas, fatos históricos, isolamento de organização/unidade e separação entre retirar, executar, consumir e cobrar.

Não publicar .env, .local, credenciais, banco, backups ou dados reais. Verificar conflitos e proteger trabalho de outros chats; nunca usar force push ou descarte do working tree para resolver divergência. Em bloqueio de ferramenta, registrar a causa real e continuar o trabalho independente, sem repetir tentativas idênticas indefinidamente.

Novas decisões humanas permanecem na lista central de pendências. Perguntar apenas pelo que bloqueia uma ação dependente; não pedir novamente autorização já concedida. Créditos de reset não são consumidos sem a confirmação específica exigida pela plataforma.
