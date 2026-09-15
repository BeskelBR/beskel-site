SET search_path=hvb,public;
CREATE FUNCTION travar_etiqueta(p_org uuid,p_etiqueta uuid) RETURNS void LANGUAGE sql SET search_path=hvb,pg_temp AS $$
 SELECT pg_advisory_xact_lock(hashtextextended('etiqueta:'||p_org::text||':'||p_etiqueta::text,0));
$$;
CREATE VIEW etiqueta_terminal_consulta WITH(security_invoker=true) AS SELECT e.*,NOT EXISTS(SELECT 1 FROM revogacao_etiqueta_terminal r WHERE r.organizacao_id=e.organizacao_id AND r.etiqueta_id=e.id) AS ativa FROM etiqueta_terminal e;
CREATE VIEW leitura_terminal_consulta WITH(security_invoker=true) AS SELECT l.*,e.paciente_id,e.posicao_id,e.ativa AS etiqueta_ativa,EXISTS(SELECT 1 FROM retirada_terminal r WHERE r.organizacao_id=l.organizacao_id AND r.leitura_id=l.id) AS utilizada FROM leitura_terminal l JOIN etiqueta_terminal_consulta e ON e.organizacao_id=l.organizacao_id AND e.id=l.etiqueta_id;
CREATE FUNCTION validar_contexto_terminal(p_org uuid,p_etiqueta uuid,p_episodio uuid) RETURNS void LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE e etiqueta_terminal_consulta;ep episodio;c custodia;
BEGIN
 PERFORM travar_etiqueta(p_org,p_etiqueta);
 SELECT * INTO STRICT e FROM etiqueta_terminal_consulta WHERE organizacao_id=p_org AND id=p_etiqueta;
 IF NOT e.ativa THEN RAISE EXCEPTION 'Etiqueta revogada' USING ERRCODE='23514';END IF;
 IF p_episodio IS NOT NULL THEN
 SELECT * INTO STRICT ep FROM episodio WHERE organizacao_id=p_org AND id=p_episodio FOR SHARE;
 IF ep.unidade_id<>e.unidade_id OR ep.encerrado_em IS NOT NULL OR (e.paciente_id IS NOT NULL AND ep.paciente_id<>e.paciente_id) THEN RAISE EXCEPTION 'Episodio divergente ou encerrado' USING ERRCODE='23514';END IF;
 IF e.posicao_id IS NOT NULL THEN
 SELECT cu.* INTO STRICT c FROM custodia cu JOIN posicao_estoque p ON p.organizacao_id=cu.organizacao_id AND p.custodia_id=cu.id WHERE p.organizacao_id=p_org AND p.id=e.posicao_id;
 IF c.tipo='tutor' AND (c.paciente_id<>ep.paciente_id OR (c.episodio_id IS NOT NULL AND c.episodio_id<>ep.id)) THEN RAISE EXCEPTION 'Custodia de outro paciente ou episodio' USING ERRCODE='23514';END IF;
 END IF;
 END IF;
END $$;
CREATE FUNCTION validar_terminal() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE l leitura_terminal;e etiqueta_terminal;t transacao_estoque;cmd comando;d dispositivo;
BEGIN
 IF TG_TABLE_NAME='revogacao_etiqueta_terminal' THEN PERFORM travar_etiqueta(NEW.organizacao_id,NEW.etiqueta_id);RETURN NEW;END IF;
 SELECT * INTO STRICT cmd FROM comando WHERE organizacao_id=NEW.organizacao_id AND id=NEW.comando_id;
 SELECT * INTO STRICT d FROM dispositivo WHERE organizacao_id=NEW.organizacao_id AND id=cmd.dispositivo_id FOR SHARE;
 IF NOT d.ativo OR d.unidade_id<>NEW.unidade_id THEN RAISE EXCEPTION 'Dispositivo inativo ou de outra unidade' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME='leitura_terminal' THEN
 IF NEW.dispositivo_id<>d.id OR NEW.ocorrida_em>now() THEN RAISE EXCEPTION 'Leitura diverge do dispositivo ou tempo' USING ERRCODE='23514';END IF;
 PERFORM validar_contexto_terminal(NEW.organizacao_id,NEW.etiqueta_id,NEW.episodio_id);
 ELSE
 SELECT * INTO STRICT l FROM leitura_terminal WHERE organizacao_id=NEW.organizacao_id AND id=NEW.leitura_id;
 IF l.dispositivo_id<>d.id OR l.autor_id<>NEW.autor_id THEN RAISE EXCEPTION 'Leitura pertence a outro operador ou dispositivo' USING ERRCODE='23514';END IF;
 PERFORM validar_contexto_terminal(NEW.organizacao_id,l.etiqueta_id,l.episodio_id);
 SELECT * INTO STRICT e FROM etiqueta_terminal WHERE organizacao_id=NEW.organizacao_id AND id=l.etiqueta_id;
 SELECT * INTO STRICT t FROM transacao_estoque WHERE organizacao_id=NEW.organizacao_id AND id=NEW.id;
 IF e.posicao_id IS NULL OR t.origem_id<>e.posicao_id OR t.tipo<>'retirada' OR t.comando_id<>NEW.comando_id OR t.ocorrido_em<l.ocorrida_em THEN RAISE EXCEPTION 'Retirada diverge da leitura ou comando' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER b_validar BEFORE INSERT ON revogacao_etiqueta_terminal FOR EACH ROW EXECUTE FUNCTION validar_terminal();
CREATE TRIGGER b_validar BEFORE INSERT ON leitura_terminal FOR EACH ROW EXECUTE FUNCTION validar_terminal();
CREATE TRIGGER b_validar BEFORE INSERT ON retirada_terminal FOR EACH ROW EXECUTE FUNCTION validar_terminal();
REVOKE ALL ON FUNCTION validar_terminal() FROM PUBLIC;
