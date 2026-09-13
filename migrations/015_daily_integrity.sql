SET search_path=hvb,public;
CREATE FUNCTION validar_catalogo_diaria() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE ultima integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(TG_TABLE_NAME||':'||NEW.organizacao_id::text||':'||NEW.codigo,0));
 EXECUTE format('SELECT max(versao) FROM hvb.%I WHERE organizacao_id=$1 AND codigo=$2',TG_TABLE_NAME) INTO ultima USING NEW.organizacao_id,NEW.codigo;
 IF NEW.versao<>coalesce(ultima,0)+1 THEN RAISE EXCEPTION 'Versao consecutiva obrigatoria' USING ERRCODE='23514'; END IF;RETURN NEW;
END $$;
CREATE TRIGGER versao_validar BEFORE INSERT ON classificacao_versao FOR EACH ROW EXECUTE FUNCTION validar_catalogo_diaria();
CREATE TRIGGER versao_validar BEFORE INSERT ON grupo_cobertura_versao FOR EACH ROW EXECUTE FUNCTION validar_catalogo_diaria();
CREATE TRIGGER versao_validar BEFORE INSERT ON pacote_versao FOR EACH ROW EXECUTE FUNCTION validar_catalogo_diaria();
CREATE FUNCTION validar_configuracao_pacote() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE p pacote_versao; r regra_pacote; g uuid; base uuid;
BEGIN
 IF TG_TABLE_NAME='membro_grupo_cobertura' THEN
 PERFORM pg_advisory_xact_lock(hashtextextended('grupo-cobertura:'||NEW.organizacao_id::text||':'||NEW.grupo_versao_id::text,0));
 IF EXISTS(SELECT 1 FROM regra_pacote rp JOIN aprovacao_pacote a ON a.organizacao_id=rp.organizacao_id AND a.pacote_versao_id=rp.pacote_versao_id WHERE rp.organizacao_id=NEW.organizacao_id AND rp.grupo_versao_id=NEW.grupo_versao_id) THEN
 RAISE EXCEPTION 'Grupo utilizado por pacote aprovado e imutavel' USING ERRCODE='23514'; END IF;
 RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('pacote:'||NEW.organizacao_id::text||':'||NEW.pacote_versao_id::text,0));
 SELECT * INTO STRICT p FROM pacote_versao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.pacote_versao_id;
 IF EXISTS(SELECT 1 FROM aprovacao_pacote WHERE organizacao_id=NEW.organizacao_id AND pacote_versao_id=p.id) THEN RAISE EXCEPTION 'Pacote aprovado e imutavel' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='regra_pacote' THEN
 IF NEW.dimensao='quantidade_fisica' THEN
 SELECT unidade_base_id INTO base FROM produto WHERE organizacao_id=NEW.organizacao_id AND id=NEW.produto_id;
 IF base IS NULL OR NEW.unidade_limite_id IS DISTINCT FROM base THEN RAISE EXCEPTION 'Regra fisica exige produto e unidade base' USING ERRCODE='23514'; END IF;
 ELSIF NEW.dimensao IN ('administracoes','itens_distintos') AND (NEW.produto_id IS NOT NULL OR NEW.unidade_limite_id IS NOT NULL OR NEW.limite_quantidade<>trunc(NEW.limite_quantidade)) THEN
 RAISE EXCEPTION 'Contagem exige item/grupo e limite inteiro' USING ERRCODE='23514'; END IF;
 ELSE
 IF p.base_temporal='pendente' OR p.limite_encerramento='pendente' OR p.politica_tolerancia='pendente' OR p.mudanca_classe='pendente' OR NOT p.simulacao THEN
 RAISE EXCEPTION 'Politicas pendentes impedem aprovacao de simulacao' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM regra_pacote WHERE organizacao_id=NEW.organizacao_id AND pacote_versao_id=p.id) THEN RAISE EXCEPTION 'Pacote sem regras explicitas' USING ERRCODE='23514'; END IF;
 FOR g IN SELECT DISTINCT grupo_versao_id FROM regra_pacote WHERE organizacao_id=NEW.organizacao_id AND pacote_versao_id=p.id AND grupo_versao_id IS NOT NULL ORDER BY grupo_versao_id LOOP
 PERFORM pg_advisory_xact_lock(hashtextextended('grupo-cobertura:'||NEW.organizacao_id::text||':'||g::text,0)); END LOOP;
 FOR r IN SELECT * FROM regra_pacote WHERE organizacao_id=NEW.organizacao_id AND pacote_versao_id=p.id LOOP
 IF r.dimensao='pendente' OR r.janela='pendente' OR r.tratamento='pendente' OR (r.grupo_versao_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM membro_grupo_cobertura WHERE organizacao_id=NEW.organizacao_id AND grupo_versao_id=r.grupo_versao_id)) THEN
 RAISE EXCEPTION 'Regra incompleta impede aprovacao de simulacao' USING ERRCODE='23514'; END IF;END LOOP;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER configuracao_validar BEFORE INSERT ON regra_pacote FOR EACH ROW EXECUTE FUNCTION validar_configuracao_pacote();
