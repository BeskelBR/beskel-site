-- 093_document_request_episode_read_index.sql
-- Acelera solicitacoes documentais filtradas por episodio no contrato publicado.
-- Nao altera dados, regras ou payloads.

CREATE INDEX solicitacao_documento_episodio
ON hvb.solicitacao_documento (organizacao_id, unidade_id, episodio_id, id);
