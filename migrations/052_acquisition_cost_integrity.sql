SET search_path=hvb,public;
CREATE VIEW custo_recebimento_consulta WITH(security_invoker=true) AS SELECT c.*,i.rateio_id,i.item_pedido_id,a.pedido_id,r.recebimento_id,r.posicao_id,r.quantidade_apresentacoes,r.quantidade_base,r.revertido AS recebimento_revertido,
 NOT r.revertido AND NOT EXISTS(SELECT 1 FROM reversao_custo_recebimento x WHERE x.organizacao_id=c.organizacao_id AND x.custo_recebimento_id=c.id) AS ativo
 FROM custo_recebimento c JOIN item_rateio_aquisicao i ON i.organizacao_id=c.organizacao_id AND i.id=c.item_rateio_id JOIN rateio_aquisicao a ON a.organizacao_id=i.organizacao_id AND a.id=i.rateio_id JOIN recebimento_compra_item_consulta r ON r.organizacao_id=c.organizacao_id AND r.id=c.recebimento_item_id;
CREATE VIEW item_rateio_aquisicao_consulta WITH(security_invoker=true) AS SELECT i.*,p.quantidade_apresentacoes,
 coalesce(v.valor,0)::numeric(16,2) AS valor_atribuido,(i.total-coalesce(v.valor,0))::numeric(16,2) AS saldo_atribuir,
 coalesce(v.quantidade,0)::numeric(20,6) AS quantidade_avaliada,(p.quantidade_apresentacoes-coalesce(v.quantidade,0))::numeric(20,6) AS quantidade_pendente
 FROM item_rateio_aquisicao i JOIN item_pedido_compra p ON p.organizacao_id=i.organizacao_id AND p.id=i.item_pedido_id
 LEFT JOIN LATERAL(SELECT sum(c.valor) valor,sum(c.quantidade_apresentacoes) quantidade FROM custo_recebimento_consulta c WHERE c.organizacao_id=i.organizacao_id AND c.item_rateio_id=i.id AND c.ativo) v ON true;
CREATE VIEW rateio_aquisicao_consulta WITH(security_invoker=true) AS SELECT a.*,p.total,p.atual AS preco_atual,
 NOT EXISTS(SELECT 1 FROM rateio_aquisicao x WHERE x.organizacao_id=a.organizacao_id AND x.pedido_id=a.pedido_id AND x.versao>a.versao) AS atual
 FROM rateio_aquisicao a JOIN precificacao_compra_consulta p ON p.organizacao_id=a.organizacao_id AND p.id=a.precificacao_id;
