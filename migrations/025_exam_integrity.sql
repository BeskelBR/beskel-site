SET search_path=hvb,public;
CREATE FUNCTION travar_item_exame(p_org uuid,p_item uuid) RETURNS void LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE ep uuid;
BEGIN
 SELECT s.episodio_id INTO STRICT ep FROM item_exame i JOIN solicitacao_exame s ON s.organizacao_id=i.organizacao_id AND s.id=i.solicitacao_id WHERE i.organizacao_id=p_org AND i.id=p_item;
 PERFORM 1 FROM episodio WHERE organizacao_id=p_org AND id=ep FOR UPDATE;
 PERFORM pg_advisory_xact_lock(hashtextextended('exame-item:'||p_org::text||':'||p_item::text,0));
END $$;
CREATE VIEW coleta_exame_consulta WITH(security_invoker=true) AS SELECT c.*,d.situacao AS situacao_amostra,
 c.origem='externa' OR NOT EXISTS(SELECT 1 FROM execucao x WHERE x.organizacao_id=c.organizacao_id AND x.correcao_de_id=c.execucao_id) AS origem_ativa
 FROM coleta_exame c LEFT JOIN decisao_amostra d ON d.organizacao_id=c.organizacao_id AND d.coleta_id=c.id;
CREATE VIEW resultado_exame_consulta WITH(security_invoker=true) AS SELECT r.*,s.episodio_id,i.exame_versao_id,
 EXISTS(SELECT 1 FROM liberacao_resultado l WHERE l.organizacao_id=r.organizacao_id AND l.resultado_id=r.id) AS liberado,
 EXISTS(SELECT 1 FROM resultado_versao n JOIN liberacao_resultado l ON l.organizacao_id=n.organizacao_id AND l.resultado_id=n.id WHERE n.organizacao_id=r.organizacao_id AND n.item_exame_id=r.item_exame_id AND n.versao>r.versao) AS substituido,
 EXISTS(SELECT 1 FROM resultado_versao n WHERE n.organizacao_id=r.organizacao_id AND n.item_exame_id=r.item_exame_id AND n.versao>r.versao AND NOT EXISTS(SELECT 1 FROM liberacao_resultado l WHERE l.organizacao_id=n.organizacao_id AND l.resultado_id=n.id)) AS ha_versao_pendente,
 EXISTS(SELECT 1 FROM atributo_exame_versao a WHERE a.organizacao_id=i.organizacao_id AND a.exame_versao_id=i.exame_versao_id AND a.obrigatorio AND NOT EXISTS(SELECT 1 FROM valor_resultado v WHERE v.organizacao_id=r.organizacao_id AND v.resultado_id=r.id AND v.atributo_id=a.id)) AS faltam_obrigatorios,
 EXISTS(SELECT 1 FROM valor_resultado v WHERE v.organizacao_id=r.organizacao_id AND v.resultado_id=r.id AND (v.situacao='nao_obtido' OR v.referencia_status='pendente')) AS tem_pendencias,
 EXISTS(SELECT 1 FROM cancelamento_item_exame ca WHERE ca.organizacao_id=i.organizacao_id AND ca.item_exame_id=i.id) OR (r.coleta_id IS NOT NULL AND (NOT coalesce(c.origem_ativa,false) OR coalesce(c.situacao_amostra,'pendente')<>'aceita')) AS necessita_revisao
 FROM resultado_versao r JOIN item_exame i ON i.organizacao_id=r.organizacao_id AND i.id=r.item_exame_id JOIN solicitacao_exame s ON s.organizacao_id=i.organizacao_id AND s.id=i.solicitacao_id
 LEFT JOIN coleta_exame_consulta c ON c.organizacao_id=r.organizacao_id AND c.id=r.coleta_id;
