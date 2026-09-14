SET search_path=hvb,public;
CREATE FUNCTION render_documento(p_org uuid,p_modelo uuid,p_campos jsonb) RETURNS text LANGUAGE plpgsql STABLE SET search_path=hvb,pg_temp AS $$
DECLARE m modelo_documento_versao;c campo_modelo_documento;k text;v jsonb;resto text;saida text;inicio integer;fim integer;codigo text;
BEGIN
 SELECT * INTO STRICT m FROM modelo_documento_versao WHERE organizacao_id=p_org AND id=p_modelo;
 IF jsonb_typeof(p_campos)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(p_campos))>50 THEN RAISE EXCEPTION 'Campos invalidos' USING ERRCODE='23514';END IF;
 FOR k,v IN SELECT * FROM jsonb_each(p_campos) LOOP
 IF jsonb_typeof(v)<>'string' OR length(v#>>'{}')>2000 OR NOT EXISTS(SELECT 1 FROM campo_modelo_documento WHERE organizacao_id=p_org AND modelo_versao_id=p_modelo AND codigo=k) THEN RAISE EXCEPTION 'Campo desconhecido ou valor invalido' USING ERRCODE='23514';END IF;END LOOP;
 FOR c IN SELECT * FROM campo_modelo_documento WHERE organizacao_id=p_org AND modelo_versao_id=p_modelo LOOP
 IF c.obrigatorio AND coalesce(btrim(p_campos->>c.codigo),'')='' THEN RAISE EXCEPTION 'Campo obrigatorio ausente' USING ERRCODE='23514';END IF;END LOOP;
 resto:=m.texto_base;saida:=m.titulo||E'\n\n';
 -- Consume only the original template. Values containing placeholders are never reinterpreted.
 LOOP
 inicio:=strpos(resto,'{{');EXIT WHEN inicio=0;
 saida:=saida||left(resto,inicio-1);resto:=substr(resto,inicio+2);fim:=strpos(resto,'}}');
 IF fim=0 THEN RAISE EXCEPTION 'Marcador incompleto' USING ERRCODE='23514';END IF;
 codigo:=left(resto,fim-1);
 IF codigo!~'^[a-z][a-z0-9_]{0,39}$' OR NOT EXISTS(SELECT 1 FROM campo_modelo_documento WHERE organizacao_id=p_org AND modelo_versao_id=p_modelo AND campo_modelo_documento.codigo=render_documento.codigo) THEN RAISE EXCEPTION 'Marcador desconhecido' USING ERRCODE='23514';END IF;
 saida:=saida||coalesce(p_campos->>codigo,'');resto:=substr(resto,fim+2);
 END LOOP;RETURN saida||resto;
END $$;
CREATE FUNCTION travar_solicitacao_documento(p_org uuid,p_id uuid) RETURNS void LANGUAGE sql SET search_path=hvb,pg_temp AS $$
 SELECT pg_advisory_xact_lock(hashtextextended('documento:'||p_org::text||':'||p_id::text,0));
$$;
CREATE VIEW documento_versao_consulta WITH(security_invoker=true) AS
 SELECT v.id,v.organizacao_id,v.unidade_id,v.autor_id,v.comando_id,v.motivo,v.criada_em,v.solicitacao_id,v.modelo_versao_id,v.versao,v.anterior_id,v.hash_conteudo,s.paciente_id,m.publico,
 EXISTS(SELECT 1 FROM aprovacao_documento a WHERE a.organizacao_id=v.organizacao_id AND a.documento_versao_id=v.id) AS aprovado,
 EXISTS(SELECT 1 FROM documento_versao n JOIN aprovacao_documento a ON a.organizacao_id=n.organizacao_id AND a.documento_versao_id=n.id WHERE n.organizacao_id=v.organizacao_id AND n.solicitacao_id=v.solicitacao_id AND n.versao>v.versao) AS substituido,
 EXISTS(SELECT 1 FROM documento_versao n WHERE n.organizacao_id=v.organizacao_id AND n.solicitacao_id=v.solicitacao_id AND n.versao>v.versao) AS ha_versao_posterior
 FROM documento_versao v JOIN solicitacao_documento s ON s.organizacao_id=v.organizacao_id AND s.id=v.solicitacao_id JOIN modelo_documento_versao m ON m.organizacao_id=v.organizacao_id AND m.id=v.modelo_versao_id;
CREATE VIEW documento_conteudo_consulta WITH(security_invoker=true) AS SELECT id,id AS documento_versao_id,organizacao_id,unidade_id,conteudo,hash_conteudo FROM documento_versao;
CREATE VIEW solicitacao_documento_consulta WITH(security_invoker=true) AS
 SELECT s.*,coalesce(a.decisao,'pendente') AS decisao_acesso,
 coalesce(a.decisao='permitida' AND a.valida_ate>now() AND NOT EXISTS(SELECT 1 FROM revogacao_autorizacao_documento r WHERE r.organizacao_id=a.organizacao_id AND r.autorizacao_id=a.id),false) AS acesso_vigente,
 s.prazo_em<now() AND NOT EXISTS(SELECT 1 FROM documento_versao v JOIN entrega_documento e ON e.organizacao_id=v.organizacao_id AND e.documento_versao_id=v.id WHERE v.organizacao_id=s.organizacao_id AND v.solicitacao_id=s.id) AS prazo_vencido
 FROM solicitacao_documento s LEFT JOIN autorizacao_documento a ON a.organizacao_id=s.organizacao_id AND a.solicitacao_id=s.id;
CREATE FUNCTION validar_documento() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
#variable_conflict use_column
DECLARE m modelo_documento_versao;s solicitacao_documento;d documento_versao;a autorizacao_documento;n integer;sol uuid;hash text;aprovada timestamptz;
BEGIN
 CASE TG_TABLE_NAME
 WHEN 'modelo_documento_versao' THEN
 PERFORM pg_advisory_xact_lock(hashtextextended('modelo-documento:'||NEW.organizacao_id::text||':'||NEW.modelo_id::text,0));
 SELECT coalesce(max(versao),0)+1 INTO n FROM modelo_documento_versao WHERE organizacao_id=NEW.organizacao_id AND modelo_id=NEW.modelo_id;
 IF NEW.versao<>n THEN RAISE EXCEPTION 'Modelo nao consecutivo' USING ERRCODE='23514';END IF;RETURN NEW;
 WHEN 'campo_modelo_documento' THEN
 SELECT * INTO STRICT m FROM modelo_documento_versao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.modelo_versao_id;
 IF m.comando_id<>NEW.comando_id OR strpos(m.texto_base,'{{'||NEW.codigo||'}}')=0 THEN RAISE EXCEPTION 'Campo deve integrar o comando e texto do modelo' USING ERRCODE='23514';END IF;RETURN NEW;
 WHEN 'aprovacao_modelo_documento' THEN
 PERFORM render_documento(NEW.organizacao_id,NEW.modelo_versao_id,coalesce((SELECT jsonb_object_agg(codigo,'valor ficticio'::text) FROM campo_modelo_documento WHERE organizacao_id=NEW.organizacao_id AND modelo_versao_id=NEW.modelo_versao_id),'{}'::jsonb));RETURN NEW;
 WHEN 'solicitacao_documento' THEN
 IF NEW.recebida_em>now() OR (NEW.episodio_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=NEW.episodio_id AND paciente_id=NEW.paciente_id)) THEN RAISE EXCEPTION 'Solicitacao incompativel com paciente ou instante' USING ERRCODE='23514';END IF;RETURN NEW;
 WHEN 'autorizacao_documento' THEN sol:=NEW.solicitacao_id;
 WHEN 'revogacao_autorizacao_documento' THEN SELECT solicitacao_id INTO STRICT sol FROM autorizacao_documento WHERE organizacao_id=NEW.organizacao_id AND id=NEW.autorizacao_id;
 WHEN 'documento_versao' THEN sol:=NEW.solicitacao_id;
 ELSE SELECT * INTO STRICT d FROM documento_versao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.documento_versao_id;sol:=d.solicitacao_id;
 END CASE;
 PERFORM travar_solicitacao_documento(NEW.organizacao_id,sol);
 SELECT * INTO STRICT s FROM solicitacao_documento WHERE organizacao_id=NEW.organizacao_id AND id=sol;
 SELECT * INTO a FROM autorizacao_documento WHERE organizacao_id=NEW.organizacao_id AND solicitacao_id=sol;
 CASE TG_TABLE_NAME
 WHEN 'autorizacao_documento' THEN
 IF NEW.valida_ate<=now() THEN RAISE EXCEPTION 'Validade deve ser futura' USING ERRCODE='23514';END IF;
 WHEN 'revogacao_autorizacao_documento' THEN NULL;
 WHEN 'documento_versao' THEN
 SELECT * INTO STRICT m FROM modelo_documento_versao WHERE organizacao_id=NEW.organizacao_id AND id=NEW.modelo_versao_id;
 SELECT coalesce(max(versao),0)+1 INTO n FROM documento_versao WHERE organizacao_id=NEW.organizacao_id AND solicitacao_id=sol;
 IF m.modelo_id<>s.modelo_id OR NOT EXISTS(SELECT 1 FROM aprovacao_modelo_documento WHERE organizacao_id=NEW.organizacao_id AND modelo_versao_id=m.id) OR NEW.versao<>n OR (n>1 AND NOT EXISTS(SELECT 1 FROM documento_versao WHERE organizacao_id=NEW.organizacao_id AND solicitacao_id=sol AND versao=n-1 AND id=NEW.anterior_id)) THEN RAISE EXCEPTION 'Modelo ou versao documental incompativel' USING ERRCODE='23514';END IF;
 NEW.conteudo:=render_documento(NEW.organizacao_id,m.id,NEW.campos);NEW.hash_conteudo:=encode(sha256(convert_to(NEW.conteudo,'UTF8')),'hex');
 ELSE
 SELECT * INTO STRICT m FROM modelo_documento_versao WHERE organizacao_id=NEW.organizacao_id AND id=d.modelo_versao_id;
 IF a.id IS NULL OR a.decisao<>'permitida' OR a.valida_ate<=now() OR EXISTS(SELECT 1 FROM revogacao_autorizacao_documento WHERE organizacao_id=NEW.organizacao_id AND autorizacao_id=a.id) THEN RAISE EXCEPTION 'Autorizacao ausente, negada, expirada ou revogada' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM documento_versao WHERE organizacao_id=NEW.organizacao_id AND solicitacao_id=sol AND versao>d.versao) THEN RAISE EXCEPTION 'Versao posterior exige revisao antes de aprovar, assinar ou entregar' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME<>'aprovacao_documento' THEN
 SELECT criada_em INTO aprovada FROM aprovacao_documento WHERE organizacao_id=NEW.organizacao_id AND documento_versao_id=d.id;
 IF aprovada IS NULL THEN RAISE EXCEPTION 'Documento ainda nao aprovado' USING ERRCODE='23514';END IF;
 END IF;
 IF TG_TABLE_NAME='assinatura_documento' THEN
 IF NEW.hash_conteudo<>d.hash_conteudo OR NEW.declarada_em>now() OR NEW.declarada_em<aprovada OR (NEW.signatario_responsavel_id IS NOT NULL AND (m.publico<>'responsavel' OR NEW.signatario_responsavel_id IS DISTINCT FROM s.solicitante_responsavel_id)) THEN RAISE EXCEPTION 'Declaracao de assinatura incompativel' USING ERRCODE='23514';END IF;
 ELSIF TG_TABLE_NAME='entrega_documento' THEN
 IF m.publico<>'responsavel' OR NEW.destinatario_id IS DISTINCT FROM s.solicitante_responsavel_id OR NEW.entregue_em>now() OR NEW.entregue_em<aprovada THEN RAISE EXCEPTION 'Entrega incompativel com publico, destinatario ou aprovacao' USING ERRCODE='23514';END IF;
 END IF;
 END CASE;RETURN NEW;
END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['modelo_documento_versao','campo_modelo_documento','aprovacao_modelo_documento','solicitacao_documento','autorizacao_documento','revogacao_autorizacao_documento','documento_versao','aprovacao_documento','assinatura_documento','entrega_documento'] LOOP EXECUTE format('CREATE TRIGGER b_validar BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION validar_documento()',t);END LOOP;END $$;
REVOKE ALL ON FUNCTION validar_documento() FROM PUBLIC;
