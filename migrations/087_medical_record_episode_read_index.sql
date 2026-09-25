-- 087_medical_record_episode_read_index.sql
-- Acelera leitura de evolucoes por episodio no contrato publicado do prontuario.
-- Nao altera dados, regras ou payloads.

CREATE INDEX evolucao_clinica_episodio
ON hvb.evolucao_clinica (organizacao_id, unidade_id, episodio_id, id);