CREATE TRIGGER configuracao_validar BEFORE INSERT ON aprovacao_pacote FOR EACH ROW EXECUTE FUNCTION validar_configuracao_pacote();
CREATE TRIGGER configuracao_validar BEFORE INSERT ON membro_grupo_cobertura FOR EACH ROW EXECUTE FUNCTION validar_configuracao_pacote();

CREATE FUNCTION validar_contexto_diaria() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE ep episodio; pv pacote_versao; pe pacote_episodio; ce classificacao_episodio; peso medicao_peso; fuso_unidade text; limite timestamptz;
BEGIN
 SELECT * INTO STRICT ep FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=NEW.episodio_id FOR UPDATE;
 IF ep.tipo<>'internacao' THEN RAISE EXCEPTION 'Diaria exige episodio de internacao' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='medicao_peso' THEN
 IF NEW.medida_em>now() OR NEW.medida_em<ep.admitido_em OR NOT EXISTS(SELECT 1 FROM unidade WHERE organizacao_id=NEW.organizacao_id AND id=NEW.unidade_medida_id AND dimensao='massa') THEN RAISE EXCEPTION 'Medicao exige massa e horario declarado do episodio' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='classificacao_episodio' THEN
 IF TG_OP='UPDATE' THEN
 IF OLD.fim IS NOT NULL OR NEW.fim IS NULL OR NEW.fim>now() OR (NEW.id,NEW.organizacao_id,NEW.episodio_id,NEW.unidade_id,NEW.classificacao_versao_id,NEW.inicio,NEW.medicao_peso_id,NEW.avaliacao_clinica_id,NEW.suporte_ventilatorio,NEW.autor_id,NEW.motivo) IS DISTINCT FROM
 (OLD.id,OLD.organizacao_id,OLD.episodio_id,OLD.unidade_id,OLD.classificacao_versao_id,OLD.inicio,OLD.medicao_peso_id,OLD.avaliacao_clinica_id,OLD.suporte_ventilatorio,OLD.autor_id,OLD.motivo) THEN RAISE EXCEPTION 'Classificacao historica imutavel' USING ERRCODE='23514'; END IF;
 ELSE
 IF NEW.inicio<ep.admitido_em OR NEW.inicio>now() OR NEW.inicio>=least(ep.alta_clinica_em,ep.encerrado_em) OR NEW.fim IS NOT NULL THEN RAISE EXCEPTION 'Inicio de classificacao invalido' USING ERRCODE='23514'; END IF;
 IF NEW.medicao_peso_id IS NOT NULL THEN SELECT * INTO STRICT peso FROM medicao_peso WHERE organizacao_id=NEW.organizacao_id AND id=NEW.medicao_peso_id;
 IF peso.medida_em>NEW.inicio THEN RAISE EXCEPTION 'Peso posterior a classificacao' USING ERRCODE='23514'; END IF;END IF;
 END IF;
 ELSIF TG_TABLE_NAME='pacote_episodio' THEN
 IF NEW.inicio<ep.admitido_em THEN RAISE EXCEPTION 'Pacote anterior ao episodio' USING ERRCODE='23514'; END IF;
 ELSE
 SELECT * INTO STRICT pe FROM pacote_episodio WHERE organizacao_id=NEW.organizacao_id AND id=NEW.pacote_episodio_id;
 SELECT * INTO STRICT pv FROM pacote_versao WHERE organizacao_id=NEW.organizacao_id AND id=pe.pacote_versao_id;
 SELECT fuso INTO fuso_unidade FROM unidade_hospitalar WHERE organizacao_id=NEW.organizacao_id AND id=NEW.unidade_id;
 limite:=CASE pv.limite_encerramento WHEN 'alta_clinica' THEN ep.alta_clinica_em WHEN 'saida_fisica' THEN ep.encerrado_em ELSE NULL END;
 IF NEW.inicio<pe.inicio OR NEW.fim>pe.fim OR NEW.fim>limite OR NEW.fuso IS DISTINCT FROM fuso_unidade THEN RAISE EXCEPTION 'Periodo fora do pacote ou limite explicito' USING ERRCODE='23514'; END IF;
 IF NEW.classificacao_episodio_id IS NOT NULL THEN
 SELECT * INTO STRICT ce FROM classificacao_episodio WHERE organizacao_id=NEW.organizacao_id AND id=NEW.classificacao_episodio_id;
 IF ce.inicio>NEW.inicio OR ce.fim<NEW.fim OR (pv.classificacao_versao_id IS NOT NULL AND pv.classificacao_versao_id<>ce.classificacao_versao_id) THEN RAISE EXCEPTION 'Classificacao nao cobre todo periodo' USING ERRCODE='23514'; END IF;
 ELSIF pv.classificacao_versao_id IS NOT NULL THEN RAISE EXCEPTION 'Pacote exige classificacao declarada' USING ERRCODE='23514'; END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER contexto_diaria BEFORE INSERT ON medicao_peso FOR EACH ROW EXECUTE FUNCTION validar_contexto_diaria();
