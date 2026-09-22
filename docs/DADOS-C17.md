# C17 — Contratos de correção financeira

Versão 0.26.0, concluída em 22/09/2026. Somente DEV sintético. As rotas seguem autenticação, unidade autorizada, chave de idempotência, auditoria e outbox existentes.

Todos os POST exigem unidade_id, motivo, simulacao=true e confirmacao_humana=true. Confirmações são booleanos literais; valores monetários são strings com até duas casas, sem arredondamento. Campos adicionais são recusados. A unidade deve ser a da origem.

| POST /v1/financeiro/… | Campos adicionais obrigatórios | Permissão |
|---|---|---|
| depositos/{id}/corrigir | conta_financeira_id, adquirente, referencia, depositado_em, valor, evidencia | financeiro:reverter e financeiro:conciliar |
| extrato/{id}/corrigir | conta_financeira_id, referencia, ocorrido_em, valor, evidencia | financeiro:reverter e financeiro:conciliar |
| depositos/{id}/cancelar | Nenhum | financeiro:reverter |
| extrato/{id}/cancelar | Nenhum | financeiro:reverter |
| conciliacoes/{id}/refazer | valor, evidencia | financeiro:conciliar |
| alocacoes-deposito/{id}/refazer | valor | financeiro:conciliar |

Correção retorna o ID da sucessora; cancelamento retorna o ID da revisão. Refazer retorna o novo vínculo. Para obter a revisão associada à correção, consultar a origem ou a lista de revisões. Uma nova decisão sobre origem já revisada retorna 409; repetir a chave/corpo original recupera seu resultado histórico, mesmo após revisão posterior.

| GET /v1/financeiro/… | Alteração |
|---|---|
| revisoes-depositos | Nova lista; filtro deposito_id; origem, substituta_id, tipo, autor_id, comando_id, motivo, criada_em |
| revisoes-extrato | Nova lista; filtro extrato_id; os mesmos metadados da revisão |
| depositos / extrato | Acrescentam revisao_id, substituta_id e situacao: vigente, correcao ou cancelamento |
| conciliacoes / alocacoes-deposito | Acrescentam anterior_id e revertido; filtro anterior_id; conciliações aceitam também extrato_id |
| avaliacoes | Filtro adicional anterior_id sobre a cadeia já existente |

As consultas exigem financeiro:ler e preservam paginação/unidade. Na origem revisada, nao_alocado e/ou nao_conciliado ficam zero na projeção, mas valor original não é reescrito. Somar valores de todas as linhas históricas não representa saldo disponível.

## Sequência de correção

1. Consultar alocações e conciliações do depósito/extrato, distinguindo vínculos revertidos.
2. Reverter explicitamente cada dependência ativa pelo endpoint financeiro/reversoes existente.
3. Corrigir ou cancelar a origem. A correção cria revisão e sucessora juntas; falha desfaz ambas e o comando.
4. Criar vínculos explícitos para a nova origem, se necessários. Refazer se aplica ao mesmo par e ao último vínculo revertido, não troca os alvos por sucessores automaticamente.

Referências de registros cancelados/corrigidos continuam reservadas à mesma cadeia. Para refazer o mesmo par, usar a rota refazer; enviar novamente o POST original com nova chave permanece conflito. Para trocar o par, reverter o vínculo anterior e criar o novo par explicitamente, respeitando saldos.

## Persistência e demonstração

revisao_deposito_adquirente e revisao_item_extrato têm RLS forçada, imutabilidade, origem/sucessora únicas por organização e FKs à mesma unidade. anterior_id em alocacao_deposito e vinculo_conciliacao liga o predecessor tipado e admite apenas um sucessor. Todas as guardas serializam pela trava financeira da unidade, sem chamada externa dentro da transação.

`pnpm check:financial-corrections` executa o recorte. `pnpm db:seed:financial-corrections` repete os mesmos comandos sem duplicar dados. Referências privadas sem credenciais: .local/financial-corrections-demo.json. Decisões reais e capacidades fora do recorte continuam em [PENDENCIAS-HVB.md](PENDENCIAS-HVB.md).