CREATE FUNCTION validar_custo_aquisicao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE pedido uuid;a rateio_aquisicao_consulta;ant rateio_aquisicao;p precificacao_compra_consulta;i item_rateio_aquisicao_consulta;r recebimento_compra_item_consulta;c custo_recebimento_consulta;preco preco_item_compra;
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'rateio_aquisicao' THEN pedido:=NEW.pedido_id;
 WHEN 'item_rateio_aquisicao' THEN SELECT * INTO STRICT a FROM rateio_aquisicao_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.rateio_id;pedido:=a.pedido_id;
 WHEN 'custo_recebimento' THEN SELECT * INTO STRICT i FROM item_rateio_aquisicao_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.item_rateio_id;SELECT * INTO STRICT a FROM rateio_aquisicao_consulta WHERE organizacao_id=NEW.organizacao_id AND id=i.rateio_id;pedido:=a.pedido_id;
 WHEN 'reversao_custo_recebimento' THEN SELECT * INTO STRICT c FROM custo_recebimento_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.custo_recebimento_id;pedido:=c.pedido_id;
 END CASE;
 PERFORM travar_pedido_compra(NEW.organizacao_id,pedido);
 IF NOT EXISTS(SELECT 1 FROM pedido_compra WHERE organizacao_id=NEW.organizacao_id AND unidade_id=NEW.unidade_id AND id=pedido) THEN RAISE EXCEPTION 'Unidade do custo divergente' USING ERRCODE='23514';END IF;
 CASE TG_TABLE_NAME
 WHEN 'rateio_aquisicao' THEN
 SELECT * INTO STRICT p FROM precificacao_compra_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.precificacao_id;
 SELECT * INTO ant FROM rateio_aquisicao WHERE organizacao_id=NEW.organizacao_id AND pedido_id=pedido ORDER BY versao DESC LIMIT 1;
 IF p.pedido_id<>pedido OR NOT p.atual OR NEW.versao<>coalesce(ant.versao,0)+1 OR NEW.anterior_id IS DISTINCT FROM ant.id OR EXISTS(SELECT 1 FROM custo_recebimento_consulta x WHERE x.organizacao_id=NEW.organizacao_id AND x.pedido_id=pedido AND x.ativo) THEN RAISE EXCEPTION 'Rateio exige preco atual, versao esperada e custos anteriores revertidos' USING ERRCODE='23514';END IF;
 WHEN 'item_rateio_aquisicao' THEN
 SELECT * INTO STRICT preco FROM preco_item_compra WHERE organizacao_id=NEW.organizacao_id AND precificacao_id=a.precificacao_id AND item_pedido_id=NEW.item_pedido_id;
 IF a.comando_id<>NEW.comando_id OR NEW.subtotal<>preco.subtotal THEN RAISE EXCEPTION 'Rateio exige item original e comando atomico' USING ERRCODE='23514';END IF;
 WHEN 'custo_recebimento' THEN
 SELECT * INTO STRICT r FROM recebimento_compra_item_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.recebimento_item_id;
 -- Same lock order as purchase receipt: order, then stock position. Reversal uses the position lock.
 PERFORM id FROM posicao_estoque WHERE organizacao_id=NEW.organizacao_id AND id=r.posicao_id FOR UPDATE;
 SELECT * INTO STRICT r FROM recebimento_compra_item_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.recebimento_item_id;
 SELECT * INTO STRICT a FROM rateio_aquisicao_consulta WHERE organizacao_id=NEW.organizacao_id AND id=i.rateio_id;
 SELECT * INTO STRICT i FROM item_rateio_aquisicao_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.item_rateio_id;
 IF NOT a.atual OR r.revertido OR r.item_pedido_id<>i.item_pedido_id OR r.unidade_id<>NEW.unidade_id OR NEW.valor>i.saldo_atribuir OR r.quantidade_apresentacoes>i.quantidade_pendente OR EXISTS(SELECT 1 FROM custo_recebimento_consulta x WHERE x.organizacao_id=NEW.organizacao_id AND x.recebimento_item_id=NEW.recebimento_item_id AND x.ativo) THEN RAISE EXCEPTION 'Custo exige recebimento vigente unico, item e saldo compativeis' USING ERRCODE='23514';END IF;
 IF r.quantidade_apresentacoes=i.quantidade_pendente AND NEW.valor<>i.saldo_atribuir THEN RAISE EXCEPTION 'Ultimo recebimento deve fechar custo integral do item' USING ERRCODE='23514';END IF;
 WHEN 'reversao_custo_recebimento' THEN NULL;
 END CASE;RETURN NEW;
END $$;
CREATE FUNCTION fechar_rateio_aquisicao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE p precificacao_compra;n bigint;f numeric;ac numeric;d numeric;t numeric;
BEGIN
 SELECT * INTO STRICT p FROM precificacao_compra WHERE organizacao_id=NEW.organizacao_id AND id=NEW.precificacao_id;
 SELECT count(*),coalesce(sum(frete),0),coalesce(sum(acrescimo),0),coalesce(sum(desconto),0),coalesce(sum(total),0) INTO n,f,ac,d,t FROM item_rateio_aquisicao WHERE organizacao_id=NEW.organizacao_id AND rateio_id=NEW.id;
 IF n<>(SELECT count(*) FROM preco_item_compra WHERE organizacao_id=NEW.organizacao_id AND precificacao_id=NEW.precificacao_id) OR f<>p.frete OR ac<>p.acrescimo OR d<>p.desconto OR t<>p.total THEN RAISE EXCEPTION 'Rateio incompleto ou componentes divergentes' USING ERRCODE='23514';END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER rateio_completo AFTER INSERT ON rateio_aquisicao DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fechar_rateio_aquisicao();
CREATE TRIGGER b_validar BEFORE INSERT ON rateio_aquisicao FOR EACH ROW EXECUTE FUNCTION validar_custo_aquisicao();
CREATE TRIGGER b_validar BEFORE INSERT ON item_rateio_aquisicao FOR EACH ROW EXECUTE FUNCTION validar_custo_aquisicao();
CREATE TRIGGER b_validar BEFORE INSERT ON custo_recebimento FOR EACH ROW EXECUTE FUNCTION validar_custo_aquisicao();
CREATE TRIGGER b_validar BEFORE INSERT ON reversao_custo_recebimento FOR EACH ROW EXECUTE FUNCTION validar_custo_aquisicao();
REVOKE ALL ON FUNCTION validar_custo_aquisicao(),fechar_rateio_aquisicao() FROM PUBLIC;
