SET search_path=hvb,public;
ALTER TABLE transacao_estoque DROP CONSTRAINT transacao_estoque_tipo_check;
ALTER TABLE transacao_estoque ADD CHECK(tipo IN ('entrada','transferencia','retirada','devolucao','perda','ajuste','reversao','consumo'));
ALTER TABLE transacao_estoque DROP CONSTRAINT transacao_estoque_contrapartida_check;
ALTER TABLE transacao_estoque ADD CHECK(contrapartida IN ('externo','perda','ajuste','consumido'));

CREATE FUNCTION validar_prescricao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE ep episodio;
BEGIN
 SELECT * INTO STRICT ep FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=NEW.episodio_id FOR UPDATE;
 IF NEW.assinada_em>now() OR NEW.assinada_em<ep.admitido_em OR NEW.assinada_em>=least(ep.alta_clinica_em,ep.encerrado_em) THEN RAISE EXCEPTION 'Assinatura fora do episodio' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER prescricao_validar BEFORE INSERT ON prescricao FOR EACH ROW EXECUTE FUNCTION validar_prescricao();

CREATE FUNCTION validar_ordem_versao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE anterior ordem_versao; ep episodio; pr prescricao;
BEGIN
 SELECT * INTO STRICT ep FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=NEW.episodio_id FOR UPDATE;
 PERFORM pg_advisory_xact_lock(hashtextextended('ordem:'||NEW.organizacao_id::text||':'||NEW.ordem_id::text,0));
 SELECT p.* INTO STRICT pr FROM prescricao p JOIN ordem o ON o.organizacao_id=p.organizacao_id AND o.prescricao_id=p.id WHERE o.organizacao_id=NEW.organizacao_id AND o.id=NEW.ordem_id;
 SELECT * INTO anterior FROM ordem_versao WHERE organizacao_id=NEW.organizacao_id AND ordem_id=NEW.ordem_id ORDER BY versao DESC LIMIT 1;
 IF NEW.versao<>coalesce(anterior.versao,0)+1 OR NEW.vigencia_inicio<pr.assinada_em OR NEW.vigencia_inicio>=least(ep.alta_clinica_em,ep.encerrado_em) OR
 (anterior.id IS NOT NULL AND NEW.vigencia_inicio<=anterior.vigencia_inicio) OR EXISTS(
 SELECT 1 FROM execucao e JOIN ordem_versao v ON v.organizacao_id=e.organizacao_id AND v.id=e.ordem_versao_id
 WHERE v.organizacao_id=NEW.organizacao_id AND v.ordem_id=NEW.ordem_id AND e.executada_em>=NEW.vigencia_inicio) THEN
 RAISE EXCEPTION 'Versao ou vigencia incompativel com historico' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ordem_versao_validar BEFORE INSERT ON ordem_versao FOR EACH ROW EXECUTE FUNCTION validar_ordem_versao();

CREATE FUNCTION validar_programacao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE v ordem_versao; ep episodio;
BEGIN
 SELECT * INTO STRICT ep FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=NEW.episodio_id FOR UPDATE;
 SELECT * INTO STRICT v FROM ordem_versao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.ordem_versao_id;
 PERFORM pg_advisory_xact_lock(hashtextextended('ordem:'||NEW.organizacao_id::text||':'||v.ordem_id::text,0));
 IF TG_OP='INSERT' THEN
 IF NEW.situacao<>'prevista' OR NEW.prevista_em<v.vigencia_inicio OR NEW.prevista_em>=v.vigencia_fim OR NEW.prevista_em>=least(ep.alta_clinica_em,ep.encerrado_em) OR EXISTS(
 SELECT 1 FROM ordem_versao WHERE organizacao_id=NEW.organizacao_id AND ordem_id=v.ordem_id AND versao>v.versao AND vigencia_inicio<=NEW.prevista_em) THEN
 RAISE EXCEPTION 'Programacao fora da vigencia' USING ERRCODE='23514'; END IF;
 ELSE
 IF OLD.situacao<>'prevista' OR NEW.situacao<>'nao_executada' OR (NEW.id,NEW.organizacao_id,NEW.unidade_id,NEW.episodio_id,NEW.ordem_versao_id,NEW.prevista_em,NEW.autor_id) IS DISTINCT FROM
 (OLD.id,OLD.organizacao_id,OLD.unidade_id,OLD.episodio_id,OLD.ordem_versao_id,OLD.prevista_em,OLD.autor_id) OR EXISTS(SELECT 1 FROM execucao WHERE organizacao_id=NEW.organizacao_id AND programacao_id=NEW.id) THEN
 RAISE EXCEPTION 'Programacao com fato ou encerrada nao pode ser cancelada' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER programacao_validar BEFORE INSERT OR UPDATE ON programacao FOR EACH ROW EXECUTE FUNCTION validar_programacao();

