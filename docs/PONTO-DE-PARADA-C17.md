# Ponto de parada — C17 concluída

22/09/2026. O usuário solicitou finalizar a etapa em execução antes de enviar um delta intermediário. **C17 concluída; aguardar o delta e avaliar seu impacto antes de retomar o inventário.** Nenhuma implementação de exames/protocolos foi iniciada nesta etapa.

- Pasta autorizada: SISTEMA. Branch exclusiva: hvb-sistema-dev.
- Versão: 0.26.0; migrations 001–072 aplicadas e verificadas em DEV/TEST. Não reescrever migrations aplicadas; eventual próxima começa em 073.
- C17: correção/cancelamento de depósito/extrato; refazer conciliação/alocação com predecessor explícito, compensações prévias e histórico.
- Verificação: 56 testes pontuais aprovados; demonstração repetida; 198 tabelas, 75 views, 128 permissões, 416 operações/259 caminhos.
- Publicação: C8–C17 locais, index vazio; último commit publicado C7, 789ee1f26241be9e636ea0ad328d03a1cea6f04b. Bloqueio de escrita Git continua adiado. Não repetir tentativas durante o delta sem necessidade autorizada.
- PostgreSQL local existente recuperado/reiniciado. A credencial administrativa DEV expirada foi substituída por uma nova de sete dias; segredo somente no arquivo privado ignorado. Não copiar tokens para relatórios, código ou respostas.
- API e contratos em src/domain/financial-corrections, migrations 071–072, OpenAPI e DADOS-C17.md. Preservar todos os lotes locais anteriores.

Continuam posteriores: decisões hospitalares, publicação, verificação geral/instalação vazia/carga, autenticação operacional, interfaces e integrações reais. A sequência de refinamentos preservada em FECHAMENTO-CICLO-BASICO.md inclui exames/protocolos e agenda/relações; não constitui autorização para ignorar o delta que será enviado.

Revisar apenas pendências atingidas pelo delta: arquivar as comprovadamente resolvidas, atualizar as parciais e preservar as não relacionadas. Não alterar Terminal externo, outras branches/pastas, produção, DNS ou infraestrutura paga.
