SET search_path=hvb,public;
CREATE FUNCTION travar_pedido_compra(p_org uuid,p_pedido uuid) RETURNS void LANGUAGE sql SET search_path=hvb,pg_temp AS $$
 SELECT pg_advisory_xact_lock(hashtextextended('compra:'||p_org::text||':'||p_pedido::text,0));
$$;
CREATE VIEW pedido_compra_consulta WITH(security_invoker=true) AS SELECT p.*,coalesce((SELECT d.estado FROM decisao_pedido_compra d WHERE d.organizacao_id=p.organizacao_id AND d.pedido_id=p.id ORDER BY d.sequencia DESC LIMIT 1),'rascunho') AS situacao FROM pedido_compra p;
CREATE VIEW recebimento_compra_item_consulta WITH(security_invoker=true) AS SELECT r.*,t.destino_id AS posicao_id,t.quantidade_apresentacoes,t.quantidade_base,t.fator_snapshot,t.custo_base_snapshot,t.ocorrido_em,EXISTS(SELECT 1 FROM transacao_estoque x WHERE x.organizacao_id=t.organizacao_id AND x.reversao_de_id=t.id) AS revertido FROM recebimento_compra_item r JOIN transacao_estoque t ON t.organizacao_id=r.organizacao_id AND t.id=r.id;
CREATE VIEW item_pedido_compra_consulta WITH(security_invoker=true) AS SELECT i.*,coalesce((SELECT sum(r.quantidade_apresentacoes) FROM recebimento_compra_item_consulta r WHERE r.organizacao_id=i.organizacao_id AND r.item_pedido_id=i.id AND NOT r.revertido),0)::numeric(20,6) AS recebido_apresentacoes FROM item_pedido_compra i;
CREATE FUNCTION validar_compra() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
#variable_conflict use_column
DECLARE pedido uuid;p pedido_compra_consulta;i item_pedido_compra_consulta;r recebimento_compra;t transacao_estoque;n integer;
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'item_pedido_compra' THEN pedido:=NEW.pedido_id;
 WHEN 'decisao_pedido_compra' THEN pedido:=NEW.pedido_id;
 WHEN 'recebimento_compra' THEN pedido:=NEW.pedido_id;
 WHEN 'recebimento_compra_item' THEN SELECT * INTO STRICT r FROM recebimento_compra WHERE organizacao_id=NEW.organizacao_id AND id=NEW.recebimento_id;pedido:=r.pedido_id;
 END CASE;
 PERFORM travar_pedido_compra(NEW.organizacao_id,pedido);
 SELECT * INTO STRICT p FROM pedido_compra_consulta WHERE organizacao_id=NEW.organizacao_id AND id=pedido;
 CASE TG_TABLE_NAME
 WHEN 'item_pedido_compra' THEN
 IF NEW.comando_id<>p.comando_id THEN RAISE EXCEPTION 'Item deve integrar comando do pedido' USING ERRCODE='23514';END IF;
 WHEN 'decisao_pedido_compra' THEN
 SELECT coalesce(max(sequencia),0)+1 INTO n FROM decisao_pedido_compra WHERE organizacao_id=NEW.organizacao_id AND pedido_id=pedido;
 IF NEW.sequencia<>n OR NOT ((p.situacao='rascunho' AND NEW.estado IN ('aprovado','cancelado')) OR (p.situacao='aprovado' AND NEW.estado='cancelado')) THEN RAISE EXCEPTION 'Decisao exige estado esperado' USING ERRCODE='23514';END IF;
 WHEN 'recebimento_compra' THEN
 IF p.situacao<>'aprovado' OR NEW.ocorrido_em>now() THEN RAISE EXCEPTION 'Recebimento exige pedido aprovado e instante valido' USING ERRCODE='23514';END IF;
 WHEN 'recebimento_compra_item' THEN
 SELECT * INTO STRICT t FROM transacao_estoque WHERE organizacao_id=NEW.organizacao_id AND id=NEW.id;
 SELECT * INTO STRICT i FROM item_pedido_compra_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.item_pedido_id;
 IF p.situacao<>'aprovado' OR i.pedido_id<>pedido OR r.comando_id<>NEW.comando_id OR t.comando_id<>NEW.comando_id OR t.tipo<>'entrada' OR t.ocorrido_em<>r.ocorrido_em OR i.recebido_apresentacoes+t.quantidade_apresentacoes>i.quantidade_apresentacoes THEN RAISE EXCEPTION 'Recebimento excedente ou entrada incompativel' USING ERRCODE='23514';END IF;
 IF NOT EXISTS(SELECT 1 FROM posicao_estoque pos JOIN lote l ON l.organizacao_id=pos.organizacao_id AND l.id=pos.lote_id JOIN custodia c ON c.organizacao_id=pos.organizacao_id AND c.id=pos.custodia_id WHERE pos.organizacao_id=NEW.organizacao_id AND pos.id=t.destino_id AND pos.unidade_id=NEW.unidade_id AND l.apresentacao_id=i.apresentacao_id AND c.tipo='hospital') THEN RAISE EXCEPTION 'Apresentacao ou custodia incompativel com compra' USING ERRCODE='23514';END IF;
 END CASE;RETURN NEW;
END $$;
CREATE FUNCTION fechar_compra() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='pedido_compra' THEN
 IF NOT EXISTS(SELECT 1 FROM item_pedido_compra WHERE organizacao_id=NEW.organizacao_id AND pedido_id=NEW.id AND comando_id=NEW.comando_id) THEN RAISE EXCEPTION 'Pedido sem itens atomicos' USING ERRCODE='23514';END IF;
 ELSE
 IF NOT EXISTS(SELECT 1 FROM recebimento_compra_item WHERE organizacao_id=NEW.organizacao_id AND recebimento_id=NEW.id AND comando_id=NEW.comando_id) THEN RAISE EXCEPTION 'Recebimento sem entradas atomicas' USING ERRCODE='23514';END IF;
 END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER pedido_completo AFTER INSERT ON pedido_compra DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fechar_compra();
CREATE CONSTRAINT TRIGGER recebimento_completo AFTER INSERT ON recebimento_compra DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fechar_compra();
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['item_pedido_compra','decisao_pedido_compra','recebimento_compra','recebimento_compra_item'] LOOP EXECUTE format('CREATE TRIGGER b_validar BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION validar_compra()',t);END LOOP;END $$;
REVOKE ALL ON FUNCTION validar_compra(),fechar_compra() FROM PUBLIC;