CREATE TRIGGER contexto_diaria BEFORE INSERT OR UPDATE ON classificacao_episodio FOR EACH ROW EXECUTE FUNCTION validar_contexto_diaria();
CREATE TRIGGER contexto_diaria BEFORE INSERT ON pacote_episodio FOR EACH ROW EXECUTE FUNCTION validar_contexto_diaria();
CREATE TRIGGER contexto_diaria BEFORE INSERT ON periodo_diaria FOR EACH ROW EXECUTE FUNCTION validar_contexto_diaria();

CREATE FUNCTION validar_evento_cobertura() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE e execucao; v ordem_versao; ci consumo_item; c consumo; p produto; l lote;
BEGIN
 PERFORM 1 FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=NEW.episodio_id FOR UPDATE;
 IF NEW.execucao_id IS NOT NULL THEN
 SELECT * INTO STRICT e FROM execucao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.execucao_id;
 SELECT * INTO STRICT v FROM ordem_versao WHERE organizacao_id=NEW.organizacao_id AND id=e.ordem_versao_id;
 IF NEW.item_clinico_id IS DISTINCT FROM v.item_clinico_id OR NEW.ocorrido_em<>e.executada_em OR num_nonnulls(NEW.produto_id,NEW.quantidade_fisica,NEW.unidade_medida_id)<>0 THEN RAISE EXCEPTION 'Origem clinica incompativel' USING ERRCODE='23514'; END IF;
 ELSE
 SELECT * INTO STRICT ci FROM consumo_item WHERE organizacao_id=NEW.organizacao_id AND id=NEW.consumo_item_id;
 SELECT * INTO STRICT c FROM consumo WHERE organizacao_id=NEW.organizacao_id AND id=ci.consumo_id;
 SELECT lo.* INTO STRICT l FROM lote lo JOIN posicao_estoque po ON po.organizacao_id=lo.organizacao_id AND po.lote_id=lo.id WHERE po.organizacao_id=NEW.organizacao_id AND po.id=ci.posicao_id;
 SELECT * INTO STRICT p FROM produto WHERE organizacao_id=NEW.organizacao_id AND id=l.produto_id;
 IF c.episodio_id<>NEW.episodio_id OR c.unidade_id<>NEW.unidade_id OR NEW.item_clinico_id IS NOT NULL OR NEW.produto_id IS DISTINCT FROM p.id OR NEW.quantidade_fisica IS DISTINCT FROM ci.quantidade_base OR NEW.unidade_medida_id IS DISTINCT FROM p.unidade_base_id OR NEW.ocorrido_em<>c.ocorrido_em THEN RAISE EXCEPTION 'Origem fisica incompativel' USING ERRCODE='23514'; END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER evento_cobertura_validar BEFORE INSERT ON evento_cobertura FOR EACH ROW EXECUTE FUNCTION validar_evento_cobertura();
