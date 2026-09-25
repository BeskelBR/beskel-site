-- 081_exam_result_collection_integrity.sql
-- Garante que o resultado de exame use coleta pertencente ao mesmo item_exame.
-- Aditiva: preserva contratos e relacionamentos existentes.

SET search_path=hvb,public;

ALTER TABLE hvb.coleta_exame
  ADD CONSTRAINT coleta_exame_mesmo_item_uq
  UNIQUE (organizacao_id, unidade_id, item_exame_id, id);

ALTER TABLE hvb.resultado_versao
  ADD CONSTRAINT resultado_versao_coleta_mesmo_item_fk
  FOREIGN KEY (organizacao_id, unidade_id, item_exame_id, coleta_id)
  REFERENCES hvb.coleta_exame(organizacao_id, unidade_id, item_exame_id, id);
