SET search_path=hvb,public;
CREATE FUNCTION travar_agenda(p_org uuid,p_unidade uuid) RETURNS void LANGUAGE sql SET search_path=hvb,pg_temp AS $$
 SELECT pg_advisory_xact_lock(hashtextextended('agenda:'||p_org::text||':'||p_unidade::text,0));
$$;
CREATE FUNCTION recurso_disponivel(p_org uuid,p_recurso uuid,p_inicio timestamptz,p_fim timestamptz) RETURNS boolean LANGUAGE sql STABLE SET search_path=hvb,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM recurso_agenda r WHERE r.organizacao_id=p_org AND r.id=p_recurso AND (r.usuario_id IS NULL OR EXISTS(SELECT 1 FROM usuario u WHERE u.organizacao_id=r.organizacao_id AND u.id=r.usuario_id AND u.ativo)))
 AND EXISTS(SELECT 1 FROM disponibilidade_agenda d WHERE d.organizacao_id=p_org AND d.recurso_id=p_recurso AND d.tipo='disponivel' AND d.inicio<=p_inicio AND d.fim>=p_fim AND NOT EXISTS(SELECT 1 FROM revogacao_disponibilidade_agenda x WHERE x.organizacao_id=d.organizacao_id AND x.disponibilidade_id=d.id))
 AND NOT EXISTS(SELECT 1 FROM disponibilidade_agenda d WHERE d.organizacao_id=p_org AND d.recurso_id=p_recurso AND d.tipo='bloqueio' AND d.inicio<p_fim AND d.fim>p_inicio AND NOT EXISTS(SELECT 1 FROM revogacao_disponibilidade_agenda x WHERE x.organizacao_id=d.organizacao_id AND x.disponibilidade_id=d.id));
$$;
CREATE VIEW agendamento_versao_consulta WITH(security_invoker=true) AS
 SELECT v.*,a.paciente_id,a.responsavel_id,a.tipo,
 coalesce((SELECT t.estado FROM transicao_agendamento t WHERE t.organizacao_id=v.organizacao_id AND t.agendamento_versao_id=v.id ORDER BY t.sequencia DESC LIMIT 1),'planejado') AS situacao,
 NOT EXISTS(SELECT 1 FROM agendamento_versao n WHERE n.organizacao_id=v.organizacao_id AND n.agendamento_id=v.agendamento_id AND n.versao>v.versao) AS atual,
 EXISTS(SELECT 1 FROM agendamento_recurso ar WHERE ar.organizacao_id=v.organizacao_id AND ar.agendamento_versao_id=v.id AND NOT recurso_disponivel(v.organizacao_id,ar.recurso_id,v.inicio,v.fim)) AS necessita_revisao
 FROM agendamento_versao v JOIN agendamento a ON a.organizacao_id=v.organizacao_id AND a.id=v.agendamento_id;
