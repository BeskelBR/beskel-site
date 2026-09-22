# Relatório C13 — Cadastros e acesso

Data: 16/09/2026. Versão 0.22.0. Etapa de revisões cadastrais e de atribuições finalizada localmente em SISTEMA/hvb-sistema-dev.

Entregues revisão de pacientes, responsáveis, usuários, unidades, dispositivos e nome/capacidade de locais; revogação/restauração de atribuições; consulta de valores atuais e histórico, versão esperada, motivo, idempotência e controle de concorrência. IDs originais permanecem estáveis. Redução de capacidade protege vagas ainda ocupadas. Revogar espera operações já autorizadas terminarem e afeta as seguintes.

Migrations 063–064: duas tabelas, uma view, duas permissões e 14 operações novas. Totais: 184 tabelas, 70 views, 119 permissões e 384 operações em 231 caminhos. GET /atribuicoes acrescentou ativo/versao; demais contratos anteriores preservados. As 64 migrations coincidem com os ledgers DEV/TEST; 001–052 coincidem com o último commit publicado. Evidência: [c13-integridade.json](evidencias/c13-integridade.json).

## Verificação pontual

**43 testes aprovados:** cinco unitários, 15 da fundação, 12 de vínculos/auditoria e 11 novos de cadastros/acesso. Evidência: [checks-c13-focused.json](evidencias/checks-c13-focused.json), comando pnpm check:registry.

Casos: histórico antes/depois, vínculo estável com episódio, retry, concorrência, alteração vazia/inválida, unicidade de login, preservação de credenciais/unidade, capacidade versus vaga aberta/histórica, RBAC/unidade/organização, SQL sem UPDATE cadastral, comando encerrado, rollback após atualizar cadastro, revogação/restauração, transições concorrentes e serialização com operação autorizada em andamento.

Uma tentativa inicial parou em sintaxe do teste, corrigida antes de integração. O banco estava parado: o comando restrito não pôde iniciá-lo por erro de token do Windows; a execução autorizada fora dessa restrição iniciou o cluster existente, que realizou recuperação automática. Nenhum banco foi recriado. A primeira execução de integração encontrou uma fragilidade temporal no teste C12 de paginação; o teste agora usa usuário sintético exclusivo, evitando perda na fronteira de milissegundos. O recorte seguinte passou integralmente. Não foi necessário alterar as migrations já aplicadas.

TypeScript, lint, formatação, migrations e OpenAPI aprovados; continua apenas a sugestão informativa de estilo preexistente em teste C11. Seed acrescentado e conferido por TypeScript/lint; executado duas vezes, preservou uma revisão de paciente, uma de capacidade e duas transições de uma atribuição própria. Não alterou os papéis originais dos usuários DEV. Referências em .local/registry-corrections-demo.json, ignoradas pelo Git e sem credenciais.

## Encerramento desta etapa

C13 fecha o recorte definido de cadastros/acesso. Limites adicionais de cadastro e governança continuam registrados; não há declaração de completude integral do produto. A próxima frente do inventário é correção clínica, a ser tratada em outro bloco. Suíte geral, instalação vazia, carga, pendências humanas e publicação continuam posteriores conforme o usuário.

C8–C13 permanecem locais; último commit publicado C7, 789ee1f26241be9e636ea0ad328d03a1cea6f04b. Não houve tentativa de escrita no Git, mudança em outras branches/pastas, acesso a dados reais, Terminal físico, SimplesVet/M7, Vercel/Cloudflare/DNS, mensagens externas ou infraestrutura paga.

Ver [dicionário](DADOS-C13.md), [decisões/limites](adr/0023-revisoes-cadastros-acesso.md) e [inventário de continuidade](FECHAMENTO-CICLO-BASICO.md).
