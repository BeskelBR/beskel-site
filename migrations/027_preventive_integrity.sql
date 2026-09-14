SET search_path=hvb,public;
CREATE FUNCTION data_ocorrencia_preventiva(p_org uuid,p_adesao uuid,p_etapa uuid,p_seq integer) RETURNS text LANGUAGE plpgsql STABLE SET search_path=hvb,pg_temp AS $$
DECLARE p protocolo_paciente;e etapa_protocolo;base date;data date;
BEGIN
 SELECT * INTO STRICT p FROM protocolo_paciente WHERE organizacao_id=p_org AND id=p_adesao;
 SELECT * INTO STRICT e FROM etapa_protocolo WHERE organizacao_id=p_org AND id=p_etapa;
 IF e.protocolo_versao_id<>p.protocolo_versao_id OR p_seq NOT BETWEEN 1 AND 1000 OR (e.recorrencia='unica' AND p_seq<>1) THEN RAISE EXCEPTION 'Etapa ou sequencia incompativel' USING ERRCODE='23514';END IF;
 base:=p.inicio_data::date+e.deslocamento_dias;
 IF e.recorrencia='meses_calendario' THEN data:=(base+make_interval(months=>e.intervalo*(p_seq-1)))::date;
 ELSE data:=base+e.intervalo*(p_seq-1);END IF;
 RETURN to_char(data,'YYYY-MM-DD');
END $$;
CREATE VIEW aplicacao_preventiva_consulta WITH(security_invoker=true) AS
 SELECT a.*,p.paciente_id,o.protocolo_paciente_id,
 NOT EXISTS(SELECT 1 FROM aplicacao_preventiva n WHERE n.organizacao_id=a.organizacao_id AND n.correcao_de_id=a.id) AND (a.origem='externa' OR NOT EXISTS(SELECT 1 FROM execucao x WHERE x.organizacao_id=a.organizacao_id AND x.correcao_de_id=a.execucao_id)) AS ativa,
 EXISTS(SELECT 1 FROM vinculo_consumo_preventivo v JOIN consumo_item ci ON ci.organizacao_id=v.organizacao_id AND ci.id=v.consumo_item_id JOIN estorno_consumo es ON es.organizacao_id=ci.organizacao_id AND es.consumo_id=ci.consumo_id WHERE v.organizacao_id=a.organizacao_id AND v.aplicacao_id=a.id) AS material_revisao
 FROM aplicacao_preventiva a JOIN ocorrencia_preventiva o ON o.organizacao_id=a.organizacao_id AND o.id=a.ocorrencia_id JOIN protocolo_paciente p ON p.organizacao_id=o.organizacao_id AND p.id=o.protocolo_paciente_id;
CREATE VIEW ocorrencia_preventiva_consulta WITH(security_invoker=true) AS
 SELECT o.*,p.paciente_id,ep.item_clinico_id,
 CASE WHEN EXISTS(SELECT 1 FROM aplicacao_preventiva_consulta a WHERE a.organizacao_id=o.organizacao_id AND a.ocorrencia_id=o.id AND a.ativa) THEN 'realizada'
 WHEN EXISTS(SELECT 1 FROM aplicacao_preventiva a WHERE a.organizacao_id=o.organizacao_id AND a.ocorrencia_id=o.id) THEN 'revisao'
 WHEN EXISTS(SELECT 1 FROM encerramento_protocolo e WHERE e.organizacao_id=p.organizacao_id AND e.protocolo_paciente_id=p.id) THEN 'encerrada'
 WHEN o.prevista_data::date<(now() AT TIME ZONE u.fuso)::date THEN 'atrasada' ELSE 'planejada' END AS situacao
 FROM ocorrencia_preventiva o JOIN protocolo_paciente p ON p.organizacao_id=o.organizacao_id AND p.id=o.protocolo_paciente_id
 JOIN etapa_protocolo ep ON ep.organizacao_id=o.organizacao_id AND ep.id=o.etapa_id
 JOIN unidade_hospitalar u ON u.organizacao_id=o.organizacao_id AND u.id=o.unidade_id;
