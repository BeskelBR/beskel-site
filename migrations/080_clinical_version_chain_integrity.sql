-- 080_clinical_version_chain_integrity.sql
-- Garante que anterior_id permaneça na mesma entidade logica em cadeias versionadas clinicas.
-- Aditiva: preserva FKs, payloads e contratos existentes.

SET search_path=hvb,public;

ALTER TABLE hvb.evolucao_clinica_versao
  ADD CONSTRAINT ev_versao_mesma_evolucao_uq
  UNIQUE (organizacao_id, unidade_id, evolucao_id, id);

ALTER TABLE hvb.evolucao_clinica_versao
  ADD CONSTRAINT ev_versao_anterior_mesma_evolucao_fk
  FOREIGN KEY (organizacao_id, unidade_id, evolucao_id, anterior_id)
  REFERENCES hvb.evolucao_clinica_versao(organizacao_id, unidade_id, evolucao_id, id);

ALTER TABLE hvb.documento_versao
  ADD CONSTRAINT doc_versao_mesma_solicitacao_uq
  UNIQUE (organizacao_id, unidade_id, solicitacao_id, id);

ALTER TABLE hvb.documento_versao
  ADD CONSTRAINT doc_versao_anterior_mesma_solicitacao_fk
  FOREIGN KEY (organizacao_id, unidade_id, solicitacao_id, anterior_id)
  REFERENCES hvb.documento_versao(organizacao_id, unidade_id, solicitacao_id, id);

ALTER TABLE hvb.resultado_versao
  ADD CONSTRAINT resultado_versao_mesmo_item_uq
  UNIQUE (organizacao_id, unidade_id, item_exame_id, id);

ALTER TABLE hvb.resultado_versao
  ADD CONSTRAINT resultado_versao_anterior_mesmo_item_fk
  FOREIGN KEY (organizacao_id, unidade_id, item_exame_id, anterior_id)
  REFERENCES hvb.resultado_versao(organizacao_id, unidade_id, item_exame_id, id);

ALTER TABLE hvb.modelo_evolucao_versao
  ADD CONSTRAINT modelo_ev_versao_mesmo_codigo_uq
  UNIQUE (organizacao_id, unidade_id, codigo, id);

ALTER TABLE hvb.modelo_evolucao_versao
  ADD CONSTRAINT modelo_ev_versao_anterior_mesmo_codigo_fk
  FOREIGN KEY (organizacao_id, unidade_id, codigo, anterior_id)
  REFERENCES hvb.modelo_evolucao_versao(organizacao_id, unidade_id, codigo, id);
