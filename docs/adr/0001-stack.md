# ADR 0001 — Stack de M0/M1

Status: decisão de implementação local, 13/09/2026. Não é aprovação de produção ou contratação.

Adotar Node 24, TypeScript estrito, Fastify 5, `pg` 8 e PostgreSQL 17.10. O runtime executa TypeScript pela remoção nativa de tipos; `tsc --noEmit` é obrigatório na validação. `erasableSyntaxOnly` evita sintaxe dependente de compilação. Framework e camada SQL foram escolhidos explicitamente conforme o pacote.

Fastify concentra roteamento, limite de corpo, validação JSON Schema e serialização de respostas. `@fastify/swagger` deriva OpenAPI dos schemas de runtime. `pg` fornece SQL parametrizado, pool limitado e transações inspecionáveis. Não há ORM, schema push, geração implícita de DDL, Redis ou dependência de serviço externo.

Migrations SQL são ordenadas, atômicas, versionadas por SHA-256 e protegidas por advisory lock. Arquivo já aplicado não pode ser modificado silenciosamente. Alterações posteriores geram novas migrations, incluindo as correções identificadas nesta execução. Antes de operações assistenciais reais será necessário ensaiar backup, restauração e evolução de schema em homologação.

Estrutura: `src/api` adapta HTTP; `src/domain` contém autorização, comandos, casos de uso e schemas; `src/persistence` controla pool/transação; `src/worker` processa outbox; `src/storage` define contrato privado de objetos. O registro de casos de uso da Fundação permanece coeso neste lote; cada módulo posterior ganha seu próprio diretório sem duplicar regras no cliente.

Dependências de runtime: Fastify, pg, Swagger. Dependências de qualidade: TypeScript, tipos Node/pg e Biome. Runner de testes nativo do Node. Versões diretas fixadas e transitivas congeladas no `pnpm-lock.yaml`. PostgreSQL portátil `@embedded-postgres/windows-x64` é opcional por plataforma e usado exclusivamente no DEV; o sufixo beta identifica o empacotador, enquanto o servidor executado informa PostgreSQL 17.10. No Linux, a alternativa é a imagem PostgreSQL do Compose.

Referências técnicas consultadas: [Fastify](https://fastify.dev/docs/latest/Guides/Database/), [empacotador PostgreSQL](https://www.npmjs.com/package/@embedded-postgres/windows-x64). Versões e funcionamento foram conferidos também no código instalado e em execução local.

A árvore inicial é própria, sem copiar site ou Terminal. CI manual evita executar runners automaticamente neste lote. O arquivo do Brand Book e assets oficiais permanecem preservados na referência; nenhum logo foi alterado e nenhuma tela foi construída.
