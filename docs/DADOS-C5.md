# Dicionário C5 — Terminal simulado

Migrations 047–048. Quatro tabelas e duas views novas; total de 156 tabelas, 49 views, 102 permissões e 48 migrations.

| Entidade | Conteúdo |
|---|---|
| etiqueta_terminal | Código UUID fictício e alvo exclusivo paciente/posição |
| revogacao_etiqueta_terminal | Revogação imutável de uma etiqueta |
| leitura_terminal | Etiqueta, dispositivo, autor, referência deduplicável, instante e episódio escolhido |
| retirada_terminal | Leitura e mesmo ID/comando da transação física de retirada |
| etiqueta_terminal_consulta | Metadados e flag ativa |
| leitura_terminal_consulta | Metadados, IDs do alvo e flags etiqueta_ativa/utilizada |

Quatro pares POST/GET sob /v1/terminal: etiquetas, revogacoes, leituras, retiradas. Mais GET /v1/terminal/comandos/:chave. Nove operações novas; total de 313 operações em 189 caminhos.

Configurar/listar etiquetas e revogações exige terminal:configurar. Leituras/retiradas exigem terminal:usar e dispositivo no header; metadados dessas listas exigem terminal:ler. As fontes e os movimentos conservam permissões próprias. Escrever exige unidade_id, motivo, simulacao=true e confirmacao_humana=true. Um código de etiqueta nunca substitui a credencial API do operador.

| Escrita | Dados específicos |
|---|---|
| etiquetas | codigo e exatamente um entre paciente_id/posicao_id |
| revogacoes | etiqueta_id |
| leituras | codigo, referencia, ocorrida_em, episodio_id opcional |
| retiradas | leitura_id, origem_id, destino_id, quantidade_base decimal e ocorrido_em |

Listas exigem unidade e usam paginação UUID, limit até cem. Filtros presentes na entidade incluem episodio_id, posicao_id, etiqueta_id, leitura_id e dispositivo_id. Dados completos do paciente/episódio/estoque continuam nas APIs originais, sob suas permissões.

Consulta de comando exige unidade_id e X-Device-Id; a chave obedece ao mesmo formato da idempotência (8–128 caracteres). A chave é identificador, não segredo. O resultado só cobre comandos do operador atual no dispositivo indicado e não inclui o payload original.

Ver [ADR 0015](adr/0015-terminal-simulado.md) para recuperação de resposta perdida, escopo dos estados e limites da simulação.