CREATE VIEW evento_cobertura_consulta WITH(security_invoker=true) AS
 SELECT ev.*,
 CASE WHEN ev.execucao_id IS NOT NULL THEN NOT EXISTS(SELECT 1 FROM execucao r WHERE r.organizacao_id=ev.organizacao_id AND r.correcao_de_id=ev.execucao_id)
 ELSE NOT EXISTS(SELECT 1 FROM estorno_consumo s WHERE s.organizacao_id=ev.organizacao_id AND s.consumo_id=ci.consumo_id) END AS origem_ativa,
 coalesce(e.resultado='integral',false) AS execucao_integral,coalesce(cu.tipo='tutor',false) AS material_tutor
 FROM evento_cobertura ev LEFT JOIN execucao e ON e.organizacao_id=ev.organizacao_id AND e.id=ev.execucao_id
 LEFT JOIN consumo_item ci ON ci.organizacao_id=ev.organizacao_id AND ci.id=ev.consumo_item_id
 LEFT JOIN posicao_estoque p ON p.organizacao_id=ci.organizacao_id AND p.id=ci.posicao_id LEFT JOIN custodia cu ON cu.organizacao_id=p.organizacao_id AND cu.id=p.custodia_id;
CREATE VIEW periodo_diaria_consulta WITH(security_invoker=true) AS
 SELECT p.*,pe.pacote_versao_id,
 coalesce((pv.limite_encerramento='alta_clinica' AND p.fim>e.alta_clinica_em) OR (pv.limite_encerramento='saida_fisica' AND p.fim>e.encerrado_em) OR
 (ce.id IS NOT NULL AND (ce.inicio>p.inicio OR ce.fim<p.fim)) OR EXISTS(SELECT 1 FROM execucao x WHERE x.organizacao_id=ce.organizacao_id AND x.correcao_de_id=ce.avaliacao_clinica_id),false) AS necessita_revisao
 FROM periodo_diaria p JOIN pacote_episodio pe ON pe.organizacao_id=p.organizacao_id AND pe.id=p.pacote_episodio_id
 JOIN pacote_versao pv ON pv.organizacao_id=pe.organizacao_id AND pv.id=pe.pacote_versao_id JOIN episodio e ON e.organizacao_id=p.organizacao_id AND e.id=p.episodio_id
 LEFT JOIN classificacao_episodio ce ON ce.organizacao_id=p.organizacao_id AND ce.id=p.classificacao_episodio_id;
CREATE VIEW alocacao_cobertura_ativa WITH(security_invoker=true) AS
 SELECT a.*,ev.item_clinico_id,av.evento_id FROM alocacao_cobertura a JOIN avaliacao_cobertura av ON av.organizacao_id=a.organizacao_id AND av.id=a.avaliacao_id
 JOIN evento_cobertura ev ON ev.organizacao_id=av.organizacao_id AND ev.id=av.evento_id
 WHERE NOT EXISTS(SELECT 1 FROM reversao_cobertura r WHERE r.organizacao_id=a.organizacao_id AND r.avaliacao_id=a.avaliacao_id);
