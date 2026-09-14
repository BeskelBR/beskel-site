SET search_path=hvb,public;
CREATE OR REPLACE FUNCTION validar_comercial() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE ev evento_cobravel_consulta;pv preco_versao;av avaliacao_cobranca_consulta;it item_comercial_versao;c record;n integer;ep uuid;prod uuid;ts timestamptz;qty numeric;v numeric;
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'item_comercial_versao' THEN
 SELECT coalesce(max(versao),0)+1 INTO n FROM item_comercial_versao WHERE organizacao_id=NEW.organizacao_id AND unidade_id=NEW.unidade_id AND codigo=NEW.codigo;
 IF NEW.versao<>n THEN RAISE EXCEPTION 'Versao comercial nao consecutiva' USING ERRCODE='23514';END IF;
 IF NEW.produto_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM produto WHERE organizacao_id=NEW.organizacao_id AND id=NEW.produto_id AND unidade_base_id=NEW.unidade_medida_id) THEN RAISE EXCEPTION 'Unidade comercial fisica incompativel' USING ERRCODE='23514';END IF;
 WHEN 'preco_versao' THEN
 SELECT coalesce(max(versao),0)+1 INTO n FROM preco_versao WHERE organizacao_id=NEW.organizacao_id AND item_comercial_id=NEW.item_comercial_id;
 IF NEW.versao<>n THEN RAISE EXCEPTION 'Versao de preco nao consecutiva' USING ERRCODE='23514';END IF;
 WHEN 'evento_cobravel' THEN
 SELECT * INTO STRICT it FROM item_comercial_versao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.item_comercial_id;
 IF NEW.execucao_id IS NOT NULL THEN
 SELECT episodio_id,executada_em INTO STRICT ep,ts FROM execucao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.execucao_id;
 IF it.tipo<>'servico' THEN RAISE EXCEPTION 'Execucao exige item de servico explicito' USING ERRCODE='23514';END IF;
 ELSIF NEW.consumo_item_id IS NOT NULL THEN
 SELECT co.episodio_id,co.ocorrido_em,ci.quantidade_base,lot.produto_id INTO STRICT ep,ts,qty,prod FROM consumo_item ci JOIN consumo co ON co.organizacao_id=ci.organizacao_id AND co.id=ci.consumo_id JOIN posicao_estoque p ON p.organizacao_id=ci.organizacao_id AND p.id=ci.posicao_id JOIN lote lot ON lot.organizacao_id=p.organizacao_id AND lot.id=p.lote_id WHERE ci.organizacao_id=NEW.organizacao_id AND ci.id=NEW.consumo_item_id;
 IF it.tipo<>'produto' OR it.produto_id IS DISTINCT FROM prod OR NEW.quantidade<>qty THEN RAISE EXCEPTION 'Consumo comercial incompativel' USING ERRCODE='23514';END IF;
 ELSE SELECT episodio_id,inicio INTO STRICT ep,ts FROM periodo_diaria WHERE organizacao_id=NEW.organizacao_id AND id=NEW.periodo_diaria_id;
 IF it.tipo<>'servico' OR NEW.quantidade<>1 THEN RAISE EXCEPTION 'Periodo exige uma unidade de servico' USING ERRCODE='23514';END IF;END IF;
 IF ep<>NEW.episodio_id OR ts<>NEW.competencia THEN RAISE EXCEPTION 'Origem comercial divergente' USING ERRCODE='23514';END IF;
 WHEN 'avaliacao_cobranca' THEN
 SELECT * INTO STRICT ev FROM evento_cobravel_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.evento_id;
 SELECT coalesce(max(versao),0)+1 INTO n FROM avaliacao_cobranca WHERE organizacao_id=NEW.organizacao_id AND evento_id=NEW.evento_id;
 IF NEW.versao<>n OR (n>1 AND NOT EXISTS(SELECT 1 FROM avaliacao_cobranca WHERE organizacao_id=NEW.organizacao_id AND evento_id=NEW.evento_id AND id=NEW.anterior_id AND versao=n-1)) THEN RAISE EXCEPTION 'Versao de avaliacao incompativel' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM item_conta_consulta i JOIN avaliacao_cobranca a ON a.organizacao_id=i.organizacao_id AND a.id=i.avaliacao_id WHERE a.organizacao_id=NEW.organizacao_id AND a.evento_id=NEW.evento_id AND NOT i.revertido) THEN RAISE EXCEPTION 'Reverter item antes de reavaliar' USING ERRCODE='23514';END IF;
 IF NEW.preco_id IS NOT NULL THEN SELECT * INTO STRICT pv FROM preco_versao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.preco_id;
 IF pv.item_comercial_id<>ev.item_comercial_id OR ev.competencia<pv.inicio OR ev.competencia>=pv.fim THEN RAISE EXCEPTION 'Preco fora da origem ou vigencia' USING ERRCODE='23514';END IF;
 v:=ev.quantidade*pv.valor;
 IF NEW.bruto IS DISTINCT FROM v THEN RAISE EXCEPTION 'Bruto diverge de quantidade e preco' USING ERRCODE='23514';END IF;END IF;
 IF NEW.resultado<>'pendente' AND (NOT ev.origem_ativa OR NEW.preco_id IS NULL OR NEW.bruto IS NULL) THEN RAISE EXCEPTION 'Origem ou preco pendente' USING ERRCODE='23514';END IF;
 IF NEW.cobertura_id IS NOT NULL THEN
 SELECT a.*,e.execucao_id,e.consumo_item_id INTO STRICT c FROM avaliacao_cobertura_consulta a JOIN evento_cobertura e ON e.organizacao_id=a.organizacao_id AND e.id=a.evento_id WHERE a.organizacao_id=NEW.organizacao_id AND a.id=NEW.cobertura_id;
 IF c.execucao_id IS DISTINCT FROM ev.execucao_id OR c.consumo_item_id IS DISTINCT FROM ev.consumo_item_id OR ev.periodo_diaria_id IS NOT NULL THEN RAISE EXCEPTION 'Cobertura de outra origem' USING ERRCODE='23514';END IF;
 IF NEW.resultado<>'pendente' AND (c.situacao_atual<>'incluido' OR NEW.resultado<>'incluido' OR NEW.beneficio<>NEW.bruto OR NEW.desconto<>0) THEN RAISE EXCEPTION 'Cobertura ambigua permanece pendente' USING ERRCODE='23514';END IF;
 ELSIF NEW.resultado='incluido' OR NEW.beneficio<>0 THEN RAISE EXCEPTION 'Beneficio exige cobertura tipada' USING ERRCODE='23514';END IF;
 IF NEW.resultado='isento' AND NEW.desconto<>NEW.bruto THEN RAISE EXCEPTION 'Isencao exige desconto motivado integral' USING ERRCODE='23514';END IF;
 WHEN 'item_conta' THEN
 SELECT * INTO STRICT av FROM avaliacao_cobranca_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.avaliacao_id;
 SELECT episodio_id INTO STRICT ep FROM conta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.conta_id;
 IF ep<>av.episodio_id OR av.valor IS NULL OR av.necessita_revisao OR NEW.valor<>av.valor OR EXISTS(SELECT 1 FROM avaliacao_cobranca WHERE organizacao_id=NEW.organizacao_id AND evento_id=av.evento_id AND versao>av.versao) THEN RAISE EXCEPTION 'Avaliacao nao pode ser documentada' USING ERRCODE='23514';END IF;
 SELECT ic.* INTO STRICT it FROM item_comercial_versao ic JOIN evento_cobravel e ON e.organizacao_id=ic.organizacao_id AND e.item_comercial_id=ic.id WHERE e.organizacao_id=NEW.organizacao_id AND e.id=av.evento_id;
 IF NEW.descricao<>it.descricao THEN RAISE EXCEPTION 'Descricao comercial deve preservar versao' USING ERRCODE='23514';END IF;
 WHEN 'responsabilidade' THEN
 SELECT * INTO STRICT c FROM item_conta_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.item_conta_id;
 IF c.comando_id<>NEW.comando_id OR c.revertido OR (SELECT coalesce(sum(valor),0) FROM responsabilidade WHERE organizacao_id=NEW.organizacao_id AND item_conta_id=NEW.item_conta_id)+NEW.valor>c.valor THEN RAISE EXCEPTION 'Responsabilidade excede item ou comando' USING ERRCODE='23514';END IF;
 WHEN 'titulo_item' THEN
 SELECT t.pagador_id,t.comando_id,r.pagador_id AS devedor,r.valor,r.item_conta_id INTO STRICT c FROM titulo t JOIN responsabilidade r ON r.organizacao_id=t.organizacao_id WHERE t.organizacao_id=NEW.organizacao_id AND t.id=NEW.titulo_id AND r.id=NEW.responsabilidade_id;
 IF c.pagador_id<>c.devedor OR c.comando_id<>NEW.comando_id OR NOT EXISTS(SELECT 1 FROM item_conta_consulta WHERE organizacao_id=NEW.organizacao_id AND id=c.item_conta_id AND NOT revertido AND NOT necessita_revisao) THEN RAISE EXCEPTION 'Titulo diverge da responsabilidade' USING ERRCODE='23514';END IF;
 SELECT coalesce(sum(ti.valor),0) INTO v FROM titulo_item ti JOIN titulo_consulta t ON t.organizacao_id=ti.organizacao_id AND t.id=ti.titulo_id WHERE ti.organizacao_id=NEW.organizacao_id AND ti.responsabilidade_id=NEW.responsabilidade_id AND NOT t.revertido;
 IF v+NEW.valor>c.valor THEN RAISE EXCEPTION 'Titulo duplica valor devido' USING ERRCODE='23514';END IF;
 ELSE NULL;END CASE;
 RETURN NEW;
END $$;