CREATE VIEW revisao_preventiva_consulta WITH(security_invoker=true) AS
 SELECT r.*,o.paciente_id,o.protocolo_paciente_id,o.situacao AS situacao_ocorrencia,
 CASE WHEN x.id IS NULL THEN 'aberta' ELSE 'resolvida' END AS situacao
 FROM revisao_preventiva r JOIN ocorrencia_preventiva_consulta o ON o.organizacao_id=r.organizacao_id AND o.id=r.ocorrencia_id LEFT JOIN resolucao_revisao_preventiva x ON x.organizacao_id=r.organizacao_id AND x.revisao_id=r.id;
CREATE VIEW consumo_preventivo_consulta WITH(security_invoker=true) AS
 SELECT v.*,ci.consumo_id,ci.posicao_id,po.lote_id,ci.quantidade_base,l.codigo AS lote_fisico_codigo,l.fabricante AS fabricante_fisico,
 EXISTS(SELECT 1 FROM estorno_consumo e WHERE e.organizacao_id=ci.organizacao_id AND e.consumo_id=ci.consumo_id) AS estornado
 FROM vinculo_consumo_preventivo v JOIN consumo_item ci ON ci.organizacao_id=v.organizacao_id AND ci.id=v.consumo_item_id JOIN posicao_estoque po ON po.organizacao_id=ci.organizacao_id AND po.id=ci.posicao_id JOIN lote l ON l.organizacao_id=po.organizacao_id AND l.id=po.lote_id;