CREATE FUNCTION regras_cobertura(p_evento uuid,p_periodo uuid) RETURNS SETOF regra_pacote LANGUAGE sql STABLE SET search_path=hvb,pg_temp AS $$
 SELECT r.* FROM evento_cobertura_consulta e JOIN periodo_diaria_consulta p ON p.organizacao_id=e.organizacao_id AND p.episodio_id=e.episodio_id
 JOIN regra_pacote r ON r.organizacao_id=p.organizacao_id AND r.pacote_versao_id=p.pacote_versao_id
 WHERE e.id=p_evento AND p.id=p_periodo AND e.origem_ativa AND NOT e.material_tutor AND NOT p.necessita_revisao AND e.ocorrido_em>=p.inicio AND e.ocorrido_em<p.fim
 AND ((e.consumo_item_id IS NOT NULL AND r.dimensao='quantidade_fisica' AND r.produto_id=e.produto_id AND r.unidade_limite_id=e.unidade_medida_id)
 OR (e.execucao_id IS NOT NULL AND e.execucao_integral AND r.dimensao IN ('administracoes','itens_distintos') AND
 (r.item_clinico_id=e.item_clinico_id OR EXISTS(SELECT 1 FROM membro_grupo_cobertura m WHERE m.organizacao_id=r.organizacao_id AND m.grupo_versao_id=r.grupo_versao_id AND m.item_clinico_id=e.item_clinico_id))));
$$;
CREATE FUNCTION regra_cobertura_vigente(p_evento uuid,p_periodo uuid) RETURNS uuid LANGUAGE sql STABLE SET search_path=hvb,pg_temp AS $$
 WITH candidatas AS MATERIALIZED(SELECT id,prioridade FROM regras_cobertura(p_evento,p_periodo)),topo AS(SELECT id FROM candidatas WHERE prioridade=(SELECT max(prioridade) FROM candidatas))
 SELECT CASE WHEN count(*)=1 THEN min(id::text)::uuid ELSE NULL END FROM topo;
$$;
GRANT EXECUTE ON FUNCTION regras_cobertura(uuid,uuid),regra_cobertura_vigente(uuid,uuid) TO hvb_app;
REVOKE ALL ON FUNCTION regras_cobertura(uuid,uuid),regra_cobertura_vigente(uuid,uuid) FROM PUBLIC;
CREATE FUNCTION compromisso_cobertura(p_uso uuid,p_item uuid) RETURNS TABLE(total numeric,item_existente boolean) LANGUAGE sql STABLE SET search_path=hvb,pg_temp AS $$
 WITH comprometido AS (
 SELECT incluida AS quantidade,item_clinico_id FROM alocacao_cobertura_ativa WHERE uso_id=p_uso AND incluida>0
 UNION ALL SELECT r.quantidade,e.item_clinico_id FROM reserva_cobertura r JOIN evento_cobertura e ON e.organizacao_id=r.organizacao_id AND e.id=r.evento_id WHERE r.uso_id=p_uso AND r.situacao='ativa'
 ), regra AS(SELECT r.dimensao FROM uso_cobertura u JOIN regra_pacote r ON r.organizacao_id=u.organizacao_id AND r.id=u.regra_id WHERE u.id=p_uso)
 SELECT CASE WHEN (SELECT dimensao FROM regra)='itens_distintos' THEN count(DISTINCT item_clinico_id)::numeric ELSE coalesce(sum(quantidade),0) END,coalesce(bool_or(item_clinico_id=p_item),false) FROM comprometido;
