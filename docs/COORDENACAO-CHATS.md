# Responsabilidades e passagem de trabalho

Decisão do usuário em 23/09/2026. Referência de código inspecionada: `hvb-sistema-dev`, `dbf59f20fb0b8b009191b76b836e2ec8b6b58fcb` (MVP 10). Este documento organiza o trabalho futuro; não altera os baselines nem comprova o estado do Supabase ou das entregas dos outros chats.

Esclarecimento posterior do usuário: os chats responsáveis já estão autorizados a executar testes. As restrições de testes anteriormente encaminhadas neste documento estão superadas para esses chats. Este chat mantém verificações de integridade por desenvolvimento, evitando repetir o trabalho dos responsáveis. Autorização não comprova execução ou aprovação; registrar evidências.

## Divisão

| Responsável | Escopo | Limite |
|---|---|---|
| Este chat de continuidade | Serviços e rotas do backend do Sistema, autorização na API, contratos de integração e pendências | Não editar frontend, banco ou Terminal; adaptações de conexão/identidade dependem do contrato dos responsáveis |
| Chat do frontend | Interface, assets, estilos, index, servidor de interface e sessão/proxy (`scripts/frontend.mjs`, `scripts/web-session.mjs`) | Consumir contratos acordados; informar necessidades de API sem alterar backend/banco/Terminal |
| Chat do banco/Supabase | Banco, migrations, estrutura, funções SQL, papéis, RLS e configuração do ambiente de banco | Preservar históricos e devolver compatibilidade/contrato; não assumir autorização para migração real ou recursos pagos |
| Terminal | Baseline congelado, inclusive módulos `terminal`, `terminal-access` e `terminal-v1` do backend | Nenhuma alteração sem novo delta explícito do usuário |
| Chat comum | Regras de negócio, textos, revisão de jornadas e contratos fornecidos, priorização e roteiros de aceite | Revisão textual não equivale à execução de testes ou à confirmação do ambiente |

Todos preservam SISTEMA, `hvb-sistema-dev`, trabalho não commitado e segredos. Arquivos compartilhados (por exemplo `package.json`, OpenAPI, registro central de rotas e esta documentação) exigem leitura do diff atual e alterações pontuais compatíveis; não regenerar contratos alheios nem sobrescrever trabalho concorrente. Uma necessidade em bloco alheio vira pedido ao responsável, não edição local por conveniência.

## Dependências verificadas no código

- `src/persistence/database.ts` recusa URLs fora de loopback e bancos diferentes de `hvb_sistema_dev/test`. O pool usa `search_path=hvb,public`; cada transação define `hvb.org` com escopo local à transação. Apenas trocar `DATABASE_URL` por uma URL remota falhará.
- `src/api/app.ts` autentica credencial opaca Bearer com 64 caracteres hexadecimais via `hvb.autenticar`, depois verifica revogação/expiração e usuário ativo. Um JWT de outro provedor não é aceito por esse contrato. A escolha do Supabase para o banco não define o provedor de login.
- `/ready` exige `current_user = hvb_app` e o registro da migration `076_terminal_v1_conservation.sql`; esta checagem não substitui auditoria de todas as migrations/RLS.
- `src/api/server.ts` restringe o servidor a loopback e recusa `NODE_ENV=production`. A adaptação de hospedagem da API é trabalho pendente deste chat após definir o ambiente; não basta remover as proteções.
- A interface MVP 10 depende do servidor de sessão/proxy na mesma origem. `/session` pertence a esse servidor; `/v1/me/contexto` pertence à API. O cookie atual foi projetado para HTTP local e não para exposição externa. Ver [ADR 0029](adr/0029-sessao-web-piloto.md) e [OpenAPI](../openapi/hvb-sistema.json).

Não foram consultados nem modificados recursos Supabase nesta etapa. Configuração do outro chat ainda precisa ser apresentada. Nenhuma pendência técnica acima foi encerrada.

## Pedidos prontos para encaminhar

### Chat do banco/Supabase

