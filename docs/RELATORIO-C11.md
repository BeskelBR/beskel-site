# Relatório C11 — Complementos do prontuário

Data: 16/09/2026. Versão 0.20.0. Implementação local em SISTEMA/hvb-sistema-dev.

## Entrega

Modelos versionados, preenchimento estruturado na evolução original, anexos privados pequenos, busca textual por paciente e coautoria pessoal vinculada à versão/hash. Retificações preservam referências históricas. Revogações são explícitas e restritas ao próprio autor. Coautoria não equivale a assinatura válida.

Migrations 059–060: seis tabelas, quatro views, três permissões e 16 operações novas. Totais: 179 tabelas, 68 views, 115 permissões e 365 operações em 221 caminhos. Nenhuma dependência nova ou serviço externo. Comparação com C10 não encontrou diferenças nos contratos das operações anteriores. As 60 migrations coincidem com o ledger DEV; 001–052 permanecem byte a byte iguais ao último commit. Evidência: [c11-integridade.json](evidencias/c11-integridade.json).

## Verificação pontual

**31 testes aprovados:** cinco unitários, 12 do prontuário C2 e 14 dos complementos C11. Comando: pnpm check:medical-complements. Evidência: [checks-c11-focused.json](evidencias/checks-c11-focused.json). Uma primeira tentativa parou em erro de sintaxe do teste, corrigido antes da execução de integração; o recorte completo seguinte passou.

Casos: renderização exata, versões de modelo e concorrência, campos obrigatórios/desconhecidos/duplicados, rollback, respostas privadas, anexo idempotente, tamanho/MIME/base64/hash, revogação, autor autenticado, coautoria concorrente com retificação, busca atual/histórica/paginada, ACL, unidade, organização/RLS, imutabilidade e comando encerrado.

TypeScript, lint, formatação, migrations locais e OpenAPI aprovados. O lint registra uma sugestão informativa de estilo em teste, sem erro. Após acrescentar o seed, TypeScript e lint desse arquivo foram conferidos. Testes usam injeção Fastify e PostgreSQL real local; nenhum navegador ou servidor externo foi acionado. Suíte geral, carga, instalação vazia e homologação permanecem adiadas.

Seed pnpm db:seed:medical-complements executado duas vezes: mesmos registros, um preenchimento, um anexo e busca da versão esperada. Referências em .local/medical-complements-demo.json, sem credenciais e ignoradas pelo Git. Coautoria foi exercitada nos testes com segundo usuário sintético, sem ampliar perfis do cenário DEV original.

## Continuidade

Resta o grupo planejado de vínculos/auditoria para fechar a consolidação básica do backend, sujeito à conferência final da matriz. Interface, assinatura, autenticação operacional, decisões hospitalares e integrações continuam etapas próprias. O sistema não foi declarado pronto para operação.

Pendências antigas preservadas e complementadas. Publicação C8–C11 permanece adiada pelo usuário; não houve nova tentativa de alteração do Git. Último commit publicado: C7, 789ee1f26241be9e636ea0ad328d03a1cea6f04b. Nenhuma alteração em outras pastas/branches, dados reais, Terminal físico, Vercel/Cloudflare, DNS, M7 ou infraestrutura paga.

Ver [dicionário](DADOS-C11.md), [decisões](adr/0021-complementos-prontuario.md), [matriz](COBERTURA-NUCLEO.md) e [pendências](PENDENCIAS-HVB.md).