$$;
GRANT EXECUTE ON FUNCTION compromisso_cobertura(uuid,uuid) TO hvb_app;
REVOKE ALL ON FUNCTION compromisso_cobertura(uuid,uuid) FROM PUBLIC;
CREATE FUNCTION validar_uso_cobertura() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE pe pacote_episodio;r regra_pacote;
BEGIN
 PERFORM 1 FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=NEW.episodio_id FOR UPDATE;
 SELECT * INTO STRICT pe FROM pacote_episodio WHERE organizacao_id=NEW.organizacao_id AND id=NEW.pacote_episodio_id;
 SELECT * INTO STRICT r FROM regra_pacote WHERE organizacao_id=NEW.organizacao_id AND id=NEW.regra_id;
 IF pe.pacote_versao_id<>r.pacote_versao_id OR (r.janela='periodo')<>(NEW.periodo_diaria_id IS NOT NULL) THEN RAISE EXCEPTION 'Regra/janela do uso incompativel' USING ERRCODE='23514'; END IF;RETURN NEW;
END $$;
CREATE TRIGGER uso_cobertura_validar BEFORE INSERT ON uso_cobertura FOR EACH ROW EXECUTE FUNCTION validar_uso_cobertura();
CREATE FUNCTION validar_reserva_cobertura() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE ev evento_cobertura;u uso_cobertura;r regra_pacote;total numeric;ja boolean;
BEGIN
 SELECT * INTO STRICT ev FROM evento_cobertura WHERE organizacao_id=NEW.organizacao_id AND id=NEW.evento_id;
 PERFORM 1 FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=ev.episodio_id FOR UPDATE;
 IF TG_OP='UPDATE' THEN
 IF OLD.situacao<>'ativa' OR NEW.situacao='ativa' OR (NEW.id,NEW.organizacao_id,NEW.unidade_id,NEW.evento_id,NEW.uso_id,NEW.periodo_diaria_id,NEW.quantidade,NEW.expira_em,NEW.autor_id,NEW.motivo) IS DISTINCT FROM
 (OLD.id,OLD.organizacao_id,OLD.unidade_id,OLD.evento_id,OLD.uso_id,OLD.periodo_diaria_id,OLD.quantidade,OLD.expira_em,OLD.autor_id,OLD.motivo) OR (NEW.situacao='expirada' AND NEW.expira_em>now()) OR (NEW.situacao='efetivada' AND NEW.expira_em<=now()) THEN RAISE EXCEPTION 'Transicao de reserva invalida' USING ERRCODE='23514'; END IF;
 ELSE
 SELECT * INTO STRICT u FROM uso_cobertura WHERE organizacao_id=NEW.organizacao_id AND id=NEW.uso_id;SELECT * INTO STRICT r FROM regra_pacote WHERE organizacao_id=NEW.organizacao_id AND id=u.regra_id;
 SELECT * INTO total,ja FROM compromisso_cobertura(u.id,ev.item_clinico_id);
 IF r.id IS DISTINCT FROM regra_cobertura_vigente(ev.id,NEW.periodo_diaria_id) OR (r.janela='periodo' AND u.periodo_diaria_id IS DISTINCT FROM NEW.periodo_diaria_id) THEN RAISE EXCEPTION 'Reserva fora da regra elegivel' USING ERRCODE='23514'; END IF;
 IF NEW.situacao<>'ativa' OR NEW.expira_em<=now() OR NEW.expira_em>now()+interval '24 hours' OR u.episodio_id<>ev.episodio_id OR
 NEW.quantidade IS DISTINCT FROM (CASE WHEN r.dimensao='quantidade_fisica' THEN ev.quantidade_fisica ELSE 1 END) OR r.tratamento NOT IN ('incluido_limitado','incluido_sem_limite') OR
 (r.limite_quantidade IS NOT NULL AND NOT(r.dimensao='itens_distintos' AND ja) AND total+NEW.quantidade>r.limite_quantidade) OR EXISTS(SELECT 1 FROM avaliacao_cobertura a WHERE a.organizacao_id=NEW.organizacao_id AND a.evento_id=NEW.evento_id AND NOT EXISTS(SELECT 1 FROM reversao_cobertura x WHERE x.organizacao_id=a.organizacao_id AND x.avaliacao_id=a.id)) THEN
 RAISE EXCEPTION 'Reserva de cobertura sem limite disponivel' USING ERRCODE='23514'; END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER reserva_cobertura_validar BEFORE INSERT OR UPDATE ON reserva_cobertura FOR EACH ROW EXECUTE FUNCTION validar_reserva_cobertura();