```text
HVB Sistema — alinhar contrato com o backend, sem alterar frontend nem Terminal congelado. Confira o estado atual e compare com hvb-sistema-dev, referência dbf59f20fb0b8b009191b76b836e2ec8b6b58fcb, reaproveitando o que já concluiu. Informe, sem segredos: migrations efetivamente aplicadas e divergências; disponibilidade do schema hvb, papel hvb_app, função hvb.autenticar e isolamento por hvb.org transacional; modalidade de conexão/pool, TLS e requisitos do driver pg. Diferencie configuração constatada de proposta. Esclareça se seu escopo inclui autenticação humana ou apenas banco; se houver provedor definido, descreva o vínculo de identidade com organização/usuário/permissões do HVB e a revogação, sem substituir RBAC/RLS implicitamente. Este pedido não amplia autorizações de migração ou provisionamento já existentes no seu chat. Os testes do seu bloco já estão autorizados: execute os necessários, reaproveite evidências válidas e informe ambiente, escopo, resultados e SHA quando aplicável. Devolva contrato curto, arquivos/SHA e ações que cabem ao backend. Não envie senhas, tokens nem URLs com credenciais.
```

### Chat do frontend

```text
HVB Sistema — continue sua interface preservando backend, banco e Terminal congelado. Confira working tree/branch e reaproveite MVP 10 de hvb-sistema-dev, referência dbf59f20fb0b8b009191b76b836e2ec8b6b58fcb, sem sobrescrever suas alterações posteriores. Considere /session como contrato do servidor de interface e /v1/me/contexto como API para identidade/unidades/permissões. A sessão/proxy atual depende de Node na mesma origem e só suporta HTTP loopback; assets estáticos isolados não entregam esse login. Informe o destino proposto do frontend/sessão, estratégia de login e endpoints realmente ausentes ou incompatíveis, com exemplo sintético mínimo de entrada/saída esperada. Sessão web e seu proxy ficam sob sua responsabilidade; não altere contratos do backend nem realize deploy por inferência. Os testes do seu bloco já estão autorizados: execute os necessários, reaproveite evidências válidas e informe ambiente, escopo, resultados e SHA. Devolva arquivos/SHA, dependências do backend e limitações.
```

### Chat comum

```text
HVB Sistema — revise os contratos e as pendências que vou fornecer. Organize decisões de negócio e um roteiro curto de aceite para login → paciente → episódio → evolução → consulta de estoque/rastreabilidade, cobrindo permissões, erros e duplicidade. Separe defeito de software, decisão humana e configuração; atribua cada item a backend, frontend, banco ou Terminal congelado. Não proponha alterar Terminal sem autorização. Use somente as evidências fornecidas e sinalize lacunas. Entregue uma lista priorizada e pedidos copiáveis por responsável. Não declare testes executados nem acesso ao repositório/ambiente que você não tenha.
```

Terminal não recebe tarefa neste momento. Se aparecer incompatibilidade, registrar o contrato afetado e seu impacto para o usuário decidir um delta.

## Retorno e próximo passo

O usuário encaminha os pedidos e traz as respostas; este chat não envia mensagens aos demais. Cada retorno deve conter: bloco, branch/SHA ou diff ainda local, contrato alterado, integridade conferida, pendências e ação necessária de outro responsável. Não compartilhar credenciais nem dados reais.

Com os retornos, este chat implementa somente a adaptação necessária do backend, preserva contratos legados e registra supersessão quando aplicável. Até lá, mantém as proteções locais: não inventa mapeamento de identidade, não escolhe hospedagem e não reabre módulos completos para gerar atividade.

A cada mudança deste chat executar integridade pertinente (tipos, sintaxe/lint dos arquivos afetados, diff e consistência de contrato). Os outros chats executam os testes já autorizados em seus blocos e devolvem evidências; evitar duplicação. Não usar `scripts/check.mjs` como se fosse apenas verificação estática: ele agrega outras etapas. Documentação sem alteração de código requer conferir links/diff, não repetir a suíte.

Revisões textuais e preparação de roteiros podem ser feitas no chat comum. Executar testes exige ferramentas e acesso ao ambiente apropriado; esta divisão não garante ausência de consumo de cota. Resultados funcionais anteriores permanecem históricos e a validação final segue pendente em [PENDENCIAS-HVB.md](PENDENCIAS-HVB.md).