CREATE FUNCTION validar_execucao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE v ordem_versao; ep episodio; prog programacao; antiga execucao;
BEGIN
 SELECT * INTO STRICT ep FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=NEW.episodio_id FOR UPDATE;
 SELECT * INTO STRICT v FROM ordem_versao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.ordem_versao_id;
 PERFORM pg_advisory_xact_lock(hashtextextended('ordem:'||NEW.organizacao_id::text||':'||v.ordem_id::text,0));
 IF NEW.executada_em>now() OR NEW.executada_em<v.vigencia_inicio OR NEW.executada_em>=v.vigencia_fim OR
 NEW.executada_em<ep.admitido_em OR NEW.executada_em>=least(ep.alta_clinica_em,ep.encerrado_em) OR NEW.unidade_medida_id<>v.unidade_medida_id OR EXISTS(
 SELECT 1 FROM ordem_versao WHERE organizacao_id=NEW.organizacao_id AND ordem_id=v.ordem_id AND versao>v.versao AND vigencia_inicio<=NEW.executada_em) THEN
 RAISE EXCEPTION 'Execucao fora da versao ou episodio informado' USING ERRCODE='23514'; END IF;
 IF NEW.correcao_de_id IS NOT NULL THEN
 SELECT * INTO STRICT antiga FROM execucao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.correcao_de_id;
 IF antiga.ordem_versao_id<>NEW.ordem_versao_id OR antiga.programacao_id IS DISTINCT FROM NEW.programacao_id OR EXISTS(
 SELECT 1 FROM consumo c WHERE c.organizacao_id=NEW.organizacao_id AND c.execucao_id=antiga.id AND NOT EXISTS(SELECT 1 FROM estorno_consumo s WHERE s.organizacao_id=c.organizacao_id AND s.consumo_id=c.id)) THEN
 RAISE EXCEPTION 'Retificacao exige mesmo contexto e estorno de consumo ativo' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.programacao_id IS NOT NULL THEN
 SELECT * INTO STRICT prog FROM programacao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.programacao_id FOR UPDATE;
 IF prog.situacao<>'prevista' OR EXISTS(SELECT 1 FROM execucao e WHERE e.organizacao_id=NEW.organizacao_id AND e.programacao_id=NEW.programacao_id
 AND e.id IS DISTINCT FROM NEW.correcao_de_id AND e.resultado='integral' AND NOT EXISTS(SELECT 1 FROM execucao r WHERE r.organizacao_id=e.organizacao_id AND r.correcao_de_id=e.id)) THEN
 RAISE EXCEPTION 'Programacao ja concluida ou nao executada' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER execucao_validar BEFORE INSERT ON execucao FOR EACH ROW EXECUTE FUNCTION validar_execucao();

CREATE FUNCTION validar_material_previsto() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE ultima integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('material:'||NEW.organizacao_id::text||':'||NEW.item_clinico_id::text||':'||NEW.produto_id::text,0));
 SELECT max(versao) INTO ultima FROM material_previsto WHERE organizacao_id=NEW.organizacao_id AND item_clinico_id=NEW.item_clinico_id AND produto_id=NEW.produto_id;
 IF NEW.versao<>coalesce(ultima,0)+1 THEN RAISE EXCEPTION 'Versao de material invalida' USING ERRCODE='23514'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER material_previsto_validar BEFORE INSERT ON material_previsto FOR EACH ROW EXECUTE FUNCTION validar_material_previsto();

CREATE FUNCTION validar_consumo() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE ep episodio; e execucao;
BEGIN
 SELECT * INTO STRICT ep FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=NEW.episodio_id FOR UPDATE;
 IF NEW.ocorrido_em>now() OR NEW.ocorrido_em<ep.admitido_em OR NEW.ocorrido_em>=least(ep.alta_clinica_em,ep.encerrado_em) THEN RAISE EXCEPTION 'Consumo fora do episodio' USING ERRCODE='23514'; END IF;
 IF NEW.execucao_id IS NOT NULL THEN
 SELECT * INTO STRICT e FROM execucao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.execucao_id;
 IF e.situacao_material<>'pendente' OR NEW.ocorrido_em<>e.executada_em OR EXISTS(SELECT 1 FROM execucao WHERE organizacao_id=NEW.organizacao_id AND correcao_de_id=e.id) OR EXISTS(
 SELECT 1 FROM consumo c WHERE c.organizacao_id=NEW.organizacao_id AND c.execucao_id=e.id AND NOT EXISTS(SELECT 1 FROM estorno_consumo s WHERE s.organizacao_id=c.organizacao_id AND s.consumo_id=c.id)) THEN
 RAISE EXCEPTION 'Consumo ja conciliado ou execucao incompativel' USING ERRCODE='23514'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER consumo_validar BEFORE INSERT ON consumo FOR EACH ROW EXECUTE FUNCTION validar_consumo();

