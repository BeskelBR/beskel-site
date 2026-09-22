SET search_path=hvb,public;
CREATE FUNCTION bloquear_retirada_terminal_legada() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Terminal V2 registra acesso, nao retirada' USING ERRCODE='23514';END $$;
CREATE TRIGGER z_terminal_v2 BEFORE INSERT ON retirada_terminal FOR EACH ROW EXECUTE FUNCTION bloquear_retirada_terminal_legada();

CREATE FUNCTION bloquear_ordem_retirada(org uuid,ordem uuid) RETURNS void LANGUAGE sql AS $$ SELECT pg_advisory_xact_lock(hashtextextended('retirada:'||org::text||':'||ordem::text,0)) $$;
CREATE FUNCTION validar_ordem_retirada_v2() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE o ordem_retirada; e episodio; ultimo evento_ordem_retirada; s sessao_acesso; estado_sessao text;
BEGIN
 IF TG_TABLE_NAME='ordem_retirada' THEN
  SELECT * INTO STRICT e FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=NEW.episodio_id FOR SHARE;
  IF e.unidade_id<>NEW.unidade_id OR e.encerrado_em IS NOT NULL OR e.admitido_em>clock_timestamp() THEN RAISE EXCEPTION 'Episodio indisponivel' USING ERRCODE='23514';END IF;
  RETURN NEW;
 END IF;
 PERFORM bloquear_ordem_retirada(NEW.organizacao_id,NEW.ordem_id);
 SELECT * INTO STRICT o FROM ordem_retirada WHERE organizacao_id=NEW.organizacao_id AND id=NEW.ordem_id;
 SELECT * INTO ultimo FROM evento_ordem_retirada WHERE organizacao_id=NEW.organizacao_id AND ordem_id=NEW.ordem_id ORDER BY versao DESC LIMIT 1;
 IF TG_TABLE_NAME='item_ordem_retirada' THEN
  IF o.comando_id<>NEW.comando_id OR ultimo.id IS NOT NULL THEN RAISE EXCEPTION 'Itens imutaveis apos criacao' USING ERRCODE='23514';END IF;
 ELSIF TG_TABLE_NAME='sessao_ordem_retirada' THEN
  SELECT * INTO STRICT s FROM sessao_acesso WHERE organizacao_id=NEW.organizacao_id AND id=NEW.sessao_id;
  IF s.comando_id<>NEW.comando_id OR ultimo.estado IS NULL OR ultimo.estado NOT IN ('AGUARDANDO_RETIRADA','EM_SEPARACAO') OR (NOT s.sensivel AND EXISTS(SELECT 1 FROM item_ordem_retirada WHERE organizacao_id=NEW.organizacao_id AND ordem_id=NEW.ordem_id AND sensivel)) THEN RAISE EXCEPTION 'Ordem fora do escopo de acesso' USING ERRCODE='23514';END IF;
  IF EXISTS(SELECT 1 FROM sessao_ordem_retirada so JOIN sessao_acesso_consulta sc ON sc.organizacao_id=so.organizacao_id AND sc.id=so.sessao_id WHERE so.organizacao_id=NEW.organizacao_id AND so.ordem_id=NEW.ordem_id AND sc.estado<>'ACCESS_CLOSED' AND NOT sc.expirada) THEN RAISE EXCEPTION 'Ordem ja em acesso' USING ERRCODE='23514';END IF;
 ELSE
  IF NEW.versao<>coalesce(ultimo.versao,0)+1 THEN RAISE EXCEPTION 'Versao de ordem divergente' USING ERRCODE='23514';END IF;
  IF NEW.estado='RASCUNHO' THEN
   IF ultimo.id IS NOT NULL OR o.comando_id<>NEW.comando_id OR NOT EXISTS(SELECT 1 FROM item_ordem_retirada WHERE organizacao_id=NEW.organizacao_id AND ordem_id=o.id) THEN RAISE EXCEPTION 'Rascunho invalido' USING ERRCODE='23514';END IF;
  ELSIF NEW.estado='AGUARDANDO_RETIRADA' THEN
   IF ultimo.estado IS DISTINCT FROM 'RASCUNHO' THEN RAISE EXCEPTION 'Submit invalido' USING ERRCODE='23514';END IF;
  ELSIF NEW.estado='CANCELADA' THEN
   IF ultimo.estado IS NULL OR ultimo.estado NOT IN ('RASCUNHO','AGUARDANDO_RETIRADA') OR EXISTS(SELECT 1 FROM sessao_ordem_retirada so JOIN sessao_acesso_consulta sc ON sc.organizacao_id=so.organizacao_id AND sc.id=so.sessao_id WHERE so.organizacao_id=NEW.organizacao_id AND so.ordem_id=o.id AND sc.estado<>'ACCESS_CLOSED' AND NOT sc.expirada) THEN RAISE EXCEPTION 'Cancelamento exige ordem sem acesso ativo' USING ERRCODE='23514';END IF;
  ELSIF NEW.estado='EM_SEPARACAO' THEN
   IF ultimo.estado IS DISTINCT FROM 'AGUARDANDO_RETIRADA' OR NOT EXISTS(SELECT 1 FROM evento_acesso ev JOIN sessao_ordem_retirada so ON so.organizacao_id=ev.organizacao_id AND so.sessao_id=ev.sessao_id WHERE ev.organizacao_id=NEW.organizacao_id AND ev.id=NEW.evento_acesso_id AND ev.tipo='ENTRY_CONFIRMED' AND ev.comando_id=NEW.comando_id AND so.ordem_id=o.id) THEN RAISE EXCEPTION 'Separacao exige entrada fisica' USING ERRCODE='23514';END IF;
  END IF;
 END IF;
 IF TG_TABLE_NAME='evento_ordem_retirada' THEN
  IF NEW.estado='CANCELADA' THEN RETURN NEW; END IF;
 END IF;
 IF true THEN
  SELECT * INTO STRICT e FROM episodio WHERE organizacao_id=o.organizacao_id AND id=o.episodio_id FOR SHARE;
  IF e.encerrado_em IS NOT NULL THEN RAISE EXCEPTION 'Episodio encerrado' USING ERRCODE='23514';END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validar BEFORE INSERT ON ordem_retirada FOR EACH ROW EXECUTE FUNCTION validar_ordem_retirada_v2();
