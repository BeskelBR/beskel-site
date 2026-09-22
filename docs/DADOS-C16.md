# C16 — Contratos de correção de diárias

Versão 0.25.0. Somente simulação DEV; OpenAPI gerado da API é a descrição executável.

| Operação | Corpo específico, além de motivo/confirmacao_humana/simulacao |
|---|---|
| POST /v1/diarias/pacotes-episodio/{id}/corrigir | pacote_versao_id, inicio, fim |
| POST /v1/diarias/pacotes-episodio/{id}/cancelar | Nenhum |
| POST /v1/diarias/periodos/{id}/corrigir | pacote_episodio_id, classificacao_episodio_id, inicio, fim |
| POST /v1/diarias/periodos/{id}/cancelar | Nenhum |

Todos os campos são obrigatórios. `classificacao_episodio_id` aceita UUID ou null explícito; o pacote pode exigir classificação, caso em que null é rejeitado. Não há inferência da classificação. Datas têm fuso explícito e obedecem às regras M4. `confirmacao_humana` e `simulacao` são booleanos true; texto "true" é recusado. Motivo admite até 160 caracteres e não pode ser vazio. Campos adicionais são recusados.

As quatro operações exigem `diarias:corrigir` na unidade da origem. Correção exige também `diarias:associar`. O comando conserva idempotência, auditoria e outbox. Em correção, `id` na resposta é a sucessora; em cancelamento, é a revisão. A consulta da revisão fornece ambos os vínculos. Origem já revisada gera 409 em um novo comando; repetição do mesmo comando recupera seu resultado original.

| Consulta | Conteúdo e filtro específico |
|---|---|
| GET /v1/diarias/revisoes-pacotes-episodio | revisao_pacote_episodio; filtro pacote_episodio_id |
| GET /v1/diarias/revisoes-periodos | revisao_periodo_diaria; filtro periodo_diaria_id |

Consultas exigem `diarias:ler`, unidade autorizada, paginação e filtros já convencionados; aceitam também episodio_id. Retornam id, unidade_id, episodio_id, origem tipada, substituta_id, tipo (`correcao`/`cancelamento`), autor_id, comando_id, motivo e criada_em. As duas listas originais acrescentam revisao_id, substituta_id e situacao (`vigente`, `correcao`, `cancelamento`). `necessita_revisao` permanece booleano na lista de períodos. Consultar uma linha histórica não significa que esteja vigente.

## Persistência e sequência operacional DEV

`revisao_pacote_episodio` e `revisao_periodo_diaria` têm RLS forçada, inserção autorizada e bloqueio de UPDATE/DELETE. Origem e sucessora são únicas por organização, com vínculos à mesma unidade/episódio; autoria e comando são tipados. FKs diferidas conferem a sucessora criada no mesmo comando. Registros originais permanecem imutáveis.

Para corrigir período: liberar/expirar reservas, reverter cobertura, reverter documentos financeiros dependentes pelas operações próprias e então corrigir. Reverter cobertura não reverte um item financeiro, inclusive de valor zero. Reavaliar os eventos usando a sucessora é outra decisão explícita. Para corrigir associação: tratar/cancelar seus períodos primeiro, corrigir a associação e criar os novos períodos desejados. Não há migração automática entre associações.

Sem dependências ativas, datas passadas podem ser corrigidas conforme os limites temporais existentes. O fuso vem da unidade. Um intervalo não pode sobrepor outro vigente do mesmo episódio; intervalos apenas históricos podem coincidir. A origem revisada não pode voltar a servir como período válido por uma chamada antiga de criação/avaliação.

Seed: `pnpm db:seed:daily-corrections`; referências sem credenciais em `.local/daily-corrections-demo.json`. Recorte: `pnpm check:daily-corrections`. Limitações e decisões posteriores em [PENDENCIAS-HVB.md](PENDENCIAS-HVB.md).
