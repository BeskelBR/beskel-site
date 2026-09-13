# Dicionário M4 — Diária configurável

Migrations 014–016 acrescentam 16 tabelas ao schema `hvb` (62 tabelas de domínio no conjunto M1–M4) e quatro views (nove no conjunto). Todas as tabelas novas têm organização, RLS forçada e FKs tipadas; contextos de internação carregam unidade e episódio. IDs são UUID. Quantidades usam decimal exato, exposto como string na API.

| Tabela | Responsabilidade |
|---|---|
| `medicao_peso` | Quantidade positiva, unidade de massa, episódio, horário, autor e motivo; referência clínica, sem faixa inferida |
| `classificacao_versao` | Código, versão consecutiva e descrição imutáveis |
| `classificacao_episodio` | Classe e vigência sem sobreposição; peso/execução referenciados quando informados; suporte ventilatório explícito; encerramento único |
| `grupo_cobertura_versao` | Identidade e versão consecutiva do grupo |
| `membro_grupo_cobertura` | Item clínico tipado, único no grupo; grupo congelado após aprovação de pacote que o referencia |
| `pacote_versao` | Classe opcional, políticas temporais explícitas e marcador obrigatório de simulação |
| `regra_pacote` | Um alvo entre item clínico, grupo ou produto; dimensão, janela, prioridade, tratamento, limite/unidade e política de excedente |
| `aprovacao_pacote` | Autor, motivo e confirmação de simulação; congela regras e exige configuração completa |
| `pacote_episodio` | Pacote aprovado associado à internação em intervalo explícito, sem sobreposição |
| `periodo_diaria` | Intervalo e fuso dentro da associação; classificação compatível quando exigida |
| `evento_cobertura` | Origem única: execução OU item de consumo; snapshots conferidos de episódio, item/produto, quantidade e horário |
| `uso_cobertura` | Agrupamento único pacote/regra/janela; período nulo somente na janela por episódio |
| `reserva_cobertura` | Evento, uso, período, quantidade, validade e encerramento motivado; uma reserva ativa por evento |
| `avaliacao_cobertura` | Versão consecutiva, anterior, origem, período, uso, resultado, justificativa, autor e comando; não monetária |
| `reversao_cobertura` | Compensação única de avaliação, com autor e motivo; preserva o registro original |
| `alocacao_cobertura` | Quantidade, parcela incluída e excedente por avaliação; soma exata e decisão conferidas no banco |

Views publicadas internamente e usadas pelos endpoints:

- `evento_cobertura_consulta`: origem ativa, execução integral e material do tutor.
- `periodo_diaria_consulta`: necessidade de revisão por classificação, referência retificada ou encerramento.
- `alocacao_cobertura_ativa`: alocações não revertidas e identidade clínica para contagem de distintos.
- `avaliacao_cobertura_consulta`: resultado original, quantidades, regra e situação atual; reversão e revisão são distintas.

As funções `regras_cobertura` e `regra_cobertura_vigente` selecionam regras elegíveis e exigem prioridade máxima única. `compromisso_cobertura` calcula a quantidade comprometida ou o conjunto de itens distintos nas alocações ativas e reservas. Dois eventos do mesmo item distinto compartilham capacidade; reverter um não libera a identidade ainda usada pelo outro.

Triggers conferem contexto, congelamento, versões, janela, origem e decisão exata. Reserva, avaliação e reversão serializam pela linha do episódio, na mesma ordem usada pela clínica. Constraints diferidas exigem alocação coerente e avaliação para reserva efetivada. Auditoria, outbox e resultado do comando confirmam junto com o domínio.

Permissões: `diarias:ler`, `diarias:configurar`, `diarias:aprovar_simulacao`, `diarias:classificar`, `diarias:associar`, `diarias:avaliar`, `diarias:reservar`, `diarias:reverter`. Reavaliar uma avaliação ainda ativa exige também reversão. Papéis reais permanecem pendentes.

Referências: [OpenAPI](../openapi/hvb-sistema.json), [ADR 0005](adr/0005-diaria-configuravel.md) e [limites M4](RELATORIO-M4.md).
