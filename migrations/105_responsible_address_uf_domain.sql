
ALTER TABLE hvb.responsavel
  DROP CONSTRAINT responsavel_uf_check,
  ADD CONSTRAINT responsavel_uf_check
  CHECK (
    uf IS NULL OR uf IN (
      'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
      'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC',
      'SP','SE','TO'
    )
  );
