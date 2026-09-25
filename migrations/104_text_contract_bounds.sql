
ALTER TABLE hvb.produto
  ADD CONSTRAINT produto_finalidade_check
  CHECK (
    length(finalidade) BETWEEN 1 AND 160
    AND finalidade ~ '[^[:space:]]'
  );

ALTER TABLE hvb.consumo
  ADD CONSTRAINT consumo_finalidade_check
  CHECK (
    length(finalidade) BETWEEN 1 AND 160
    AND finalidade ~ '[^[:space:]]'
  );

ALTER TABLE hvb.id_externo
  ADD CONSTRAINT id_externo_codigo_externo_check
  CHECK (
    length(codigo_externo) BETWEEN 1 AND 160
    AND codigo_externo ~ '[^[:space:]]'
  );
