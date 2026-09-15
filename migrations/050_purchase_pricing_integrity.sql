SET search_path=hvb,public;
CREATE VIEW vinculo_valor_compra_consulta WITH(security_invoker=true) AS SELECT v.*,p.pedido_id,
 NOT EXISTS(SELECT 1 FROM reversao_vinculo_compra r WHERE r.organizacao_id=v.organizacao_id AND r.vinculo_id=v.id) AND NOT EXISTS(SELECT 1 FROM reversao_fornecedor r WHERE r.organizacao_id=v.organizacao_id AND r.obrigacao_id=v.obrigacao_id) AS ativo
 FROM vinculo_valor_compra v JOIN precificacao_compra p ON p.organizacao_id=v.organizacao_id AND p.id=v.precificacao_id;
CREATE VIEW precificacao_compra_consulta WITH(security_invoker=true) AS SELECT p.*,
 NOT EXISTS(SELECT 1 FROM precificacao_compra n WHERE n.organizacao_id=p.organizacao_id AND n.pedido_id=p.pedido_id AND n.versao>p.versao) AS atual,
 coalesce((SELECT sum(v.valor) FROM vinculo_valor_compra_consulta v WHERE v.organizacao_id=p.organizacao_id AND v.pedido_id=p.pedido_id AND v.ativo),0)::numeric(16,2) AS vinculado_pedido,
 (p.total-coalesce((SELECT sum(v.valor) FROM vinculo_valor_compra_consulta v WHERE v.organizacao_id=p.organizacao_id AND v.pedido_id=p.pedido_id AND v.ativo),0))::numeric(16,2) AS saldo_vincular
 FROM precificacao_compra p;
CREATE VIEW obrigacao_valor_compra_consulta WITH(security_invoker=true) AS SELECT o.id,o.organizacao_id,o.unidade_id,o.fornecedor_id,o.pedido_id,o.valor,o.revertido,
 (o.valor-coalesce((SELECT sum(v.valor) FROM vinculo_valor_compra_consulta v WHERE v.organizacao_id=o.organizacao_id AND v.obrigacao_id=o.id AND v.ativo),0))::numeric(16,2) AS nao_vinculado
 FROM obrigacao_fornecedor_consulta o;
CREATE FUNCTION travar_valores_compra(p_org uuid,p_unidade uuid,p_pedido uuid) RETURNS void LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN PERFORM travar_contas_pagar(p_org,p_unidade);PERFORM travar_pedido_compra(p_org,p_pedido);END $$;
CREATE FUNCTION validar_valores_compra() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE pedido uuid;p pedido_compra_consulta;av precificacao_compra_consulta;ant precificacao_compra;it item_pedido_compra;o obrigacao_valor_compra_consulta;v vinculo_valor_compra_consulta;
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'precificacao_compra' THEN pedido:=NEW.pedido_id;
 WHEN 'preco_item_compra' THEN SELECT * INTO STRICT av FROM precificacao_compra_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.precificacao_id;pedido:=av.pedido_id;
 WHEN 'vinculo_valor_compra' THEN SELECT * INTO STRICT av FROM precificacao_compra_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.precificacao_id;pedido:=av.pedido_id;
 WHEN 'reversao_vinculo_compra' THEN SELECT * INTO STRICT v FROM vinculo_valor_compra_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.vinculo_id;pedido:=v.pedido_id;
 END CASE;
 PERFORM travar_valores_compra(NEW.organizacao_id,NEW.unidade_id,pedido);
 SELECT * INTO STRICT p FROM pedido_compra_consulta WHERE organizacao_id=NEW.organizacao_id AND id=pedido;
 IF p.unidade_id<>NEW.unidade_id THEN RAISE EXCEPTION 'Unidade do pedido divergente' USING ERRCODE='23514';END IF;
 CASE TG_TABLE_NAME
 WHEN 'precificacao_compra' THEN
 SELECT * INTO ant FROM precificacao_compra WHERE organizacao_id=NEW.organizacao_id AND pedido_id=pedido ORDER BY versao DESC LIMIT 1;
 IF NEW.versao<>coalesce(ant.versao,0)+1 OR NEW.anterior_id IS DISTINCT FROM ant.id OR p.situacao='cancelado' OR NEW.total<coalesce((SELECT sum(x.valor) FROM vinculo_valor_compra_consulta x WHERE x.organizacao_id=NEW.organizacao_id AND x.pedido_id=pedido AND x.ativo),0) THEN RAISE EXCEPTION 'Versao, estado ou total negociado incompativel' USING ERRCODE='23514';END IF;
 WHEN 'preco_item_compra' THEN
 SELECT * INTO STRICT it FROM item_pedido_compra WHERE organizacao_id=NEW.organizacao_id AND id=NEW.item_pedido_id;
 IF av.comando_id<>NEW.comando_id OR it.pedido_id<>pedido OR NEW.subtotal<>it.quantidade_apresentacoes*NEW.preco_apresentacao THEN RAISE EXCEPTION 'Preco exige item original, centavos exatos e comando atomico' USING ERRCODE='23514';END IF;
 WHEN 'vinculo_valor_compra' THEN
 SELECT * INTO STRICT av FROM precificacao_compra_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.precificacao_id;
 SELECT * INTO STRICT o FROM obrigacao_valor_compra_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.obrigacao_id;
 IF NOT av.atual OR o.revertido OR o.pedido_id IS DISTINCT FROM pedido OR o.fornecedor_id<>p.fornecedor_id OR o.unidade_id<>NEW.unidade_id OR NEW.valor>av.saldo_vincular OR NEW.valor>o.nao_vinculado THEN RAISE EXCEPTION 'Vinculo divergente ou excedente' USING ERRCODE='23514';END IF;
 WHEN 'reversao_vinculo_compra' THEN NULL;
 END CASE;RETURN NEW;
END $$;
CREATE FUNCTION fechar_precificacao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 IF (SELECT count(*) FROM preco_item_compra WHERE organizacao_id=NEW.organizacao_id AND precificacao_id=NEW.id)<>(SELECT count(*) FROM item_pedido_compra WHERE organizacao_id=NEW.organizacao_id AND pedido_id=NEW.pedido_id) OR NEW.total<>(SELECT coalesce(sum(subtotal),0) FROM preco_item_compra WHERE organizacao_id=NEW.organizacao_id AND precificacao_id=NEW.id)+NEW.frete+NEW.acrescimo-NEW.desconto THEN RAISE EXCEPTION 'Precificacao incompleta ou total divergente' USING ERRCODE='23514';END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER precificacao_completa AFTER INSERT ON precificacao_compra DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fechar_precificacao();
CREATE TRIGGER b_validar BEFORE INSERT ON precificacao_compra FOR EACH ROW EXECUTE FUNCTION validar_valores_compra();
CREATE TRIGGER b_validar BEFORE INSERT ON preco_item_compra FOR EACH ROW EXECUTE FUNCTION validar_valores_compra();
CREATE TRIGGER b_validar BEFORE INSERT ON vinculo_valor_compra FOR EACH ROW EXECUTE FUNCTION validar_valores_compra();
CREATE TRIGGER b_validar BEFORE INSERT ON reversao_vinculo_compra FOR EACH ROW EXECUTE FUNCTION validar_valores_compra();
REVOKE ALL ON FUNCTION validar_valores_compra(),fechar_precificacao() FROM PUBLIC;
