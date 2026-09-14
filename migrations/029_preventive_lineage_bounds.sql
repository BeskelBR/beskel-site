SET search_path=hvb,public;
CREATE OR REPLACE FUNCTION data_ocorrencia_preventiva(p_org uuid,p_adesao uuid,p_etapa uuid,p_seq integer) RETURNS text LANGUAGE plpgsql STABLE SET search_path=hvb,pg_temp AS $$
DECLARE p protocolo_paciente;e etapa_protocolo;base date;data date;passos integer;
BEGIN
 SELECT * INTO STRICT p FROM protocolo_paciente WHERE organizacao_id=p_org AND id=p_adesao;
 SELECT * INTO STRICT e FROM etapa_protocolo WHERE organizacao_id=p_org AND id=p_etapa;
 IF e.protocolo_versao_id<>p.protocolo_versao_id OR p_seq NOT BETWEEN 1 AND 1000 OR (e.recorrencia='unica' AND p_seq<>1) THEN RAISE EXCEPTION 'Etapa ou sequencia incompativel' USING ERRCODE='23514';END IF;
 base:=p.inicio_data::date+e.deslocamento_dias;passos:=e.intervalo*(p_seq-1);
 IF base>DATE '2100-12-31' OR (e.recorrencia='meses_calendario' AND passos>972) OR (e.recorrencia<>'meses_calendario' AND passos>29585) THEN RAISE EXCEPTION 'Planejamento fora do horizonte DEV 2020-2100' USING ERRCODE='23514';END IF;
 IF e.recorrencia='meses_calendario' THEN data:=(base+make_interval(months=>passos))::date;
 ELSE data:=base+passos;END IF;
 IF data>DATE '2100-12-31' THEN RAISE EXCEPTION 'Planejamento fora do horizonte DEV 2020-2100' USING ERRCODE='23514';END IF;
 RETURN to_char(data,'YYYY-MM-DD');
END $$;
CREATE FUNCTION validar_linhagem_preventiva() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE anterior uuid;
BEGIN
 IF TG_TABLE_NAME='aplicacao_preventiva' THEN
 IF NEW.origem='interna' THEN
 SELECT a.id INTO anterior FROM execucao e JOIN aplicacao_preventiva a ON a.organizacao_id=e.organizacao_id AND a.execucao_id=e.correcao_de_id WHERE e.organizacao_id=NEW.organizacao_id AND e.id=NEW.execucao_id;
 IF anterior IS NOT NULL AND NEW.correcao_de_id IS DISTINCT FROM anterior THEN RAISE EXCEPTION 'Execucao substituta deve corrigir a aplicacao anterior' USING ERRCODE='23514';END IF;
 END IF;
 ELSE
 IF EXISTS(SELECT 1 FROM ocorrencia_preventiva o JOIN aplicacao_preventiva a ON a.organizacao_id=o.organizacao_id AND a.ocorrencia_id=o.id WHERE o.organizacao_id=NEW.organizacao_id AND o.protocolo_paciente_id=NEW.protocolo_paciente_id AND a.ocorrida_em>NEW.encerrado_em) THEN RAISE EXCEPTION 'Encerramento anterior a aplicacao registrada exige revisao' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER c_linhagem BEFORE INSERT ON aplicacao_preventiva FOR EACH ROW EXECUTE FUNCTION validar_linhagem_preventiva();
CREATE TRIGGER c_linhagem BEFORE INSERT ON encerramento_protocolo FOR EACH ROW EXECUTE FUNCTION validar_linhagem_preventiva();
REVOKE ALL ON FUNCTION validar_linhagem_preventiva() FROM PUBLIC;