CREATE FUNCTION validar_consumo_item() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE c consumo; t transacao_estoque; l lancamento_estoque; p posicao_estoque; propriedade custodia; ep episodio;
BEGIN
 SELECT * INTO STRICT c FROM consumo WHERE organizacao_id=NEW.organizacao_id AND id=NEW.consumo_id;
 SELECT * INTO STRICT t FROM transacao_estoque WHERE organizacao_id=NEW.organizacao_id AND id=NEW.transacao_id;
 SELECT * INTO STRICT l FROM lancamento_estoque WHERE organizacao_id=NEW.organizacao_id AND id=NEW.lancamento_id;
 SELECT * INTO STRICT p FROM posicao_estoque WHERE organizacao_id=NEW.organizacao_id AND id=NEW.posicao_id;
 SELECT * INTO STRICT propriedade FROM custodia WHERE organizacao_id=NEW.organizacao_id AND id=p.custodia_id;
 SELECT * INTO STRICT ep FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=c.episodio_id;
 IF t.tipo<>'consumo' OR t.origem_id IS DISTINCT FROM p.id OR t.destino_id IS NOT NULL OR t.contrapartida IS DISTINCT FROM 'consumido' OR t.ocorrido_em<>c.ocorrido_em OR
 l.transacao_id<>t.id OR l.posicao_id IS DISTINCT FROM p.id OR l.lado<>-1 OR NEW.quantidade_base<>-l.quantidade_assinada OR
 NEW.custo_total_snapshot IS DISTINCT FROM t.custo_base_snapshot*NEW.quantidade_base OR
 (propriedade.tipo='tutor' AND (propriedade.paciente_id<>ep.paciente_id OR (propriedade.episodio_id IS NOT NULL AND propriedade.episodio_id<>ep.id))) THEN
 RAISE EXCEPTION 'Material consumido sem vinculo fisico compativel' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER consumo_item_validar BEFORE INSERT ON consumo_item FOR EACH ROW EXECUTE FUNCTION validar_consumo_item();

CREATE FUNCTION validar_conciliacao_consumo() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM consumo_item WHERE organizacao_id=NEW.organizacao_id AND consumo_id=NEW.id) THEN RAISE EXCEPTION 'Consumo sem itens identificados' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER consumo_conciliado AFTER INSERT ON consumo DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validar_conciliacao_consumo();
CREATE FUNCTION validar_movimento_consumo() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 IF NEW.tipo='consumo' AND NOT EXISTS(SELECT 1 FROM consumo_item WHERE organizacao_id=NEW.organizacao_id AND transacao_id=NEW.id) THEN
 RAISE EXCEPTION 'Baixa sem consumo identificado' USING ERRCODE='23514'; END IF;
 IF NEW.tipo='reversao' AND EXISTS(SELECT 1 FROM transacao_estoque WHERE organizacao_id=NEW.organizacao_id AND id=NEW.reversao_de_id AND tipo='consumo') AND NOT EXISTS(
 SELECT 1 FROM consumo_item i JOIN estorno_consumo s ON s.organizacao_id=i.organizacao_id AND s.consumo_id=i.consumo_id WHERE i.organizacao_id=NEW.organizacao_id AND i.transacao_id=NEW.reversao_de_id) THEN
 RAISE EXCEPTION 'Consumo exige estorno agregado' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER transacao_consumo AFTER INSERT ON transacao_estoque DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validar_movimento_consumo();
CREATE FUNCTION validar_estorno_consumo() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM consumo_item i WHERE i.organizacao_id=NEW.organizacao_id AND i.consumo_id=NEW.consumo_id AND NOT EXISTS(
 SELECT 1 FROM transacao_estoque t WHERE t.organizacao_id=i.organizacao_id AND t.reversao_de_id=i.transacao_id AND t.ocorrido_em=NEW.ocorrido_em)) THEN
 RAISE EXCEPTION 'Estorno exige compensacao de todos os itens' USING ERRCODE='23514'; END IF; RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER estorno_consumo_validar AFTER INSERT ON estorno_consumo DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validar_estorno_consumo();

CREATE FUNCTION validar_resolucao_clinica() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE p pendencia_clinica;
BEGIN
 SELECT * INTO STRICT p FROM pendencia_clinica WHERE organizacao_id=NEW.organizacao_id AND id=NEW.pendencia_id;
 IF p.tipo='material_nao_identificado' AND NOT EXISTS(SELECT 1 FROM consumo c WHERE c.organizacao_id=NEW.organizacao_id AND c.id=NEW.consumo_id AND c.execucao_id=p.execucao_id
 AND NOT EXISTS(SELECT 1 FROM estorno_consumo s WHERE s.organizacao_id=c.organizacao_id AND s.consumo_id=c.id)) AND NOT EXISTS(
 SELECT 1 FROM execucao e WHERE e.organizacao_id=NEW.organizacao_id AND e.id=NEW.execucao_substituta_id AND e.correcao_de_id=p.execucao_id) THEN
 RAISE EXCEPTION 'Pendencia de material exige conciliacao ou retificacao' USING ERRCODE='23514'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER resolucao_clinica_validar BEFORE INSERT ON resolucao_pendencia_clinica FOR EACH ROW EXECUTE FUNCTION validar_resolucao_clinica();
DO $$ DECLARE f text; BEGIN
 FOREACH f IN ARRAY ARRAY['validar_prescricao','validar_ordem_versao','validar_programacao','validar_execucao','validar_material_previsto','validar_consumo','validar_consumo_item','validar_conciliacao_consumo','validar_movimento_consumo','validar_estorno_consumo','validar_resolucao_clinica'] LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION hvb.%I() FROM PUBLIC',f);
 END LOOP;
END $$;