CREATE FUNCTION validar_avaliacao_cobertura() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE ev evento_cobertura;ultima avaliacao_cobertura;
BEGIN
 SELECT * INTO STRICT ev FROM evento_cobertura WHERE organizacao_id=NEW.organizacao_id AND id=NEW.evento_id;
 PERFORM 1 FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=ev.episodio_id FOR UPDATE;
 SELECT * INTO ultima FROM avaliacao_cobertura WHERE organizacao_id=NEW.organizacao_id AND evento_id=NEW.evento_id ORDER BY versao DESC LIMIT 1;
 IF NEW.versao<>coalesce(ultima.versao,0)+1 OR NEW.anterior_id IS DISTINCT FROM ultima.id OR (ultima.id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM reversao_cobertura WHERE organizacao_id=NEW.organizacao_id AND avaliacao_id=ultima.id)) OR
 EXISTS(SELECT 1 FROM reserva_cobertura WHERE organizacao_id=NEW.organizacao_id AND evento_id=NEW.evento_id AND situacao='ativa') THEN RAISE EXCEPTION 'Avaliacao exige versao/estado exclusivo' USING ERRCODE='23514'; END IF;
 IF NEW.reserva_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM reserva_cobertura WHERE organizacao_id=NEW.organizacao_id AND id=NEW.reserva_id AND evento_id=NEW.evento_id AND uso_id=NEW.uso_id AND periodo_diaria_id=NEW.periodo_diaria_id AND situacao='efetivada') THEN RAISE EXCEPTION 'Reserva incompativel com avaliacao' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM comando WHERE organizacao_id=NEW.organizacao_id AND id=NEW.comando_id AND concluido_em IS NULL) THEN RAISE EXCEPTION 'Comando ja concluido' USING ERRCODE='23514'; END IF;RETURN NEW;
END $$;
CREATE TRIGGER avaliacao_cobertura_validar BEFORE INSERT ON avaliacao_cobertura FOR EACH ROW EXECUTE FUNCTION validar_avaliacao_cobertura();
CREATE FUNCTION validar_alocacao_cobertura() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE av avaliacao_cobertura;ev evento_cobertura;u uso_cobertura;r regra_pacote;total numeric;ja boolean;
BEGIN
 SELECT * INTO STRICT av FROM avaliacao_cobertura WHERE organizacao_id=NEW.organizacao_id AND id=NEW.avaliacao_id;
 SELECT * INTO STRICT ev FROM evento_cobertura WHERE organizacao_id=NEW.organizacao_id AND id=av.evento_id;
 PERFORM 1 FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=ev.episodio_id FOR UPDATE;
 SELECT * INTO STRICT u FROM uso_cobertura WHERE organizacao_id=NEW.organizacao_id AND id=NEW.uso_id;SELECT * INTO STRICT r FROM regra_pacote WHERE organizacao_id=NEW.organizacao_id AND id=u.regra_id;
 SELECT * INTO total,ja FROM compromisso_cobertura(u.id,ev.item_clinico_id);
 IF r.id IS DISTINCT FROM regra_cobertura_vigente(ev.id,av.periodo_diaria_id) OR (r.janela='periodo' AND u.periodo_diaria_id IS DISTINCT FROM av.periodo_diaria_id) THEN RAISE EXCEPTION 'Alocacao fora da regra elegivel' USING ERRCODE='23514'; END IF;
 IF av.uso_id IS DISTINCT FROM NEW.uso_id OR ev.episodio_id<>u.episodio_id OR NEW.quantidade IS DISTINCT FROM (CASE WHEN r.dimensao='quantidade_fisica' THEN ev.quantidade_fisica ELSE 1 END) OR
 (NEW.incluida>0 AND r.tratamento='excluido') OR (r.limite_quantidade IS NOT NULL AND NOT(r.dimensao='itens_distintos' AND ja) AND total+NEW.incluida>r.limite_quantidade) OR
 (av.resultado='incluido' AND NEW.excedente<>0) OR (av.resultado='parcial' AND (NEW.incluida=0 OR NEW.excedente=0)) OR (av.resultado IN ('excedente','excluido') AND NEW.incluida<>0) OR
 NOT EXISTS(SELECT 1 FROM comando WHERE organizacao_id=NEW.organizacao_id AND id=av.comando_id AND concluido_em IS NULL) THEN RAISE EXCEPTION 'Alocacao excede regra ou fato' USING ERRCODE='23514'; END IF;RETURN NEW;