CREATE TRIGGER validar BEFORE INSERT ON item_ordem_retirada FOR EACH ROW EXECUTE FUNCTION validar_ordem_retirada_v2();
CREATE TRIGGER validar BEFORE INSERT ON evento_ordem_retirada FOR EACH ROW EXECUTE FUNCTION validar_ordem_retirada_v2();
CREATE TRIGGER validar BEFORE INSERT ON sessao_ordem_retirada FOR EACH ROW EXECUTE FUNCTION validar_ordem_retirada_v2();

CREATE FUNCTION validar_identidade_acesso_v2() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE d desafio_acesso; ev evidencia_acesso; au autenticacao_acesso; cred credencial; device uuid;
BEGIN
 SELECT dispositivo_id INTO device FROM comando WHERE organizacao_id=NEW.organizacao_id AND id=NEW.comando_id;
 IF TG_TABLE_NAME='desafio_acesso' THEN
  d:=NEW;
 ELSIF TG_TABLE_NAME='evidencia_acesso' THEN
  SELECT * INTO STRICT d FROM desafio_acesso WHERE organizacao_id=NEW.organizacao_id AND id=NEW.desafio_id;
  IF NEW.capturada_em<d.criada_em OR NEW.expira_em>d.expira_em OR NEW.dispositivo_biometrico_id<>d.dispositivo_id THEN RAISE EXCEPTION 'Evidencia temporal ou dispositivo divergente' USING ERRCODE='23514';END IF;
 ELSIF TG_TABLE_NAME='autenticacao_acesso' THEN
  SELECT * INTO STRICT ev FROM evidencia_acesso WHERE organizacao_id=NEW.organizacao_id AND id=NEW.evidencia_id;
  SELECT * INTO STRICT d FROM desafio_acesso WHERE organizacao_id=NEW.organizacao_id AND id=ev.desafio_id;
  IF ev.comando_id<>NEW.comando_id OR NEW.credencial_id<>d.credencial_id OR NEW.dispositivo_id<>d.dispositivo_id OR NEW.expira_em>ev.expira_em THEN RAISE EXCEPTION 'Autenticacao divergente' USING ERRCODE='23514';END IF;
 ELSE
  SELECT * INTO STRICT au FROM autenticacao_acesso WHERE organizacao_id=NEW.organizacao_id AND id=NEW.autenticacao_id;
  IF au.expira_em<=clock_timestamp() OR au.autor_id<>NEW.autor_id OR au.dispositivo_id<>NEW.dispositivo_id THEN RAISE EXCEPTION 'Autenticacao indisponivel' USING ERRCODE='23514';END IF;
  SELECT * INTO STRICT ev FROM evidencia_acesso WHERE organizacao_id=au.organizacao_id AND id=au.evidencia_id;
  SELECT * INTO STRICT d FROM desafio_acesso WHERE organizacao_id=ev.organizacao_id AND id=ev.desafio_id;
 END IF;
 SELECT * INTO STRICT cred FROM credencial WHERE organizacao_id=NEW.organizacao_id AND id=d.credencial_id FOR SHARE;
 IF d.autor_id<>NEW.autor_id OR d.unidade_id<>NEW.unidade_id OR d.dispositivo_id IS DISTINCT FROM device OR d.expira_em<=clock_timestamp() OR cred.usuario_id<>NEW.autor_id OR cred.revogada_em IS NOT NULL OR cred.expira_em<=clock_timestamp() THEN RAISE EXCEPTION 'Identidade indisponivel' USING ERRCODE='23514';END IF;
 IF NOT EXISTS(SELECT 1 FROM dispositivo WHERE organizacao_id=NEW.organizacao_id AND unidade_id=NEW.unidade_id AND id=device AND ativo) THEN RAISE EXCEPTION 'Dispositivo indisponivel' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validar BEFORE INSERT ON desafio_acesso FOR EACH ROW EXECUTE FUNCTION validar_identidade_acesso_v2();
