SET search_path=hvb,public;
CREATE OR REPLACE VIEW liquidacao_fornecedor_ativa WITH(security_invoker=true) AS SELECT l.* FROM liquidacao_fornecedor l WHERE NOT EXISTS(SELECT 1 FROM reversao_fornecedor r WHERE r.organizacao_id=l.organizacao_id AND r.liquidacao_id=l.id);
CREATE VIEW credito_fornecedor_consulta WITH(security_invoker=true) AS SELECT c.*,
 EXISTS(SELECT 1 FROM reversao_credito_fornecedor r WHERE r.organizacao_id=c.organizacao_id AND r.credito_id=c.id) AS revertido,
 (c.valor-coalesce((SELECT sum(l.valor) FROM liquidacao_fornecedor_ativa l WHERE l.organizacao_id=c.organizacao_id AND l.credito_id=c.id),0))::numeric(16,2) AS disponivel
 FROM credito_fornecedor c;
CREATE VIEW aplicacao_credito_fornecedor_consulta WITH(security_invoker=true) AS SELECT l.*,c.fornecedor_id,
 NOT EXISTS(SELECT 1 FROM liquidacao_fornecedor_ativa a WHERE a.organizacao_id=l.organizacao_id AND a.id=l.id) AS revertido
 FROM liquidacao_fornecedor l JOIN credito_fornecedor c ON c.organizacao_id=l.organizacao_id AND c.id=l.credito_id;
CREATE OR REPLACE VIEW liquidacao_parcela_consulta WITH(security_invoker=true) AS SELECT l.id,l.organizacao_id,l.unidade_id,l.autor_id,l.comando_id,l.motivo,l.criada_em,l.obrigacao_id,l.pagamento_id,l.liquidada_em,l.valor,
 NOT EXISTS(SELECT 1 FROM liquidacao_fornecedor_ativa a WHERE a.organizacao_id=l.organizacao_id AND a.id=l.id) AS revertida,
 (l.valor-coalesce((SELECT sum(a.valor) FROM alocacao_parcela_fornecedor_consulta a WHERE a.organizacao_id=l.organizacao_id AND a.liquidacao_id=l.id AND a.ativo),0))::numeric(16,2) AS nao_alocado,l.credito_id
 FROM liquidacao_fornecedor l;
CREATE FUNCTION validar_credito_fornecedor() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE c credito_fornecedor_consulta;
BEGIN
 PERFORM travar_contas_pagar(NEW.organizacao_id,NEW.unidade_id);
 IF TG_TABLE_NAME='credito_fornecedor' THEN
 IF NEW.ocorrido_em>now() OR (NEW.origem_obrigacao_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM obrigacao_fornecedor WHERE organizacao_id=NEW.organizacao_id AND unidade_id=NEW.unidade_id AND id=NEW.origem_obrigacao_id AND fornecedor_id=NEW.fornecedor_id)) THEN RAISE EXCEPTION 'Credito exige data ocorrida e fornecedor da origem' USING ERRCODE='23514';END IF;
 IF NEW.correcao_de_id IS NOT NULL THEN
 SELECT * INTO STRICT c FROM credito_fornecedor_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.correcao_de_id;
 IF NOT c.revertido OR c.unidade_id<>NEW.unidade_id OR c.fornecedor_id<>NEW.fornecedor_id OR c.documento_referencia<>NEW.documento_referencia OR c.origem<>NEW.origem OR c.origem_obrigacao_id IS DISTINCT FROM NEW.origem_obrigacao_id THEN RAISE EXCEPTION 'Correcao exige credito revertido e mesma origem documental' USING ERRCODE='23514';END IF;
 END IF;
 ELSE
 IF EXISTS(SELECT 1 FROM liquidacao_fornecedor_ativa WHERE organizacao_id=NEW.organizacao_id AND credito_id=NEW.credito_id) THEN RAISE EXCEPTION 'Reverter aplicacoes antes do credito' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER b_validar BEFORE INSERT ON credito_fornecedor FOR EACH ROW EXECUTE FUNCTION validar_credito_fornecedor();