END $$;
CREATE TRIGGER alocacao_cobertura_validar BEFORE INSERT ON alocacao_cobertura FOR EACH ROW EXECUTE FUNCTION validar_alocacao_cobertura();
CREATE FUNCTION validar_integridade_cobertura() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='avaliacao_cobertura' THEN
 IF (NEW.resultado<>'pendente')<>(EXISTS(SELECT 1 FROM alocacao_cobertura WHERE organizacao_id=NEW.organizacao_id AND avaliacao_id=NEW.id)) THEN RAISE EXCEPTION 'Avaliacao exige alocacao coerente' USING ERRCODE='23514'; END IF;
 ELSE
 IF NEW.situacao='efetivada' AND NOT EXISTS(SELECT 1 FROM avaliacao_cobertura WHERE organizacao_id=NEW.organizacao_id AND reserva_id=NEW.id) THEN RAISE EXCEPTION 'Reserva efetivada sem avaliacao' USING ERRCODE='23514'; END IF;
 END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER cobertura_completa AFTER INSERT ON avaliacao_cobertura DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validar_integridade_cobertura();
CREATE CONSTRAINT TRIGGER cobertura_completa AFTER UPDATE ON reserva_cobertura DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validar_integridade_cobertura();
CREATE VIEW avaliacao_cobertura_consulta WITH(security_invoker=true) AS
 SELECT av.*,ev.episodio_id,a.quantidade,a.incluida,a.excedente,u.regra_id,
 CASE WHEN r.id IS NOT NULL THEN 'revertida' WHEN NOT ev.origem_ativa OR coalesce(p.necessita_revisao,false) THEN 'revisao_necessaria' ELSE av.resultado END AS situacao_atual
 FROM avaliacao_cobertura av JOIN evento_cobertura_consulta ev ON ev.organizacao_id=av.organizacao_id AND ev.id=av.evento_id
 LEFT JOIN alocacao_cobertura a ON a.organizacao_id=av.organizacao_id AND a.avaliacao_id=av.id LEFT JOIN uso_cobertura u ON u.organizacao_id=av.organizacao_id AND u.id=av.uso_id
 LEFT JOIN periodo_diaria_consulta p ON p.organizacao_id=av.organizacao_id AND p.id=av.periodo_diaria_id LEFT JOIN reversao_cobertura r ON r.organizacao_id=av.organizacao_id AND r.avaliacao_id=av.id;
DO $$ DECLARE f text; BEGIN FOREACH f IN ARRAY ARRAY['validar_catalogo_diaria','validar_configuracao_pacote','validar_contexto_diaria','validar_evento_cobertura','validar_uso_cobertura','validar_reserva_cobertura','validar_avaliacao_cobertura','validar_alocacao_cobertura','validar_integridade_cobertura'] LOOP EXECUTE format('REVOKE ALL ON FUNCTION hvb.%I() FROM PUBLIC',f);END LOOP;END $$;