CREATE FUNCTION conteudo_resultado(p_org uuid,p_resultado uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path=hvb,pg_temp AS $$
 SELECT jsonb_build_object('formato','hvb-resultado-dev-v1','resultado',to_jsonb(r),'item',to_jsonb(i),'solicitacao',to_jsonb(s),'paciente_id',ep.paciente_id,'exame',to_jsonb(e),'laboratorio',to_jsonb(l),
 'coleta',(SELECT to_jsonb(c) FROM coleta_exame c WHERE c.organizacao_id=r.organizacao_id AND c.id=r.coleta_id),
 'decisao_amostra',(SELECT to_jsonb(d) FROM decisao_amostra d WHERE d.organizacao_id=r.organizacao_id AND d.coleta_id=r.coleta_id),
 'valores',coalesce((SELECT jsonb_agg(jsonb_build_object('valor',to_jsonb(v),'atributo',to_jsonb(a),'referencia',to_jsonb(ref)) ORDER BY a.ordem,a.id) FROM valor_resultado v JOIN atributo_exame_versao a ON a.organizacao_id=v.organizacao_id AND a.id=v.atributo_id LEFT JOIN referencia_analito_versao ref ON ref.organizacao_id=v.organizacao_id AND ref.id=v.referencia_id WHERE v.organizacao_id=r.organizacao_id AND v.resultado_id=r.id),'[]'::jsonb))
 FROM resultado_versao r JOIN item_exame i ON i.organizacao_id=r.organizacao_id AND i.id=r.item_exame_id JOIN solicitacao_exame s ON s.organizacao_id=i.organizacao_id AND s.id=i.solicitacao_id JOIN episodio ep ON ep.organizacao_id=s.organizacao_id AND ep.id=s.episodio_id
 JOIN exame_versao e ON e.organizacao_id=i.organizacao_id AND e.id=i.exame_versao_id JOIN laboratorio_exame l ON l.organizacao_id=e.organizacao_id AND l.id=e.laboratorio_id WHERE r.organizacao_id=p_org AND r.id=p_resultado;
$$;
CREATE FUNCTION hash_resultado(p_org uuid,p_resultado uuid) RETURNS text LANGUAGE sql STABLE SET search_path=hvb,pg_temp AS $$
 SELECT encode(sha256(convert_to(conteudo_resultado(p_org,p_resultado)::text,'UTF8')),'hex');
$$;
CREATE VIEW documento_resultado_consulta WITH(security_invoker=true) AS SELECT l.id,l.organizacao_id,l.unidade_id,l.resultado_id,l.hash_conteudo,l.autor_id,l.criada_em,l.pendencias_confirmadas,
 conteudo_resultado(l.organizacao_id,l.resultado_id)::text AS conteudo_json FROM liberacao_resultado l;

CREATE FUNCTION validar_catalogo_exame() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE n integer;v exame_versao;a atributo_exame_versao;
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'exame_versao' THEN
 PERFORM pg_advisory_xact_lock(hashtextextended('exame-catalogo:'||NEW.organizacao_id::text||':'||NEW.exame_id::text,0));
 SELECT coalesce(max(versao),0)+1 INTO n FROM exame_versao WHERE organizacao_id=NEW.organizacao_id AND exame_id=NEW.exame_id;
 IF NEW.versao<>n THEN RAISE EXCEPTION 'Versao tecnica nao consecutiva' USING ERRCODE='23514';END IF;
 WHEN 'atributo_exame_versao' THEN
 SELECT * INTO STRICT v FROM exame_versao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.exame_versao_id;
 IF v.comando_id<>NEW.comando_id THEN RAISE EXCEPTION 'Estrutura deve ser gravada no mesmo comando da versao' USING ERRCODE='23514';END IF;
 WHEN 'aprovacao_exame_versao' THEN
 IF NOT EXISTS(SELECT 1 FROM atributo_exame_versao WHERE organizacao_id=NEW.organizacao_id AND exame_versao_id=NEW.exame_versao_id) THEN RAISE EXCEPTION 'Estrutura sem atributos' USING ERRCODE='23514';END IF;
 WHEN 'referencia_analito_versao' THEN
 PERFORM pg_advisory_xact_lock(hashtextextended('exame-referencia:'||NEW.organizacao_id::text||':'||NEW.atributo_id::text,0));
 SELECT coalesce(max(versao),0)+1 INTO n FROM referencia_analito_versao WHERE organizacao_id=NEW.organizacao_id AND atributo_id=NEW.atributo_id AND codigo=NEW.codigo;
 IF NEW.versao<>n THEN RAISE EXCEPTION 'Referencia nao consecutiva' USING ERRCODE='23514';END IF;
 SELECT * INTO STRICT a FROM atributo_exame_versao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.atributo_id;
 IF a.tipo<>'numero' AND (NEW.limite_inferior IS NOT NULL OR NEW.limite_superior IS NOT NULL) THEN RAISE EXCEPTION 'Limites numericos exigem atributo numerico' USING ERRCODE='23514';END IF;
 IF (NEW.idade_min_dias=NEW.idade_max_dias AND NOT(NEW.inclui_idade_min AND NEW.inclui_idade_max)) OR (NEW.limite_inferior=NEW.limite_superior AND NOT(NEW.inclui_inferior AND NEW.inclui_superior)) THEN RAISE EXCEPTION 'Intervalo vazio' USING ERRCODE='23514';END IF;
 END CASE;RETURN NEW;
END $$;
CREATE FUNCTION validar_fluxo_exame() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
#variable_conflict use_column
DECLARE i item_exame;s solicitacao_exame;e exame_versao;ep episodio;co coleta_exame_consulta;r resultado_exame_consulta;a atributo_exame_versao;ref referencia_analito_versao;item_id uuid;n integer;especie_paciente text;
BEGIN
 IF TG_TABLE_NAME='solicitacao_exame' THEN
 SELECT * INTO STRICT ep FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=NEW.episodio_id FOR UPDATE;
 IF NEW.solicitada_em>now() OR NEW.solicitada_em<ep.admitido_em OR NEW.solicitada_em>least(ep.alta_clinica_em,ep.encerrado_em) THEN RAISE EXCEPTION 'Horario de solicitacao incompativel' USING ERRCODE='23514';END IF;RETURN NEW;
 ELSIF TG_TABLE_NAME='item_exame' THEN
 SELECT * INTO STRICT s FROM solicitacao_exame WHERE organizacao_id=NEW.organizacao_id AND id=NEW.solicitacao_id;
 IF s.comando_id<>NEW.comando_id OR NOT EXISTS(SELECT 1 FROM aprovacao_exame_versao WHERE organizacao_id=NEW.organizacao_id AND exame_versao_id=NEW.exame_versao_id) THEN RAISE EXCEPTION 'Solicitacao exige versao aprovada e itens atomicos' USING ERRCODE='23514';END IF;RETURN NEW;
 ELSIF TG_TABLE_NAME IN ('coleta_exame','resultado_versao','cancelamento_item_exame') THEN item_id:=NEW.item_exame_id;
 ELSIF TG_TABLE_NAME='decisao_amostra' THEN SELECT item_exame_id INTO STRICT item_id FROM coleta_exame WHERE organizacao_id=NEW.organizacao_id AND id=NEW.coleta_id;
 ELSE SELECT item_exame_id INTO STRICT item_id FROM resultado_versao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.resultado_id;END IF;
 PERFORM travar_item_exame(NEW.organizacao_id,item_id);
 SELECT * INTO STRICT i FROM item_exame WHERE organizacao_id=NEW.organizacao_id AND id=item_id;
 SELECT * INTO STRICT s FROM solicitacao_exame WHERE organizacao_id=NEW.organizacao_id AND id=i.solicitacao_id;
 SELECT * INTO STRICT e FROM exame_versao WHERE organizacao_id=NEW.organizacao_id AND id=i.exame_versao_id;
 IF EXISTS(SELECT 1 FROM cancelamento_item_exame WHERE organizacao_id=NEW.organizacao_id AND item_exame_id=i.id) THEN RAISE EXCEPTION 'Item cancelado' USING ERRCODE='23514';END IF;
 CASE TG_TABLE_NAME
 WHEN 'cancelamento_item_exame' THEN
 IF EXISTS(SELECT 1 FROM resultado_versao rv JOIN liberacao_resultado l ON l.organizacao_id=rv.organizacao_id AND l.resultado_id=rv.id WHERE rv.organizacao_id=NEW.organizacao_id AND rv.item_exame_id=i.id) THEN RAISE EXCEPTION 'Resultado liberado exige correcao versionada' USING ERRCODE='23514';END IF;
 WHEN 'coleta_exame' THEN
 IF NOT e.exige_coleta OR NEW.material<>e.material OR NEW.coletada_em>now() THEN RAISE EXCEPTION 'Coleta diverge da estrutura ou horario' USING ERRCODE='23514';END IF;
 IF NEW.origem='interna' AND NOT EXISTS(SELECT 1 FROM execucao x WHERE x.organizacao_id=NEW.organizacao_id AND x.id=NEW.execucao_id AND x.episodio_id=s.episodio_id AND x.executada_em=NEW.coletada_em AND x.resultado='integral' AND NOT EXISTS(SELECT 1 FROM execucao sub WHERE sub.organizacao_id=x.organizacao_id AND sub.correcao_de_id=x.id)) THEN RAISE EXCEPTION 'Coleta interna exige execucao integral identificada' USING ERRCODE='23514';END IF;
 WHEN 'decisao_amostra' THEN
 SELECT * INTO STRICT co FROM coleta_exame_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.coleta_id;
 IF NEW.avaliada_em<co.coletada_em OR NEW.avaliada_em>now() OR NOT co.origem_ativa THEN RAISE EXCEPTION 'Avaliacao da amostra incompativel' USING ERRCODE='23514';END IF;
 WHEN 'resultado_versao' THEN
 SELECT coalesce(max(versao),0)+1 INTO n FROM resultado_versao WHERE organizacao_id=NEW.organizacao_id AND item_exame_id=i.id;
 IF NEW.versao<>n OR (n>1 AND NOT EXISTS(SELECT 1 FROM resultado_versao WHERE organizacao_id=NEW.organizacao_id AND item_exame_id=i.id AND versao=n-1 AND id=NEW.anterior_id)) THEN RAISE EXCEPTION 'Versao esperada do resultado divergente' USING ERRCODE='23514';END IF;
 IF NEW.produzido_em>now() OR e.exige_coleta<>(NEW.coleta_id IS NOT NULL) THEN RAISE EXCEPTION 'Resultado exige origem e horario compativeis' USING ERRCODE='23514';END IF;
 IF NEW.coleta_id IS NOT NULL THEN
 SELECT * INTO STRICT co FROM coleta_exame_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.coleta_id;
 IF co.item_exame_id<>i.id OR co.situacao_amostra IS DISTINCT FROM 'aceita' OR NOT co.origem_ativa OR NEW.produzido_em<co.coletada_em THEN RAISE EXCEPTION 'Resultado exige amostra aceita do item' USING ERRCODE='23514';END IF;
 ELSIF NEW.produzido_em<s.solicitada_em THEN RAISE EXCEPTION 'Resultado anterior a solicitacao sem coleta' USING ERRCODE='23514';END IF;
 WHEN 'valor_resultado' THEN
 SELECT * INTO STRICT r FROM resultado_exame_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.resultado_id;
 SELECT * INTO STRICT a FROM atributo_exame_versao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.atributo_id;
 IF r.comando_id<>NEW.comando_id OR a.exame_versao_id<>i.exame_versao_id THEN RAISE EXCEPTION 'Valor deve pertencer a versao tecnica e comando do resultado' USING ERRCODE='23514';END IF;
 IF NEW.situacao='informado' AND ((a.tipo='numero')<>(NEW.numero IS NOT NULL) OR (a.tipo='booleano')<>(NEW.booleano IS NOT NULL) OR (a.tipo='numero')<>(NEW.qualificador<>'nao_aplicavel')) THEN RAISE EXCEPTION 'Representacao tipada incompativel' USING ERRCODE='23514';END IF;
 IF NEW.referencia_id IS NOT NULL THEN
 SELECT * INTO STRICT ref FROM referencia_analito_versao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.referencia_id;
 SELECT p.especie_codigo INTO STRICT especie_paciente FROM paciente p JOIN episodio ep ON ep.organizacao_id=p.organizacao_id AND ep.paciente_id=p.id WHERE ep.organizacao_id=NEW.organizacao_id AND ep.id=s.episodio_id;
 IF ref.atributo_id<>a.id OR ref.especie_codigo<>especie_paciente OR (ref.idade_min_dias IS NOT NULL AND (r.origem_idade<>'informada' OR r.idade_dias<ref.idade_min_dias OR r.idade_dias>ref.idade_max_dias OR (r.idade_dias=ref.idade_min_dias AND NOT ref.inclui_idade_min) OR (r.idade_dias=ref.idade_max_dias AND NOT ref.inclui_idade_max))) THEN RAISE EXCEPTION 'Referencia incompativel ou idade nao confirmada' USING ERRCODE='23514';END IF;END IF;
 WHEN 'liberacao_resultado' THEN
 SELECT * INTO STRICT r FROM resultado_exame_consulta WHERE organizacao_id=NEW.organizacao_id AND id=NEW.resultado_id;
 IF r.faltam_obrigatorios OR r.necessita_revisao OR (r.tem_pendencias AND NOT NEW.pendencias_confirmadas) OR EXISTS(SELECT 1 FROM resultado_versao WHERE organizacao_id=r.organizacao_id AND item_exame_id=i.id AND versao>r.versao) THEN RAISE EXCEPTION 'Resultado exige completar ou revisar antes de liberar' USING ERRCODE='23514';END IF;
 IF NEW.hash_conteudo IS DISTINCT FROM hash_resultado(NEW.organizacao_id,r.id) THEN RAISE EXCEPTION 'Hash diverge do conteudo liberado' USING ERRCODE='23514';END IF;
 END CASE;RETURN NEW;
END $$;
CREATE FUNCTION fechar_solicitacao_exame() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN IF NOT EXISTS(SELECT 1 FROM item_exame WHERE organizacao_id=NEW.organizacao_id AND solicitacao_id=NEW.id) THEN RAISE EXCEPTION 'Solicitacao sem itens' USING ERRCODE='23514';END IF;RETURN NULL;END $$;
CREATE CONSTRAINT TRIGGER itens_completos AFTER INSERT ON solicitacao_exame DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fechar_solicitacao_exame();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['exame_versao','atributo_exame_versao','aprovacao_exame_versao','referencia_analito_versao'] LOOP EXECUTE format('CREATE TRIGGER b_validar BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION validar_catalogo_exame()',t);END LOOP;
 FOREACH t IN ARRAY ARRAY['solicitacao_exame','item_exame','cancelamento_item_exame','coleta_exame','decisao_amostra','resultado_versao','valor_resultado','liberacao_resultado'] LOOP EXECUTE format('CREATE TRIGGER b_validar BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION validar_fluxo_exame()',t);END LOOP;
END $$;
REVOKE ALL ON FUNCTION validar_catalogo_exame(),validar_fluxo_exame(),fechar_solicitacao_exame() FROM PUBLIC;
CREATE INDEX coleta_item ON coleta_exame(organizacao_id,item_exame_id,id);
CREATE INDEX resultado_item_versao ON resultado_versao(organizacao_id,item_exame_id,versao DESC);
CREATE INDEX solicitacao_episodio ON solicitacao_exame(organizacao_id,unidade_id,episodio_id,id);