CREATE FUNCTION validar_protocolo() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
#variable_conflict use_column
DECLARE p protocolo_paciente;et etapa_protocolo;oc ocorrencia_preventiva;ap aplicacao_preventiva;ant aplicacao_preventiva;ex execucao;v protocolo_versao;n integer;adesao uuid;pac uuid;ep uuid;fim timestamptz;fuso text;
BEGIN
 IF TG_TABLE_NAME='protocolo_versao' THEN
 PERFORM pg_advisory_xact_lock(hashtextextended('protocolo:'||NEW.organizacao_id::text||':'||NEW.protocolo_id::text,0));
 SELECT coalesce(max(versao),0)+1 INTO n FROM protocolo_versao WHERE organizacao_id=NEW.organizacao_id AND protocolo_id=NEW.protocolo_id;
 IF NEW.versao<>n THEN RAISE EXCEPTION 'Versao nao consecutiva' USING ERRCODE='23514';END IF;RETURN NEW;
 ELSIF TG_TABLE_NAME='etapa_protocolo' THEN
 SELECT * INTO STRICT v FROM protocolo_versao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.protocolo_versao_id;
 IF v.comando_id<>NEW.comando_id THEN RAISE EXCEPTION 'Etapas devem ser atomicas com a versao' USING ERRCODE='23514';END IF;RETURN NEW;
 ELSIF TG_TABLE_NAME='aprovacao_protocolo' THEN
 IF NOT EXISTS(SELECT 1 FROM etapa_protocolo WHERE organizacao_id=NEW.organizacao_id AND protocolo_versao_id=NEW.protocolo_versao_id) THEN RAISE EXCEPTION 'Protocolo sem etapas' USING ERRCODE='23514';END IF;RETURN NEW;
 ELSIF TG_TABLE_NAME='protocolo_paciente' THEN
 SELECT * INTO STRICT v FROM protocolo_versao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.protocolo_versao_id;
 IF NOT EXISTS(SELECT 1 FROM aprovacao_protocolo WHERE organizacao_id=NEW.organizacao_id AND protocolo_versao_id=v.id) OR NOT EXISTS(SELECT 1 FROM paciente WHERE organizacao_id=NEW.organizacao_id AND id=NEW.paciente_id AND especie_codigo=v.especie_codigo) THEN RAISE EXCEPTION 'Adesao exige versao aprovada e especie compativel' USING ERRCODE='23514';END IF;RETURN NEW;
 END IF;
 IF TG_TABLE_NAME IN ('ocorrencia_preventiva','encerramento_protocolo') THEN adesao:=NEW.protocolo_paciente_id;
 ELSIF TG_TABLE_NAME IN ('aplicacao_preventiva','revisao_preventiva') THEN
 SELECT * INTO STRICT oc FROM ocorrencia_preventiva WHERE organizacao_id=NEW.organizacao_id AND id=NEW.ocorrencia_id;adesao:=oc.protocolo_paciente_id;
 ELSIF TG_TABLE_NAME='vinculo_consumo_preventivo' THEN
 SELECT * INTO STRICT ap FROM aplicacao_preventiva WHERE organizacao_id=NEW.organizacao_id AND id=NEW.aplicacao_id;
 SELECT * INTO STRICT oc FROM ocorrencia_preventiva WHERE organizacao_id=NEW.organizacao_id AND id=ap.ocorrencia_id;adesao:=oc.protocolo_paciente_id;
 ELSE
 SELECT o.* INTO STRICT oc FROM revisao_preventiva r JOIN ocorrencia_preventiva o ON o.organizacao_id=r.organizacao_id AND o.id=r.ocorrencia_id WHERE r.organizacao_id=NEW.organizacao_id AND r.id=NEW.revisao_id;adesao:=oc.protocolo_paciente_id;
 END IF;
 -- Clinical facts lock their episode before the preventive patient lock, matching clinical corrections/consumption.
 IF TG_TABLE_NAME='aplicacao_preventiva' AND NEW.execucao_id IS NOT NULL THEN
 SELECT * INTO STRICT ex FROM execucao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.execucao_id;ep:=ex.episodio_id;
 ELSIF TG_TABLE_NAME='vinculo_consumo_preventivo' AND ap.execucao_id IS NOT NULL THEN
 SELECT episodio_id INTO STRICT ep FROM execucao WHERE organizacao_id=NEW.organizacao_id AND id=ap.execucao_id;
 END IF;
 IF ep IS NOT NULL THEN PERFORM 1 FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=ep FOR UPDATE;END IF;
 SELECT * INTO STRICT p FROM protocolo_paciente WHERE organizacao_id=NEW.organizacao_id AND id=adesao;
 PERFORM pg_advisory_xact_lock(hashtextextended('preventivo-paciente:'||NEW.organizacao_id::text||':'||p.paciente_id::text,0));
 SELECT encerrado_em INTO fim FROM encerramento_protocolo WHERE organizacao_id=NEW.organizacao_id AND protocolo_paciente_id=p.id;
 SELECT u.fuso INTO STRICT fuso FROM unidade_hospitalar u WHERE u.organizacao_id=NEW.organizacao_id AND u.id=NEW.unidade_id;
 CASE TG_TABLE_NAME
 WHEN 'encerramento_protocolo' THEN
 IF NEW.encerrado_em>now() OR (NEW.encerrado_em AT TIME ZONE fuso)::date<p.inicio_data::date THEN RAISE EXCEPTION 'Encerramento incompativel' USING ERRCODE='23514';END IF;
 IF NEW.sucessor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM protocolo_paciente su WHERE su.organizacao_id=NEW.organizacao_id AND su.id=NEW.sucessor_id AND su.paciente_id=p.paciente_id AND NOT EXISTS(SELECT 1 FROM encerramento_protocolo en WHERE en.organizacao_id=su.organizacao_id AND en.protocolo_paciente_id=su.id)) THEN RAISE EXCEPTION 'Sucessor deve ser adesao ativa do mesmo paciente' USING ERRCODE='23514';END IF;
 WHEN 'ocorrencia_preventiva' THEN
 IF fim IS NOT NULL OR NEW.prevista_data<>data_ocorrencia_preventiva(NEW.organizacao_id,p.id,NEW.etapa_id,NEW.sequencia) THEN RAISE EXCEPTION 'Data planejada diverge da regra ou adesao encerrada' USING ERRCODE='23514';END IF;
 WHEN 'aplicacao_preventiva' THEN
 SELECT * INTO STRICT et FROM etapa_protocolo WHERE organizacao_id=NEW.organizacao_id AND id=oc.etapa_id;
 IF NEW.ocorrida_em>now() OR (NEW.ocorrida_em AT TIME ZONE fuso)::date<p.inicio_data::date OR NEW.ocorrida_em>fim THEN RAISE EXCEPTION 'Data da aplicacao incompativel' USING ERRCODE='23514';END IF;
 IF NEW.origem='interna' AND (ex.executada_em<>NEW.ocorrida_em OR ex.resultado<>'integral' OR NOT EXISTS(SELECT 1 FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=ex.episodio_id AND paciente_id=p.paciente_id) OR NOT EXISTS(SELECT 1 FROM ordem_versao WHERE organizacao_id=NEW.organizacao_id AND id=ex.ordem_versao_id AND item_clinico_id=et.item_clinico_id) OR EXISTS(SELECT 1 FROM execucao WHERE organizacao_id=NEW.organizacao_id AND correcao_de_id=ex.id)) THEN RAISE EXCEPTION 'Aplicacao interna exige execucao integral ativa do item e paciente' USING ERRCODE='23514';END IF;
 IF NEW.correcao_de_id IS NOT NULL THEN
 SELECT * INTO STRICT ant FROM aplicacao_preventiva WHERE organizacao_id=NEW.organizacao_id AND id=NEW.correcao_de_id;
 IF ant.ocorrencia_id<>NEW.ocorrencia_id OR ant.origem<>NEW.origem OR (NEW.origem='interna' AND ex.correcao_de_id IS DISTINCT FROM ant.execucao_id) THEN RAISE EXCEPTION 'Correcao deve preservar ocorrencia e linhagem clinica' USING ERRCODE='23514';END IF;
 END IF;
 WHEN 'vinculo_consumo_preventivo' THEN
 IF ap.origem<>'interna' OR NOT EXISTS(SELECT 1 FROM aplicacao_preventiva_consulta WHERE organizacao_id=NEW.organizacao_id AND id=ap.id AND ativa) OR NOT EXISTS(SELECT 1 FROM consumo_item ci JOIN consumo c ON c.organizacao_id=ci.organizacao_id AND c.id=ci.consumo_id WHERE ci.organizacao_id=NEW.organizacao_id AND ci.unidade_id=NEW.unidade_id AND ci.id=NEW.consumo_item_id AND c.execucao_id=ap.execucao_id AND NOT EXISTS(SELECT 1 FROM estorno_consumo es WHERE es.organizacao_id=c.organizacao_id AND es.consumo_id=c.id)) THEN RAISE EXCEPTION 'Vinculo exige consumo ativo da execucao interna' USING ERRCODE='23514';END IF;
 WHEN 'revisao_preventiva' THEN
 IF NEW.observada_em>now() OR oc.prevista_data::date>=(NEW.observada_em AT TIME ZONE fuso)::date OR fim IS NOT NULL OR EXISTS(SELECT 1 FROM aplicacao_preventiva_consulta WHERE organizacao_id=NEW.organizacao_id AND ocorrencia_id=oc.id AND ativa) THEN RAISE EXCEPTION 'Revisao por atraso exige ocorrencia vencida sem aplicacao ativa' USING ERRCODE='23514';END IF;
 ELSE NULL;
 END CASE;RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['protocolo_versao','etapa_protocolo','aprovacao_protocolo','protocolo_paciente','encerramento_protocolo','ocorrencia_preventiva','aplicacao_preventiva','vinculo_consumo_preventivo','revisao_preventiva','resolucao_revisao_preventiva'] LOOP EXECUTE format('CREATE TRIGGER b_validar BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION validar_protocolo()',t);END LOOP;
END $$;
REVOKE ALL ON FUNCTION validar_protocolo() FROM PUBLIC;
