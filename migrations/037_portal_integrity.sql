SET search_path=hvb,public;
CREATE FUNCTION travar_conta_portal(p_org uuid,p_conta uuid) RETURNS void LANGUAGE sql SET search_path=hvb,pg_temp AS $$
 SELECT pg_advisory_xact_lock(hashtextextended('portal:'||p_org::text||':'||p_conta::text,0));
$$;
CREATE FUNCTION conta_portal_ativa(p_org uuid,p_conta uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=hvb,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM conta_portal c WHERE c.organizacao_id=p_org AND c.id=p_conta AND NOT EXISTS(SELECT 1 FROM revogacao_conta_portal r WHERE r.organizacao_id=c.organizacao_id AND r.conta_portal_id=c.id));
$$;
CREATE FUNCTION autenticar_portal(hash text) RETURNS TABLE(organizacao_id uuid,conta_portal_id uuid,credencial_id uuid) LANGUAGE sql SECURITY DEFINER SET search_path=hvb,pg_temp AS $$
 SELECT c.organizacao_id,c.conta_portal_id,c.id FROM credencial_portal c WHERE c.token_hash=hash AND c.expira_em>now() AND conta_portal_ativa(c.organizacao_id,c.conta_portal_id);
$$;
REVOKE ALL ON FUNCTION autenticar_portal(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION autenticar_portal(text) TO hvb_app;
CREATE VIEW concessao_portal_consulta WITH(security_invoker=true) AS
 SELECT g.*,c.responsavel_id,conta_portal_ativa(g.organizacao_id,c.id) AND g.valida_ate>now() AND v.inicio<=now() AND (v.fim IS NULL OR v.fim>now()) AND NOT EXISTS(SELECT 1 FROM revogacao_concessao_portal r WHERE r.organizacao_id=g.organizacao_id AND r.concessao_id=g.id) AS vigente
 FROM concessao_portal g JOIN conta_portal c ON c.organizacao_id=g.organizacao_id AND c.id=g.conta_portal_id JOIN paciente_responsavel v ON v.organizacao_id=g.organizacao_id AND v.id=g.vinculo_id;
CREATE VIEW preferencia_comunicacao_consulta WITH(security_invoker=true) AS SELECT p.*,NOT EXISTS(SELECT 1 FROM preferencia_comunicacao n WHERE n.organizacao_id=p.organizacao_id AND n.conta_portal_id=p.conta_portal_id AND n.finalidade=p.finalidade AND n.versao>p.versao) AS atual FROM preferencia_comunicacao p;
CREATE FUNCTION documento_apto_portal(p_org uuid,p_doc uuid,p_concessao uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=hvb,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM documento_versao_consulta d JOIN solicitacao_documento_consulta s ON s.organizacao_id=d.organizacao_id AND s.id=d.solicitacao_id JOIN concessao_portal_consulta g ON g.organizacao_id=d.organizacao_id AND g.id=p_concessao WHERE d.organizacao_id=p_org AND d.id=p_doc AND d.unidade_id=g.unidade_id AND d.paciente_id=g.paciente_id AND s.solicitante_responsavel_id=g.responsavel_id AND d.publico='responsavel' AND d.aprovado AND NOT d.ha_versao_posterior AND s.acesso_vigente AND g.vigente);
$$;
CREATE FUNCTION mensagem_apta_portal(p_org uuid,p_mensagem uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=hvb,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM mensagem_portal m JOIN concessao_portal_consulta g ON g.organizacao_id=m.organizacao_id AND g.id=m.concessao_id WHERE m.organizacao_id=p_org AND m.id=p_mensagem AND g.vigente
 AND NOT EXISTS(SELECT 1 FROM mensagem_documento d WHERE d.organizacao_id=m.organizacao_id AND d.mensagem_id=m.id AND NOT documento_apto_portal(m.organizacao_id,d.documento_versao_id,g.id))
 AND (m.agendamento_versao_id IS NULL OR EXISTS(SELECT 1 FROM agenda_mapa_consulta a WHERE a.organizacao_id=m.organizacao_id AND a.id=m.agendamento_versao_id AND a.paciente_id=g.paciente_id AND a.responsavel_id=g.responsavel_id)));
$$;
CREATE VIEW mensagem_portal_consulta WITH(security_invoker=true) AS
 SELECT m.id,m.organizacao_id,m.unidade_id,m.autor_id,m.comando_id,m.motivo,m.criada_em,m.concessao_id,g.conta_portal_id,g.paciente_id,m.finalidade,m.canal,m.origem,m.referencia,m.titulo,m.agendamento_versao_id,
 coalesce((SELECT coalesce((SELECT r.estado FROM retorno_comunicacao r WHERE r.organizacao_id=t.organizacao_id AND r.tentativa_id=t.id ORDER BY r.sequencia DESC LIMIT 1),'em_tentativa') FROM tentativa_comunicacao t WHERE t.organizacao_id=m.organizacao_id AND t.mensagem_id=m.id ORDER BY t.sequencia DESC LIMIT 1),'preparada') AS situacao,
 mensagem_apta_portal(m.organizacao_id,m.id) AS acesso_vigente
 FROM mensagem_portal m JOIN concessao_portal g ON g.organizacao_id=m.organizacao_id AND g.id=m.concessao_id;
CREATE FUNCTION validar_portal() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
#variable_conflict use_column
DECLARE conta uuid;g concessao_portal_consulta;m mensagem_portal;t tentativa_comunicacao;r retorno_comunicacao;n integer;estado_atual text;
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'conta_portal' THEN RETURN NEW;
 WHEN 'revogacao_conta_portal' THEN conta:=NEW.conta_portal_id;
 WHEN 'concessao_portal' THEN conta:=NEW.conta_portal_id;
 WHEN 'revogacao_concessao_portal' THEN SELECT conta_portal_id INTO STRICT conta FROM concessao_portal WHERE organizacao_id=NEW.organizacao_id AND id=NEW.concessao_id;
 WHEN 'preferencia_comunicacao' THEN conta:=NEW.conta_portal_id;
 ELSE
 IF TG_TABLE_NAME='mensagem_portal' THEN SELECT * INTO STRICT g FROM concessao_portal_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.concessao_id;
 ELSE
 IF TG_TABLE_NAME='retorno_comunicacao' THEN SELECT * INTO STRICT t FROM tentativa_comunicacao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.tentativa_id;SELECT * INTO STRICT m FROM mensagem_portal WHERE organizacao_id=NEW.organizacao_id AND id=t.mensagem_id;
 ELSE SELECT * INTO STRICT m FROM mensagem_portal WHERE organizacao_id=NEW.organizacao_id AND id=NEW.mensagem_id;END IF;
 SELECT * INTO STRICT g FROM concessao_portal_consulta WHERE organizacao_id=NEW.organizacao_id AND id=m.concessao_id;
 END IF;conta:=g.conta_portal_id;
 END CASE;
 PERFORM travar_conta_portal(NEW.organizacao_id,conta);
 IF TG_TABLE_NAME NOT IN ('revogacao_conta_portal','revogacao_concessao_portal','retorno_comunicacao') AND NOT conta_portal_ativa(NEW.organizacao_id,conta) THEN RAISE EXCEPTION 'Conta portal revogada' USING ERRCODE='23514';END IF;
 CASE TG_TABLE_NAME
 WHEN 'concessao_portal' THEN
 IF NEW.valida_ate<=now() OR NOT EXISTS(SELECT 1 FROM paciente_responsavel v JOIN conta_portal c ON c.organizacao_id=v.organizacao_id AND c.responsavel_id=v.responsavel_id WHERE v.organizacao_id=NEW.organizacao_id AND v.id=NEW.vinculo_id AND v.paciente_id=NEW.paciente_id AND c.id=conta AND v.inicio<=now() AND (v.fim IS NULL OR v.fim>now())) THEN RAISE EXCEPTION 'Concessao exige vinculo vigente e decisao explicita' USING ERRCODE='23514';END IF;
 WHEN 'preferencia_comunicacao' THEN
 SELECT coalesce(max(versao),0)+1 INTO n FROM preferencia_comunicacao WHERE organizacao_id=NEW.organizacao_id AND conta_portal_id=conta AND finalidade=NEW.finalidade;
 IF NEW.versao<>n THEN RAISE EXCEPTION 'Preferencia exige versao esperada' USING ERRCODE='23514';END IF;
 WHEN 'mensagem_portal' THEN
 IF NOT g.vigente OR NOT EXISTS(SELECT 1 FROM preferencia_comunicacao_consulta p WHERE p.organizacao_id=NEW.organizacao_id AND p.conta_portal_id=conta AND p.finalidade=NEW.finalidade AND p.atual AND p.permitida) THEN RAISE EXCEPTION 'Concessao ou preferencia ausente' USING ERRCODE='23514';END IF;
 IF NEW.agendamento_versao_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM agenda_mapa_consulta a WHERE a.organizacao_id=NEW.organizacao_id AND a.id=NEW.agendamento_versao_id AND a.paciente_id=g.paciente_id AND a.responsavel_id=g.responsavel_id) THEN RAISE EXCEPTION 'Agenda incompativel' USING ERRCODE='23514';END IF;
 WHEN 'mensagem_documento' THEN
 IF m.comando_id<>NEW.comando_id OR m.finalidade<>'documento' OR NOT documento_apto_portal(NEW.organizacao_id,NEW.documento_versao_id,g.id) THEN RAISE EXCEPTION 'Documento privado, obsoleto ou destinatario divergente' USING ERRCODE='23514';END IF;
 WHEN 'tentativa_comunicacao' THEN
 IF NOT mensagem_apta_portal(NEW.organizacao_id,m.id) OR NOT EXISTS(SELECT 1 FROM preferencia_comunicacao_consulta p WHERE p.organizacao_id=NEW.organizacao_id AND p.conta_portal_id=conta AND p.finalidade=m.finalidade AND p.atual AND p.permitida) THEN RAISE EXCEPTION 'Mensagem exige revisao de acesso ou preferencia' USING ERRCODE='23514';END IF;
 SELECT * INTO t FROM tentativa_comunicacao WHERE organizacao_id=NEW.organizacao_id AND mensagem_id=m.id ORDER BY sequencia DESC LIMIT 1;
 SELECT estado INTO estado_atual FROM retorno_comunicacao WHERE organizacao_id=NEW.organizacao_id AND tentativa_id=t.id ORDER BY sequencia DESC LIMIT 1;
 IF NEW.sequencia<>coalesce(t.sequencia,0)+1 OR (t.id IS NOT NULL AND estado_atual IS DISTINCT FROM 'falha') THEN RAISE EXCEPTION 'Resultado incerto ou concluido impede repetir tentativa' USING ERRCODE='23514';END IF;
 WHEN 'retorno_comunicacao' THEN
 SELECT * INTO r FROM retorno_comunicacao WHERE organizacao_id=NEW.organizacao_id AND tentativa_id=t.id ORDER BY sequencia DESC LIMIT 1;
 IF NEW.sequencia<>coalesce(r.sequencia,0)+1 OR NEW.ocorrido_em>now() OR NEW.ocorrido_em<t.criada_em OR NEW.ocorrido_em<r.ocorrido_em THEN RAISE EXCEPTION 'Retorno exige sequencia e instante valido' USING ERRCODE='23514';END IF;
 IF r.id IS NOT NULL AND NOT ((r.estado='incerto' AND NEW.estado IN ('falha','enviado','entregue','lido')) OR (r.estado='enviado' AND NEW.estado IN ('entregue','lido')) OR (r.estado='entregue' AND NEW.estado='lido')) THEN RAISE EXCEPTION 'Retorno exige conciliacao sem regressao' USING ERRCODE='23514';END IF;
 ELSE NULL;
 END CASE;RETURN NEW;
END $$;
CREATE FUNCTION fechar_mensagem_portal() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 IF NEW.finalidade='documento' AND NOT EXISTS(SELECT 1 FROM mensagem_documento WHERE organizacao_id=NEW.organizacao_id AND mensagem_id=NEW.id) THEN RAISE EXCEPTION 'Mensagem documental sem versao atomica' USING ERRCODE='23514';END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER documento_completo AFTER INSERT ON mensagem_portal DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fechar_mensagem_portal();
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['conta_portal','revogacao_conta_portal','concessao_portal','revogacao_concessao_portal','preferencia_comunicacao','mensagem_portal','mensagem_documento','tentativa_comunicacao','retorno_comunicacao'] LOOP EXECUTE format('CREATE TRIGGER b_validar BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION validar_portal()',t);END LOOP;END $$;
REVOKE ALL ON FUNCTION validar_portal(),fechar_mensagem_portal() FROM PUBLIC;