CREATE VIEW agenda_mapa_consulta WITH(security_invoker=true) AS SELECT * FROM agendamento_versao_consulta WHERE atual;
CREATE VIEW disponibilidade_agenda_consulta WITH(security_invoker=true) AS SELECT d.*,EXISTS(SELECT 1 FROM revogacao_disponibilidade_agenda r WHERE r.organizacao_id=d.organizacao_id AND r.disponibilidade_id=d.id) AS revogada FROM disponibilidade_agenda d;
CREATE FUNCTION validar_agenda() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
#variable_conflict use_column
DECLARE v agendamento_versao;ant agendamento_versao_consulta;tr transicao_agendamento;n integer;estado_atual text;
BEGIN
 PERFORM travar_agenda(NEW.organizacao_id,NEW.unidade_id);
 CASE TG_TABLE_NAME
 WHEN 'agendamento_versao' THEN
 SELECT * INTO ant FROM agendamento_versao_consulta WHERE organizacao_id=NEW.organizacao_id AND agendamento_id=NEW.agendamento_id AND atual;
 IF NEW.versao<>coalesce(ant.versao,0)+1 OR NEW.anterior_id IS DISTINCT FROM ant.id THEN RAISE EXCEPTION 'Versao esperada divergente' USING ERRCODE='23514';END IF;
 IF ant.id IS NOT NULL AND ant.situacao NOT IN ('planejado','confirmado') THEN RAISE EXCEPTION 'Estado nao permite reprogramacao' USING ERRCODE='23514';END IF;
 WHEN 'agendamento_recurso' THEN
 SELECT * INTO STRICT v FROM agendamento_versao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.agendamento_versao_id;
 IF v.comando_id<>NEW.comando_id OR NOT recurso_disponivel(NEW.organizacao_id,NEW.recurso_id,v.inicio,v.fim) THEN RAISE EXCEPTION 'Recurso fora da disponibilidade ou comando da versao' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM agendamento_recurso ar JOIN agendamento_versao_consulta av ON av.organizacao_id=ar.organizacao_id AND av.id=ar.agendamento_versao_id WHERE ar.organizacao_id=NEW.organizacao_id AND ar.recurso_id=NEW.recurso_id AND av.agendamento_id<>v.agendamento_id AND av.atual AND av.situacao IN ('planejado','confirmado','chegou') AND av.inicio<v.fim AND av.fim>v.inicio) THEN RAISE EXCEPTION 'Recurso ja reservado no intervalo' USING ERRCODE='23514';END IF;
 WHEN 'transicao_agendamento' THEN
 SELECT * INTO STRICT v FROM agendamento_versao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.agendamento_versao_id;
 IF EXISTS(SELECT 1 FROM agendamento_versao WHERE organizacao_id=NEW.organizacao_id AND agendamento_id=v.agendamento_id AND versao>v.versao) THEN RAISE EXCEPTION 'Transicao exige versao atual' USING ERRCODE='23514';END IF;
 SELECT * INTO tr FROM transicao_agendamento WHERE organizacao_id=NEW.organizacao_id AND agendamento_versao_id=v.id ORDER BY sequencia DESC LIMIT 1;
 estado_atual:=coalesce(tr.estado,'planejado');
 IF NEW.sequencia<>coalesce(tr.sequencia,0)+1 OR NEW.anterior_estado<>estado_atual OR NEW.ocorrida_em>now() OR NEW.ocorrida_em<tr.ocorrida_em THEN RAISE EXCEPTION 'Estado ou horario da transicao divergente' USING ERRCODE='23514';END IF;
 IF NOT ((estado_atual='planejado' AND NEW.estado IN ('confirmado','chegou','cancelado','nao_compareceu')) OR (estado_atual='confirmado' AND NEW.estado IN ('chegou','cancelado','nao_compareceu')) OR (estado_atual='chegou' AND NEW.estado IN ('concluido','cancelado'))) THEN RAISE EXCEPTION 'Transicao operacional nao permitida' USING ERRCODE='23514';END IF;
 IF NEW.estado='nao_compareceu' AND NEW.ocorrida_em<v.fim THEN RAISE EXCEPTION 'Ausencia exige aguardar o fim planejado' USING ERRCODE='23514';END IF;
 IF NEW.estado='concluido' AND NEW.ocorrida_em<v.inicio THEN RAISE EXCEPTION 'Conclusao anterior ao inicio planejado' USING ERRCODE='23514';END IF;
 IF NEW.estado IN ('confirmado','chegou') AND EXISTS(SELECT 1 FROM agendamento_recurso ar WHERE ar.organizacao_id=v.organizacao_id AND ar.agendamento_versao_id=v.id AND NOT recurso_disponivel(v.organizacao_id,ar.recurso_id,v.inicio,v.fim)) THEN RAISE EXCEPTION 'Disponibilidade alterada exige reprogramacao ou revisao' USING ERRCODE='23514';END IF;
 ELSE NULL;
 END CASE;RETURN NEW;
END $$;
CREATE FUNCTION fechar_agendamento() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='agendamento' THEN
 IF NOT EXISTS(SELECT 1 FROM agendamento_versao WHERE organizacao_id=NEW.organizacao_id AND agendamento_id=NEW.id AND comando_id=NEW.comando_id) THEN RAISE EXCEPTION 'Agendamento sem versao inicial atomica' USING ERRCODE='23514';END IF;
 ELSE
 IF NOT EXISTS(SELECT 1 FROM agendamento_recurso WHERE organizacao_id=NEW.organizacao_id AND agendamento_versao_id=NEW.id) THEN RAISE EXCEPTION 'Versao sem recursos' USING ERRCODE='23514';END IF;
 END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER versao_inicial AFTER INSERT ON agendamento DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fechar_agendamento();
CREATE CONSTRAINT TRIGGER recursos_completos AFTER INSERT ON agendamento_versao DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fechar_agendamento();
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['disponibilidade_agenda','revogacao_disponibilidade_agenda','agendamento','agendamento_versao','agendamento_recurso','transicao_agendamento'] LOOP EXECUTE format('CREATE TRIGGER b_validar BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION validar_agenda()',t);END LOOP;END $$;
REVOKE ALL ON FUNCTION validar_agenda(),fechar_agendamento() FROM PUBLIC;
