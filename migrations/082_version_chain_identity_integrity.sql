-- 082_version_chain_identity_integrity.sql
-- Prende anterior_id a mesma identidade logica nas cadeias versionadas restantes.
-- Aditiva: nao altera colunas, payloads ou funcoes existentes.

SET search_path=hvb,public;

ALTER TABLE hvb.agendamento_versao
  ADD CONSTRAINT agenda_ver_mesmo_agendamento_uq
  UNIQUE (organizacao_id, unidade_id, agendamento_id, id);

ALTER TABLE hvb.agendamento_versao
  ADD CONSTRAINT agenda_ver_anterior_mesmo_agendamento_fk
  FOREIGN KEY (organizacao_id, unidade_id, agendamento_id, anterior_id)
  REFERENCES hvb.agendamento_versao(organizacao_id, unidade_id, agendamento_id, id);

ALTER TABLE hvb.apresentacao
  ADD CONSTRAINT apresentacao_mesmo_codigo_uq
  UNIQUE (organizacao_id, produto_id, codigo, id);

ALTER TABLE hvb.apresentacao
  ADD CONSTRAINT apresentacao_anterior_mesmo_codigo_fk
  FOREIGN KEY (organizacao_id, produto_id, codigo, anterior_id)
  REFERENCES hvb.apresentacao(organizacao_id, produto_id, codigo, id);

ALTER TABLE hvb.avaliacao_cobranca
  ADD CONSTRAINT aval_cobranca_mesmo_evento_uq
  UNIQUE (organizacao_id, unidade_id, evento_id, id);

ALTER TABLE hvb.avaliacao_cobranca
  ADD CONSTRAINT aval_cobranca_anterior_mesmo_evento_fk
  FOREIGN KEY (organizacao_id, unidade_id, evento_id, anterior_id)
  REFERENCES hvb.avaliacao_cobranca(organizacao_id, unidade_id, evento_id, id);

ALTER TABLE hvb.plano_parcelas_fornecedor
  ADD CONSTRAINT plano_fornecedor_mesma_obrigacao_uq
  UNIQUE (organizacao_id, unidade_id, obrigacao_id, id);

ALTER TABLE hvb.plano_parcelas_fornecedor
  ADD CONSTRAINT plano_fornecedor_anterior_mesma_obrigacao_fk
  FOREIGN KEY (organizacao_id, unidade_id, obrigacao_id, anterior_id)
  REFERENCES hvb.plano_parcelas_fornecedor(organizacao_id, unidade_id, obrigacao_id, id);

ALTER TABLE hvb.precificacao_compra
  ADD CONSTRAINT precificacao_mesmo_pedido_uq
  UNIQUE (organizacao_id, unidade_id, pedido_id, id);

ALTER TABLE hvb.precificacao_compra
  ADD CONSTRAINT precificacao_anterior_mesmo_pedido_fk
  FOREIGN KEY (organizacao_id, unidade_id, pedido_id, anterior_id)
  REFERENCES hvb.precificacao_compra(organizacao_id, unidade_id, pedido_id, id);

ALTER TABLE hvb.rateio_aquisicao
  ADD CONSTRAINT rateio_mesmo_pedido_uq
  UNIQUE (organizacao_id, unidade_id, pedido_id, id);

ALTER TABLE hvb.rateio_aquisicao
  ADD CONSTRAINT rateio_anterior_mesmo_pedido_fk
  FOREIGN KEY (organizacao_id, unidade_id, pedido_id, anterior_id)
  REFERENCES hvb.rateio_aquisicao(organizacao_id, unidade_id, pedido_id, id);

ALTER TABLE hvb.revisao_atribuicao
  ADD CONSTRAINT rev_atribuicao_mesma_atribuicao_uq
  UNIQUE (organizacao_id, atribuicao_id, id);

ALTER TABLE hvb.revisao_atribuicao
  ADD CONSTRAINT rev_atribuicao_anterior_mesma_atribuicao_fk
  FOREIGN KEY (organizacao_id, atribuicao_id, anterior_id)
  REFERENCES hvb.revisao_atribuicao(organizacao_id, atribuicao_id, id);

ALTER TABLE hvb.revisao_cadastro
  ADD CONSTRAINT rev_cadastro_mesmo_alvo_uq
  UNIQUE (organizacao_id, tipo, alvo_id, id);

ALTER TABLE hvb.revisao_cadastro
  ADD CONSTRAINT rev_cadastro_anterior_mesmo_alvo_fk
  FOREIGN KEY (organizacao_id, tipo, alvo_id, anterior_id)
  REFERENCES hvb.revisao_cadastro(organizacao_id, tipo, alvo_id, id);
