SET search_path=hvb,public;
CREATE FUNCTION travar_contas_pagar(p_org uuid,p_unidade uuid) RETURNS void LANGUAGE sql SET search_path=hvb,pg_temp AS $$
 SELECT pg_advisory_xact_lock(hashtextextended('pagar:'||p_org::text||':'||p_unidade::text,0));
$$;
CREATE VIEW liquidacao_fornecedor_ativa WITH(security_invoker=true) AS SELECT l.* FROM liquidacao_fornecedor l WHERE NOT EXISTS(SELECT 1 FROM reversao_fornecedor r WHERE r.organizacao_id=l.organizacao_id AND r.liquidacao_id=l.id);
CREATE VIEW obrigacao_fornecedor_consulta WITH(security_invoker=true) AS SELECT o.*,
 EXISTS(SELECT 1 FROM reversao_fornecedor r WHERE r.organizacao_id=o.organizacao_id AND r.obrigacao_id=o.id) AS revertido,
 (o.valor-coalesce((SELECT sum(l.valor) FROM liquidacao_fornecedor_ativa l WHERE l.organizacao_id=o.organizacao_id AND l.obrigacao_id=o.id),0))::numeric(16,2) AS saldo,
 coalesce((SELECT p.situacao='cancelado' FROM pedido_compra_consulta p WHERE p.organizacao_id=o.organizacao_id AND p.id=o.pedido_id),false) AS necessita_revisao
 FROM obrigacao_fornecedor o;
CREATE VIEW pagamento_fornecedor_consulta WITH(security_invoker=true) AS SELECT p.*,
 EXISTS(SELECT 1 FROM reversao_fornecedor r WHERE r.organizacao_id=p.organizacao_id AND r.pagamento_id=p.id) AS revertido,
 (p.valor-coalesce((SELECT sum(l.valor) FROM liquidacao_fornecedor_ativa l WHERE l.organizacao_id=p.organizacao_id AND l.pagamento_id=p.id),0))::numeric(16,2) AS disponivel FROM pagamento_fornecedor p;
CREATE FUNCTION validar_contas_pagar() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE o obrigacao_fornecedor_consulta;p pagamento_fornecedor_consulta;
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
 SELECT * INTO STRICT p FROM pagamento_fornecedor_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.pagamento_id;
 IF o.revertido OR p.revertido OR o.fornecedor_id<>p.fornecedor_id OR o.unidade_id<>NEW.unidade_id OR p.unidade_id<>NEW.unidade_id OR NEW.valor>o.saldo OR NEW.valor>p.disponivel OR NEW.liquidada_em>now() OR NEW.liquidada_em<greatest(o.ocorrida_em,p.pago_em) THEN RAISE EXCEPTION 'Liquidacao incompativel ou excedente' USING ERRCODE='23514';END IF;
 WHEN 'reversao_fornecedor' THEN
 IF NEW.obrigacao_id IS NOT NULL THEN
 IF EXISTS(SELECT 1 FROM liquidacao_fornecedor_ativa WHERE organizacao_id=NEW.organizacao_id AND obrigacao_id=NEW.obrigacao_id) THEN RAISE EXCEPTION 'Reverter liquidacoes antes da obrigacao' USING ERRCODE='23514';END IF;
 ELSIF NEW.pagamento_id IS NOT NULL THEN
 IF EXISTS(SELECT 1 FROM liquidacao_fornecedor_ativa WHERE organizacao_id=NEW.organizacao_id AND pagamento_id=NEW.pagamento_id) THEN RAISE EXCEPTION 'Reverter liquidacoes antes do pagamento' USING ERRCODE='23514';END IF;
 END IF;
 END CASE;RETURN NEW;
END $$;
CREATE TRIGGER b_validar BEFORE INSERT ON obrigacao_fornecedor FOR EACH ROW EXECUTE FUNCTION validar_contas_pagar();
CREATE TRIGGER b_validar BEFORE INSERT ON pagamento_fornecedor FOR EACH ROW EXECUTE FUNCTION validar_contas_pagar();
CREATE TRIGGER b_validar BEFORE INSERT ON liquidacao_fornecedor FOR EACH ROW EXECUTE FUNCTION validar_contas_pagar();
CREATE TRIGGER b_validar BEFORE INSERT ON reversao_fornecedor FOR EACH ROW EXECUTE FUNCTION validar_contas_pagar();
REVOKE ALL ON FUNCTION validar_contas_pagar() FROM PUBLIC;
