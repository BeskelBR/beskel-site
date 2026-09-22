# Modelo consolidado — Terminal v1 C18

Migrations novas: 073 (modelo), 074 (guardas), 075 (privilégios mínimos de lock e projeção de OR após contexto expirado), 076 (composição e conservação). As migrations 001–072 e os artefatos C5/C14 permanecem históricos.

Todas as tabelas novas possuem organização, unidade, autor, comando, motivo, data de registro, RLS forçada e FKs compostas. Fatos são imutáveis. Somente projeções de sessão, status/quantidade confirmada de tarefa e encerramento de ocupação têm UPDATE restrito, com comando Terminal aberto e guardas próprias. UPDATE(id) em algumas tabelas imutáveis serve ao privilégio exigido por SELECT FOR UPDATE/SHARE; os triggers continuam recusando alterações.

## Matriz Terminal → entidade/tabela/API

Prefixo HTTP de todas as rotas abaixo: `/v1/terminal/v1`.

| Capacidade Terminal | Entidades/tabelas | API principal |
|---|---|---|
| Sala e destino em trânsito | `tv1_room`, `local` | POST/GET `/rooms` |
| Identidade do dispositivo | `tv1_device`, `dispositivo`, `credencial` | POST/GET `/devices` |
| NFC do funcionário | `tv1_nfc`, `tv1_nfc_revocation`, `usuario` | POST `/employee-nfc`, POST `/employee-nfc/:id/revoke` |
| NFC e início automático de biometria | `tv1_challenge`, `tv1_event` | POST `/nfc`, GET `/challenges/:id` |
| Biometria e AuthSession | `tv1_auth` | POST `/biometric`, GET `/auth-sessions/:id` |
| Classificação sensível | `tv1_product_policy`, `produto` | POST `/product-policies` |
| OR e origem clínica | `tv1_order`, `tv1_order_item`, `episodio`, `ordem_versao`, `programacao` | POST/GET `/withdrawal-orders`, GET `/withdrawal-order-items` |
| Contexto confirmado | `tv1_context`, `tv1_context_order`, `tv1_demand` | POST/GET `/withdrawal-contexts`, GET `/demands` |
| Coordenadas livres compatíveis | `tv1_coordinate`, `local` | POST/GET `/coordinates`, GET `/rooms/:id/free-coordinates?product_id=…` |
| Ocupação e lote físico | `tv1_occupancy`, `posicao_estoque`, `lote`, `custodia`, `recipiente` | POST/GET `/occupancies`, POST `/occupancies/:id/release` |
| Sessão física | `tv1_session` | POST `/access-sessions`, GET `/access-sessions/:id` |
| Kiosk sem pareamento manual | `tv1_session`, `tv1_device` | GET `/rooms/:id/active-session` |
| Alocação e checklist | `tv1_task`, `tv1_source`, `tv1_attempt`, `reserva` | Snapshot da sessão; POST `/access-sessions/:id/picking-events` |
| Divergências de lote/coordenada | `tv1_discrepancy`, `tv1_attempt`, `tv1_occupancy` | GET `/discrepancies`, GET `/attempts` |
| Evidências físicas | `tv1_event`, `tv1_session` | POST `/access-sessions/:id/physical-events` |
| Abertura sensível sob demanda | `tv1_event`, `tv1_session` | POST `/access-sessions/:id/sensitive-access` |
| Recuperação sem repetir retirada | `tv1_event`, `tv1_session` | POST `/access-sessions/:id/recover` |
| Fulfillment por origem e por OR | `tv1_fulfillment`; views `tv1_order_status`, `tv1_order_fulfillment` | GET `/fulfillments`, GET `/withdrawal-orders` |
| Escrituração de retirada | `tv1_movement`, `transacao_estoque`, `lancamento_estoque`, `reserva` | Automática após saída; GET `/movements` |
| Auditoria | `tv1_event`, `evento_auditoria`, `outbox`, auditoria de leitura C12 | GET `/events` e consultas existentes |

## Representações e quantidades

AuthSession e AccessSession são entidades diferentes. `employee_id`/`user_id` identificam a pessoa; `autor_id` identifica a conta que transmitiu o comando. Provisionamento vincula credencial de transporte ao dispositivo. A tag NFC não é essa credencial.

Snapshot contém `session` e `picking_tasks[]`. Sem sessão ativa, retorna `session: null` e lista vazia. A sessão expõe identificadores de organização, unidade, pessoa, autenticação, dispositivos, datas, estado e fase sensível; não existe token de sessão de acesso público.

Cada tarefa expõe `picking_task_id` (`id` é alias), produto, lote/código, `expires_at` (`expiry_date` é alias de data de validade do lote), `received_at`, coordenada, quantidade, quantidade confirmada, status, rank, estratégia, sensibilidade e `sources[]`. Validade do lote usa data civil/fuso M2; expiração de sessão usa timestamp. Tentativas e divergências preservam as posições antigas mesmo após realocação.

Quantidades usam strings decimais de até seis casas; somas e distribuição usam inteiros escalados. Estados resolvidos: CONFIRMED = quantidade integral, PARTIAL = positiva menor, UNAVAILABLE = zero. PENDING e EXCEPTION têm confirmado zero. Quantidade da oferta parcial é produzida pelo servidor a partir de um único lote, não do corpo da confirmação.

Fulfillment é imutável por demanda. OR agregada expõe `fulfillment_status` COMPLETE/PARTIAL/UNAVAILABLE e o correspondente `state` RETIRADA_CONFIRMADA/RETIRADA_PARCIAL/RETIRADA_NAO_ATENDIDA; antes do encerramento, fulfillment é nulo. Contextos expirados não duplicam nem prejudicam o agregado da OR retomada.

## Integridade

Uma sala tem no máximo uma sessão com `closed_at` nulo, inclusive após timeout com presença. Uma coordenada tem uma ocupação ativa; uma posição tem uma ocupação ativa. Guardas adicionais no M2 só se aplicam a coordenadas controladas pelo v1, impedindo uma segunda posição com saldo no mesmo local.

Alocação bloqueia posições em ordem de UUID antes de ordenar por FEFO/FIFO. Reserva usa a projeção M2. Encerramento bloqueia fontes/destinos antes de liberar reservas e transferir, com rollback integral em falha. Conservação diferida exige que fontes somem as demandas/tarefas, que toda demanda encerrada tenha fulfillment e que toda quantidade física positiva tenha movimento correspondente. Não há UPDATE direto de saldo.

O contrato executável completo está em [OpenAPI](../openapi/hvb-sistema.json); a sequência e o envelope estão em [CONTRATO-EVENTOS-TERMINAL-V1.md](CONTRATO-EVENTOS-TERMINAL-V1.md). Decisões semânticas: [ADR 0028](adr/0028-terminal-v1-canonico.md).
