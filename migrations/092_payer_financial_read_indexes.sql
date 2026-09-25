-- 092_payer_financial_read_indexes.sql
-- Acelera historico financeiro filtrado por pagador/responsavel.
-- Nao altera dados, regras ou payloads.

CREATE INDEX responsabilidade_pagador
ON hvb.responsabilidade (organizacao_id, unidade_id, pagador_id, id);

CREATE INDEX titulo_pagador
ON hvb.titulo (organizacao_id, unidade_id, pagador_id, id);

CREATE INDEX recebimento_pagador
ON hvb.recebimento (organizacao_id, unidade_id, pagador_id, id);

CREATE INDEX credito_cliente_pagador
ON hvb.credito_cliente (organizacao_id, unidade_id, pagador_id, id);
