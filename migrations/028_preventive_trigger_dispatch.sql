SET search_path=hvb,public;
-- Resolve table-specific NEW fields only in their matching trigger branch.
CREATE OR REPLACE FUNCTION validar_protocolo() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
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
 IF TG_TABLE_NAME='aplicacao_preventiva' THEN
 IF NEW.execucao_id IS NOT NULL THEN
 SELECT * INTO STRICT ex FROM execucao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.execucao_id;ep:=ex.episodio_id;END IF;
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
