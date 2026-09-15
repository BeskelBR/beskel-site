SET search_path=hvb,public;
CREATE FUNCTION travar_evolucao(p_org uuid,p_evolucao uuid) RETURNS void LANGUAGE sql SET search_path=hvb,pg_temp AS $$
 SELECT pg_advisory_xact_lock(hashtextextended('evolucao:'||p_org::text||':'||p_evolucao::text,0));
$$;
CREATE VIEW evolucao_clinica_versao_consulta WITH(security_invoker=true) AS SELECT v.id,v.organizacao_id,v.unidade_id,v.autor_id,v.comando_id,v.motivo,v.criada_em,v.evolucao_id,v.versao,v.anterior_id,v.estado,v.ocorrida_em,v.hash_conteudo,e.paciente_id,e.episodio_id,e.tipo,NOT EXISTS(SELECT 1 FROM evolucao_clinica_versao n WHERE n.organizacao_id=v.organizacao_id AND n.evolucao_id=v.evolucao_id AND n.versao>v.versao) AS atual FROM evolucao_clinica_versao v JOIN evolucao_clinica e ON e.organizacao_id=v.organizacao_id AND e.id=v.evolucao_id;
CREATE FUNCTION validar_evolucao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE e evolucao_clinica;p episodio;ant evolucao_clinica_versao;
BEGIN
 IF TG_TABLE_NAME='evolucao_clinica' THEN
 SELECT * INTO STRICT p FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=NEW.episodio_id FOR SHARE;
 IF p.paciente_id<>NEW.paciente_id OR p.unidade_id<>NEW.unidade_id THEN RAISE EXCEPTION 'Evolucao exige paciente e episodio coerentes' USING ERRCODE='23514';END IF;RETURN NEW;
 END IF;
 SELECT * INTO STRICT e FROM evolucao_clinica WHERE organizacao_id=NEW.organizacao_id AND id=NEW.evolucao_id;
 SELECT * INTO STRICT p FROM episodio WHERE organizacao_id=e.organizacao_id AND id=e.episodio_id FOR SHARE;
 PERFORM travar_evolucao(NEW.organizacao_id,e.id);
 SELECT * INTO ant FROM evolucao_clinica_versao WHERE organizacao_id=NEW.organizacao_id AND evolucao_id=e.id ORDER BY versao DESC LIMIT 1;
 IF NEW.versao<>coalesce(ant.versao,0)+1 OR NEW.anterior_id IS DISTINCT FROM ant.id OR (ant.id IS NULL AND e.comando_id<>NEW.comando_id) THEN RAISE EXCEPTION 'Versao ou comando inicial divergente' USING ERRCODE='23514';END IF;
 IF NEW.ocorrida_em>now() OR NEW.ocorrida_em<p.admitido_em OR NEW.ocorrida_em>coalesce(p.encerrado_em,p.alta_clinica_em,'infinity'::timestamptz) THEN RAISE EXCEPTION 'Instante da evolucao fora do episodio' USING ERRCODE='23514';END IF;
 NEW.hash_conteudo:=encode(sha256(convert_to(NEW.conteudo,'UTF8')),'hex');RETURN NEW;
END $$;
CREATE FUNCTION fechar_evolucao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM evolucao_clinica_versao WHERE organizacao_id=NEW.organizacao_id AND evolucao_id=NEW.id AND comando_id=NEW.comando_id) THEN RAISE EXCEPTION 'Evolucao sem versao inicial atomica' USING ERRCODE='23514';END IF;RETURN NULL;
END $$;
CREATE TRIGGER b_validar BEFORE INSERT ON evolucao_clinica FOR EACH ROW EXECUTE FUNCTION validar_evolucao();
CREATE TRIGGER b_validar BEFORE INSERT ON evolucao_clinica_versao FOR EACH ROW EXECUTE FUNCTION validar_evolucao();
CREATE CONSTRAINT TRIGGER evolucao_completa AFTER INSERT ON evolucao_clinica DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fechar_evolucao();
REVOKE ALL ON FUNCTION validar_evolucao(),fechar_evolucao() FROM PUBLIC;
