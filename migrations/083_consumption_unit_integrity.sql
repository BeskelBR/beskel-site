-- 083_consumption_unit_integrity.sql
-- Garante que referencias a consumo_item permaneçam na mesma unidade.
-- Aditiva: formaliza invariantes ja validadas pelos fluxos existentes.

SET search_path=hvb,public;

ALTER TABLE hvb.consumo_item
  ADD CONSTRAINT consumo_item_organizacao_id_unidade_id_id_key
  UNIQUE (organizacao_id, unidade_id, id);

ALTER TABLE hvb.evento_cobertura
  ADD CONSTRAINT evento_cobertura_consumo_item_mesma_unidade_fk
  FOREIGN KEY (organizacao_id, unidade_id, consumo_item_id)
  REFERENCES hvb.consumo_item(organizacao_id, unidade_id, id);

ALTER TABLE hvb.evento_cobravel
  ADD CONSTRAINT evento_cobravel_consumo_item_mesma_unidade_fk
  FOREIGN KEY (organizacao_id, unidade_id, consumo_item_id)
  REFERENCES hvb.consumo_item(organizacao_id, unidade_id, id);

ALTER TABLE hvb.vinculo_consumo_preventivo
  ADD CONSTRAINT vinculo_consumo_preventivo_mesma_unidade_fk
  FOREIGN KEY (organizacao_id, unidade_id, consumo_item_id)
  REFERENCES hvb.consumo_item(organizacao_id, unidade_id, id);
