SET search_path=hvb,public;
-- Cache the internal query plans of predicates reused for every portal message.
CREATE OR REPLACE FUNCTION conta_portal_ativa(p_org uuid,p_conta uuid) RETURNS boolean LANGUAGE plpgsql STABLE SET search_path=hvb,pg_temp AS $$
 BEGIN RETURN EXISTS(SELECT 1 FROM conta_portal c WHERE c.organizacao_id=p_org AND c.id=p_conta AND NOT EXISTS(SELECT 1 FROM revogacao_conta_portal r WHERE r.organizacao_id=c.organizacao_id AND r.conta_portal_id=c.id));
END $$;
CREATE OR REPLACE FUNCTION documento_apto_portal(p_org uuid,p_doc uuid,p_concessao uuid) RETURNS boolean LANGUAGE plpgsql STABLE SET search_path=hvb,pg_temp AS $$
 BEGIN RETURN EXISTS(SELECT 1 FROM documento_versao_consulta d JOIN solicitacao_documento_consulta s ON s.organizacao_id=d.organizacao_id AND s.id=d.solicitacao_id JOIN concessao_portal_consulta g ON g.organizacao_id=d.organizacao_id AND g.id=p_concessao WHERE d.organizacao_id=p_org AND d.id=p_doc AND d.unidade_id=g.unidade_id AND d.paciente_id=g.paciente_id AND s.solicitante_responsavel_id=g.responsavel_id AND d.publico='responsavel' AND d.aprovado AND NOT d.ha_versao_posterior AND s.acesso_vigente AND g.vigente);
END $$;
CREATE OR REPLACE FUNCTION mensagem_apta_portal(p_org uuid,p_mensagem uuid) RETURNS boolean LANGUAGE plpgsql STABLE SET search_path=hvb,pg_temp AS $$
 BEGIN RETURN EXISTS(SELECT 1 FROM mensagem_portal m JOIN concessao_portal_consulta g ON g.organizacao_id=m.organizacao_id AND g.id=m.concessao_id WHERE m.organizacao_id=p_org AND m.id=p_mensagem AND g.vigente
 AND NOT EXISTS(SELECT 1 FROM mensagem_documento d WHERE d.organizacao_id=m.organizacao_id AND d.mensagem_id=m.id AND NOT documento_apto_portal(m.organizacao_id,d.documento_versao_id,g.id))
 AND (m.agendamento_versao_id IS NULL OR EXISTS(SELECT 1 FROM agenda_mapa_consulta a WHERE a.organizacao_id=m.organizacao_id AND a.id=m.agendamento_versao_id AND a.paciente_id=g.paciente_id AND a.responsavel_id=g.responsavel_id)));
END $$;