CREATE TRIGGER validar BEFORE INSERT ON evidencia_acesso FOR EACH ROW EXECUTE FUNCTION validar_identidade_acesso_v2();
CREATE TRIGGER validar BEFORE INSERT ON autenticacao_acesso FOR EACH ROW EXECUTE FUNCTION validar_identidade_acesso_v2();
CREATE TRIGGER validar BEFORE INSERT ON sessao_acesso FOR EACH ROW EXECUTE FUNCTION validar_identidade_acesso_v2();

CREATE FUNCTION validar_evento_acesso_v2() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE s sessao_acesso; ultimo evento_acesso; au autenticacao_acesso; cred credencial; device uuid; permitido boolean;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('sessao-acesso:'||NEW.organizacao_id::text||':'||NEW.sessao_id::text,0));
 SELECT * INTO STRICT s FROM sessao_acesso WHERE organizacao_id=NEW.organizacao_id AND id=NEW.sessao_id;
 SELECT * INTO ultimo FROM evento_acesso WHERE organizacao_id=s.organizacao_id AND sessao_id=s.id ORDER BY versao DESC LIMIT 1;
 SELECT dispositivo_id INTO device FROM comando WHERE organizacao_id=NEW.organizacao_id AND id=NEW.comando_id;
 SELECT * INTO STRICT au FROM autenticacao_acesso WHERE organizacao_id=s.organizacao_id AND id=s.autenticacao_id;
 SELECT * INTO STRICT cred FROM credencial WHERE organizacao_id=au.organizacao_id AND id=au.credencial_id FOR SHARE;
 IF s.autor_id<>NEW.autor_id OR s.dispositivo_id<>NEW.dispositivo_id OR device IS DISTINCT FROM s.dispositivo_id OR NEW.versao<>coalesce(ultimo.versao,0)+1 OR NEW.ocorrida_em<s.criada_em OR NEW.ocorrida_em<ultimo.ocorrida_em OR (NEW.tipo<>'ACCESS_CLOSED' AND s.expira_em<=clock_timestamp()) OR cred.revogada_em IS NOT NULL OR cred.expira_em<=clock_timestamp() THEN RAISE EXCEPTION 'Evento fora da sessao, identidade ou prazo' USING ERRCODE='23514';END IF;
 permitido:=CASE NEW.tipo
 WHEN 'AUTHENTICATED' THEN ultimo.id IS NULL AND s.comando_id=NEW.comando_id
 WHEN 'DOOR_AUTHORIZED' THEN ultimo.tipo='AUTHENTICATED' AND au.expira_em>clock_timestamp()
 WHEN 'DOOR_OPEN' THEN ultimo.tipo='DOOR_AUTHORIZED'
 WHEN 'ENTRY_CONFIRMED' THEN ultimo.tipo='DOOR_OPEN'
 WHEN 'DOOR_CLOSED' THEN ultimo.tipo='ENTRY_CONFIRMED'
 WHEN 'SENSITIVE_CABINET_AUTHORIZED' THEN ultimo.tipo='DOOR_CLOSED' AND s.sensivel
 WHEN 'SENSITIVE_CABINET_OPEN' THEN ultimo.tipo='SENSITIVE_CABINET_AUTHORIZED'
 WHEN 'SENSITIVE_CABINET_CLOSED' THEN ultimo.tipo='SENSITIVE_CABINET_OPEN'
 WHEN 'ACCESS_ACTIVE' THEN ultimo.tipo IN ('DOOR_CLOSED','SENSITIVE_CABINET_CLOSED')
 WHEN 'EXIT' THEN ultimo.tipo='ACCESS_ACTIVE'
 WHEN 'ACCESS_CLOSED' THEN ultimo.tipo IN ('AUTHENTICATED','DOOR_AUTHORIZED','EXIT')
 ELSE false END;
 IF permitido IS DISTINCT FROM true THEN RAISE EXCEPTION 'Sequencia de barreira invalida' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validar BEFORE INSERT ON evento_acesso FOR EACH ROW EXECUTE FUNCTION validar_evento_acesso_v2();
CREATE FUNCTION confirmar_entrada_ordens_v2() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE o record; BEGIN
 IF NEW.tipo='ENTRY_CONFIRMED' THEN
  FOR o IN SELECT ordem_id FROM sessao_ordem_retirada WHERE organizacao_id=NEW.organizacao_id AND sessao_id=NEW.sessao_id ORDER BY ordem_id LOOP
   PERFORM bloquear_ordem_retirada(NEW.organizacao_id,o.ordem_id);
   INSERT INTO evento_ordem_retirada(id,organizacao_id,unidade_id,autor_id,comando_id,motivo,ordem_id,versao,estado,evento_acesso_id)
   SELECT gen_random_uuid(),NEW.organizacao_id,NEW.unidade_id,NEW.autor_id,NEW.comando_id,NEW.motivo,id,versao+1,'EM_SEPARACAO',NEW.id FROM ordem_retirada_consulta WHERE organizacao_id=NEW.organizacao_id AND id=o.ordem_id AND estado='AGUARDANDO_RETIRADA';
  END LOOP;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER entrada AFTER INSERT ON evento_acesso FOR EACH ROW EXECUTE FUNCTION confirmar_entrada_ordens_v2();