CREATE TRIGGER b_validar BEFORE INSERT ON reversao_credito_fornecedor FOR EACH ROW EXECUTE FUNCTION validar_credito_fornecedor();
REVOKE ALL ON FUNCTION validar_credito_fornecedor() FROM PUBLIC;
CREATE OR REPLACE FUNCTION validar_contas_pagar() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE o obrigacao_fornecedor_consulta;p pagamento_fornecedor_consulta;c credito_fornecedor_consulta;
BEGIN
 PERFORM travar_contas_pagar(NEW.organizacao_id,NEW.unidade_id);
 CASE TG_TABLE_NAME
 WHEN 'obrigacao_fornecedor' THEN
 IF NEW.ocorrida_em>now() THEN RAISE EXCEPTION 'Obrigacao futura' USING ERRCODE='23514';END IF;
 IF NEW.pedido_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pedido_compra WHERE organizacao_id=NEW.organizacao_id AND unidade_id=NEW.unidade_id AND id=NEW.pedido_id AND fornecedor_id=NEW.fornecedor_id) THEN RAISE EXCEPTION 'Fornecedor diverge do pedido' USING ERRCODE='23514';END IF;
 WHEN 'pagamento_fornecedor' THEN
 IF NEW.pago_em>now() THEN RAISE EXCEPTION 'Pagamento futuro' USING ERRCODE='23514';END IF;
 WHEN 'liquidacao_fornecedor' THEN
 SELECT * INTO STRICT o FROM obrigacao_fornecedor_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.obrigacao_id;
 IF o.revertido OR o.unidade_id<>NEW.unidade_id OR NEW.valor>o.saldo OR NEW.liquidada_em>now() OR NEW.liquidada_em<o.ocorrida_em THEN RAISE EXCEPTION 'Liquidacao incompativel ou excedente' USING ERRCODE='23514';END IF;
 IF NEW.pagamento_id IS NOT NULL AND NEW.credito_id IS NULL THEN
 SELECT * INTO STRICT p FROM pagamento_fornecedor_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.pagamento_id;
 IF p.revertido OR o.fornecedor_id<>p.fornecedor_id OR p.unidade_id<>NEW.unidade_id OR NEW.valor>p.disponivel OR NEW.liquidada_em<p.pago_em THEN RAISE EXCEPTION 'Pagamento incompativel ou excedente' USING ERRCODE='23514';END IF;
 ELSIF NEW.credito_id IS NOT NULL AND NEW.pagamento_id IS NULL THEN
 SELECT * INTO STRICT c FROM credito_fornecedor_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.credito_id;
 IF c.revertido OR o.fornecedor_id<>c.fornecedor_id OR c.unidade_id<>NEW.unidade_id OR NEW.valor>c.disponivel OR NEW.liquidada_em<c.ocorrido_em THEN RAISE EXCEPTION 'Credito incompativel ou excedente' USING ERRCODE='23514';END IF;
 ELSE RAISE EXCEPTION 'Liquidacao exige uma unica fonte' USING ERRCODE='23514';END IF;
 WHEN 'reversao_fornecedor' THEN
 IF NEW.obrigacao_id IS NOT NULL THEN
 IF EXISTS(SELECT 1 FROM liquidacao_fornecedor_ativa WHERE organizacao_id=NEW.organizacao_id AND obrigacao_id=NEW.obrigacao_id) THEN RAISE EXCEPTION 'Reverter liquidacoes antes da obrigacao' USING ERRCODE='23514';END IF;
 ELSIF NEW.pagamento_id IS NOT NULL THEN
 IF EXISTS(SELECT 1 FROM liquidacao_fornecedor_ativa WHERE organizacao_id=NEW.organizacao_id AND pagamento_id=NEW.pagamento_id) THEN RAISE EXCEPTION 'Reverter liquidacoes antes do pagamento' USING ERRCODE='23514';END IF;
 END IF;
 END CASE;RETURN NEW;
END $$;
