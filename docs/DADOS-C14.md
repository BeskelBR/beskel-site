# Dicionário C14 — Ordem e acesso

Migrations aditivas 065–066. Todas as nove tabelas têm organização/unidade, autor, comando aberto, motivo, recebimento criada_em, RLS forçada, FKs compostas e bloqueio de UPDATE/DELETE. O paciente vem de episodio_id.

| Tabela | Fato e integridade |
|---|---|
| ordem_retirada | Solicitação do consultório; episódio da mesma unidade, aberto na criação/submit/vinculação; observação |
| item_ordem_retirada | Produto existente, quantidade decimal positiva, sensível, exige lote, observação; somente no comando de criação; produto único por ordem |
| evento_ordem_retirada | Versão sequencial; RASCUNHO, AGUARDANDO_RETIRADA, EM_SEPARACAO, CANCELADA; separação exige referência a ENTRY_CONFIRMED do mesmo comando |
| desafio_acesso | Nonce UUID único, autor/credencial/dispositivo, prazo de até 2 minutos |
| evidencia_acesso | Desafio único; hash da atestação verificada, dispositivo biométrico sintético, engine/versão, captura/expiração, fatores e modo SIMULADO_DEV |
| autenticacao_acesso | Consome uma evidência; credencial/dispositivo, nível/fatores exclusivamente DEV, prazo limitado pela evidência; a referência única fornece o status consumido |
| sessao_acesso | Consome uma autenticação; escopo fixo sensível/comum, prazo de até 15 minutos |
| sessao_ordem_retirada | Relação N ordens por sessão; mesma organização/unidade; serialização por ordem impede associação a duas sessões não encerradas e ainda válidas |
| evento_acesso | Versão/estado, referência única por dispositivo, origem SIMULADO_DEV, ocorrida_em e criada_em; ordem temporal e sequência física validadas no banco |

Views ordem_retirada_consulta e sessao_acesso_consulta projetam estado/versão. A sessão distingue expirada de encerrada_em; expiração não inventa evento de saída. Índice por unidade/ID atende a paginação de ordens; índice por ordem/sessão atende a exclusão concorrente. Consultas são paginadas, com filtros e colunas explícitas. Leituras de desafios/autenticações/sessões/eventos são limitadas ao operador, sem assinatura/hash ou credencial no contrato de resposta.

## API

Todos os caminhos abaixo têm prefixo /v1. POSTs usam Bearer e Idempotency-Key; operações /terminal/acesso também exigem X-Device-Id. GETs exigem unidade_id, aceitam limit (1–100), cursor e filtros publicados no OpenAPI. Decimais são strings, booleanos explícitos, propriedades desconhecidas rejeitadas.

| Caminho | Métodos | Permissão |
|---|---|---|
| /retiradas/ordens | POST / GET | retiradas:solicitar / retiradas:ler; criação também valida episodios:ler e estoque:ler |
| /retiradas/ordens/{id}/submit | POST | retiradas:solicitar |
| /retiradas/ordens/{id}/cancelar | POST | retiradas:solicitar; rascunho/aguardando, sem acesso válido ativo |
| /retiradas/itens e /retiradas/eventos | GET | retiradas:ler |
| /terminal/acesso/desafios | POST / GET | terminal:autenticar |
| /terminal/acesso/autenticacoes | POST / GET | terminal:autenticar |
| /terminal/acesso/sessoes | POST / GET | terminal:acessar + retiradas:ler / terminal:ler; sensível exige terminal:sensivel |
| /terminal/acesso/sessoes/{id}/eventos | POST | terminal:eventos_dev + terminal:acessar; sensível revalida terminal:sensivel |
| /terminal/acesso/vinculos e /terminal/acesso/eventos | GET | terminal:ler |

AUTHENTICATED nasce junto à sessão. Sequência: DOOR_AUTHORIZED → DOOR_OPEN → ENTRY_CONFIRMED → DOOR_CLOSED → [SENSITIVE_CABINET_AUTHORIZED → SENSITIVE_CABINET_OPEN → SENSITIVE_CABINET_CLOSED] → ACCESS_ACTIVE → EXIT → ACCESS_CLOSED. Desistência antes de abrir admite ACCESS_CLOSED após AUTHENTICATED/DOOR_AUTHORIZED. Nenhuma combinação significa retirada de material.

Conflitos de sequência/integridade retornam 409; falta de permissão/atestação, 403; schema inválido, 400; adaptador ausente, 503. O retry segue o mecanismo comum de comandos; referência repetida com outra chave conflita, enquanto mesma chave/corpo recupera resultado. Auditoria/outbox permanecem no mesmo commit. Não expor resposta de comando como ordem reutilizável a um atuador físico.

## Mobile posterior

src/domain/terminal-access/fulfillment-contract.ts prepara proposta de fulfillment e compensação separadas de acesso/transação. Não há rota gravável, tabela de fulfillment ou estado RETIRADA_CONFIRMADA/ENCERRADA neste lote. A implementação futura deve usar o domínio de estoque existente, validar o contexto corrente e gravar novos fatos para acréscimos/devoluções. Não infere administração ou cobrança.
