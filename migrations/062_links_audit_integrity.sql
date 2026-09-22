SET search_path=hvb,public;
CREATE FUNCTION validar_vinculo_agendamento() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE a agendamento_versao_consulta;e episodio;
BEGIN
 IF TG_TABLE_NAME='vinculo_agendamento_episodio' THEN
  SELECT * INTO STRICT e FROM episodio WHERE organizacao_id=NEW.organizacao_id AND unidade_id=NEW.unidade_id AND id=NEW.episodio_id FOR SHARE;
  PERFORM travar_agenda(NEW.organizacao_id,NEW.unidade_id);
  SELECT * INTO STRICT a FROM agendamento_versao_consulta WHERE organizacao_id=NEW.organizacao_id AND unidade_id=NEW.unidade_id AND id=NEW.agendamento_versao_id;
  IF NOT a.atual OR a.situacao NOT IN ('chegou','concluido') OR e.paciente_id<>a.paciente_id OR e.versao<>NEW.episodio_versao THEN RAISE EXCEPTION 'Vinculo exige chegada/conclusao, versao atual e mesmo paciente' USING ERRCODE='23514';END IF;
  IF EXISTS(SELECT 1 FROM vinculo_agendamento_episodio v JOIN agendamento_versao av ON av.organizacao_id=v.organizacao_id AND av.id=v.agendamento_versao_id WHERE v.organizacao_id=NEW.organizacao_id AND av.agendamento_id=a.agendamento_id AND NOT EXISTS(SELECT 1 FROM revogacao_vinculo_agendamento r WHERE r.organizacao_id=v.organizacao_id AND r.vinculo_id=v.id)) THEN RAISE EXCEPTION 'Agendamento ja vinculado; revogue antes de corrigir' USING ERRCODE='23514';END IF;
 ELSE PERFORM travar_agenda(NEW.organizacao_id,NEW.unidade_id);
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER b_validar BEFORE INSERT ON vinculo_agendamento_episodio FOR EACH ROW EXECUTE FUNCTION validar_vinculo_agendamento();
CREATE TRIGGER b_validar BEFORE INSERT ON revogacao_vinculo_agendamento FOR EACH ROW EXECUTE FUNCTION validar_vinculo_agendamento();
CREATE VIEW vinculo_agendamento_consulta WITH(security_invoker=true) AS
 SELECT v.*,a.agendamento_id,a.paciente_id,a.situacao,a.atual,
 EXISTS(SELECT 1 FROM revogacao_vinculo_agendamento r WHERE r.organizacao_id=v.organizacao_id AND r.vinculo_id=v.id) AS revogada,
 a.atual AND a.situacao IN ('chegou','concluido') AND NOT EXISTS(SELECT 1 FROM revogacao_vinculo_agendamento r WHERE r.organizacao_id=v.organizacao_id AND r.vinculo_id=v.id) AS vigente,
 (NOT a.atual OR a.situacao NOT IN ('chegou','concluido')) AND NOT EXISTS(SELECT 1 FROM revogacao_vinculo_agendamento r WHERE r.organizacao_id=v.organizacao_id AND r.vinculo_id=v.id) AS necessita_revisao
 FROM vinculo_agendamento_episodio v JOIN agendamento_versao_consulta a ON a.organizacao_id=v.organizacao_id AND a.id=v.agendamento_versao_id;
CREATE FUNCTION validar_leitura_auditada() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE k text;v jsonb;
BEGIN
 IF NEW.usuario_id IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM credencial WHERE organizacao_id=NEW.organizacao_id AND id=NEW.credencial_id AND usuario_id=NEW.usuario_id) THEN RAISE EXCEPTION 'Identidade divergente na auditoria' USING ERRCODE='23514';END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM credencial_portal WHERE organizacao_id=NEW.organizacao_id AND id=NEW.credencial_portal_id AND conta_portal_id=NEW.conta_portal_id) THEN RAISE EXCEPTION 'Conta divergente na auditoria' USING ERRCODE='23514';END IF;
 END IF;
 IF jsonb_typeof(NEW.parametros)<>'object' THEN RAISE EXCEPTION 'Parametros invalidos' USING ERRCODE='23514';END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(NEW.parametros))>64 THEN RAISE EXCEPTION 'Parametros excessivos' USING ERRCODE='23514';END IF;
 FOR k,v IN SELECT * FROM jsonb_each(NEW.parametros) LOOP
  IF k !~ '^(id|[a-z_]+_id)$' OR jsonb_typeof(v)<>'string' OR (v#>>'{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Auditoria aceita somente identificadores' USING ERRCODE='23514';END IF;
 END LOOP;RETURN NEW;
END $$;
CREATE TRIGGER validar BEFORE INSERT ON leitura_auditada FOR EACH ROW EXECUTE FUNCTION validar_leitura_auditada();
REVOKE ALL ON FUNCTION validar_vinculo_agendamento(),validar_leitura_auditada() FROM PUBLIC;
