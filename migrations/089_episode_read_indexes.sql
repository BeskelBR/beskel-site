-- 089_episode_read_indexes.sql
-- Acelera filtros publicados por episodio em clinica e financeiro.
-- Nao altera dados, regras ou payloads.

CREATE INDEX consumo_episodio
ON hvb.consumo (organizacao_id, unidade_id, episodio_id, id);

CREATE INDEX conta_episodio
ON hvb.conta (organizacao_id, unidade_id, episodio_id, id);

CREATE INDEX evento_cobravel_episodio
ON hvb.evento_cobravel (organizacao_id, unidade_id, episodio_id, id);
