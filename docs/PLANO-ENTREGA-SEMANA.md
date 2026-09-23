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

## Retomada confirmada — 22/09/2026

Prioridade 1 concluída: C8–C18 consolidados em `50200dd`, frontend remoto MVP 8 preservado no merge `1a1a404` e correção do servidor/proxy em `bea6df2`. O push para `hvb-sistema-dev` foi confirmado por `git ls-remote`: `bea6df2c8c1d4d6f741e965fe6a1726c62bda4fa`. O bloqueio anterior de publicação está resolvido; nenhuma outra branch foi alterada.

Prioridade 2 verificada no nível HTTP: três testes do servidor, TypeScript e 24 verificações com API/PostgreSQL locais passaram. Evidência: [integração HTTP](evidencias/integracao-piloto-http.json). A jornada visual no navegador ainda precisa de validação; consultas aprovadas não comprovam a jornada de escrita.

Prioridade 3 implementada e testada no piloto DEV pelo MVP 9: entrada com credencial existente, localização/cadastro de paciente, abertura de episódio e registro/leitura de evolução. Percurso verificado no navegador, inclusive releitura após reload, recusa de escrita e layout móvel. [Evidência](evidencias/piloto-mvp9.json). Esta conclusão não equivale a autenticação operacional ou homologação dos papéis.

Prioridade 4 parcial em 23/09: MVP 10 entrega sessão web local e consulta de unidades do próprio usuário. Credencial temporária inicial ainda necessária; login operacional, recuperação/MFA e ambiente hospedado continuam faltando. O usuário informou que o banco está em outro chat vinculado ao Supabase; configuração aplicada, compatibilidade com a API e hospedagem da API ainda precisam de confirmação. Isso não autoriza provisionamento. Ver [ADR 0029](adr/0029-sessao-web-piloto.md).

Próxima frente deste chat: integração do backend a partir dos contratos devolvidos pelos responsáveis por frontend e banco. A [coordenação entre chats](COORDENACAO-CHATS.md) define os limites e contém pedidos prontos para encaminhar. Frontend/sessão web pertencem ao outro chat, banco/Supabase ao respectivo responsável e Terminal permanece congelado. Não refazer C18 nem ampliar o backend sem falta concreta da jornada. Até receber os contratos, preservar os bloqueios DEV existentes e registrar as dependências; não presumir que apontar uma variável de ambiente basta para integrar o banco remoto.

## Uso de cota e coordenação

- A cota disponível será dedicada a este projeto, conforme o usuário. Reservar aproximadamente 25% da disponibilidade restante para integração, regressões e correções finais; isso é uma regra de planejamento, não limite automático da plataforma.
- Medir cota em marcos relevantes, não a cada comando. Não prometer uma conversão fixa entre porcentagem de cota e número de execuções.
- Trabalhar em entregas agrupadas e verificáveis. Evitar alternância repetida entre refinamentos sem concluir a jornada.
- Não criar subagentes ou novos chats sem autorização explícita. Aproveitar os trabalhos já existentes através dos commits/contratos, sem enviar mensagens em nome do usuário.
- Antes de auditoria em outro chat, informar branch, SHA publicado, arquivos de contrato, teste executado e limitações. Nunca dizer “no GitHub” quando houver apenas working tree local.
- Fazer pesquisa e leitura pontuais; consultar primeiro evidências e arquivos relevantes. Evitar varreduras amplas de logs, reimpressão de OpenAPI e reconstrução de contexto já documentado.
- Esclarecimento posterior do usuário em 23/09: os chats responsáveis já estão autorizados a executar testes em seus respectivos blocos. Este chat mantém integridade por desenvolvimento e evita duplicar suas execuções. A restrição anterior não deve ser encaminhada aos demais como proibição. Consolidar evidências por ambiente/escopo/SHA, preservando resultados anteriores; a validação integrada continua necessária antes de declarar homologação.
- Sem upgrades de dependências, troca de arquitetura ou instalação de ferramentas por conveniência se as ferramentas existentes resolvem o trabalho.
- Documentar de forma curta no artefato existente. Novos relatórios somente quando acrescentam evidência, decisão ou contrato necessário.

## Evidência, segurança e limites de autonomia

Separar implementado, testado, publicado e homologado. Resultados de simulação não provam hardware, biometria real, uso clínico ou funcionamento em produção. Preservar migrations aplicadas, fatos históricos, isolamento de organização/unidade e separação entre retirar, executar, consumir e cobrar.

Não publicar .env, .local, credenciais, banco, backups ou dados reais. Verificar conflitos e proteger trabalho de outros chats; nunca usar force push ou descarte do working tree para resolver divergência. Em bloqueio de ferramenta, registrar a causa real e continuar o trabalho independente, sem repetir tentativas idênticas indefinidamente.

Novas decisões humanas permanecem na lista central de pendências. Perguntar apenas pelo que bloqueia uma ação dependente; não pedir novamente autorização já concedida. Créditos de reset não são consumidos sem a confirmação específica exigida pela plataforma.
