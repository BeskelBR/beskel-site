SET search_path=hvb,public;
CREATE FUNCTION validar_campos_evolucao(campos jsonb) RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path=hvb,pg_temp AS $$
DECLARE c jsonb; vistos text[]:=ARRAY[]::text[];
BEGIN
 IF jsonb_typeof(campos) IS DISTINCT FROM 'array' OR jsonb_array_length(campos) NOT BETWEEN 1 AND 16 THEN RAISE EXCEPTION 'Campos invalidos' USING ERRCODE='23514';END IF;
 FOR c IN SELECT value FROM jsonb_array_elements(campos) LOOP
  IF jsonb_typeof(c) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Campo invalido' USING ERRCODE='23514';END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(c))<>3 OR jsonb_typeof(c->'codigo') IS DISTINCT FROM 'string' OR (c->>'codigo') !~ '^[a-z][a-z0-9_]{0,31}$' OR jsonb_typeof(c->'rotulo') IS DISTINCT FROM 'string' OR length(btrim(c->>'rotulo')) NOT BETWEEN 1 AND 160 OR jsonb_typeof(c->'obrigatorio') IS DISTINCT FROM 'boolean' OR c->>'codigo'=ANY(vistos) THEN RAISE EXCEPTION 'Definicao de campo invalida' USING ERRCODE='23514';END IF;
  vistos:=array_append(vistos,c->>'codigo');
 END LOOP;
END $$;
CREATE FUNCTION renderizar_evolucao(campos jsonb,respostas jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=hvb,pg_temp AS $$
DECLARE c jsonb;r jsonb;vistos text[]:=ARRAY[]::text[];partes text[]:=ARRAY[]::text[];valor text;resultado text;
BEGIN
 PERFORM validar_campos_evolucao(campos);
 IF jsonb_typeof(respostas) IS DISTINCT FROM 'array' OR jsonb_array_length(respostas) NOT BETWEEN 1 AND 16 THEN RAISE EXCEPTION 'Respostas invalidas' USING ERRCODE='23514';END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(respostas) LOOP
  IF jsonb_typeof(r) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Resposta invalida' USING ERRCODE='23514';END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(r))<>2 OR jsonb_typeof(r->'codigo') IS DISTINCT FROM 'string' OR jsonb_typeof(r->'valor') IS DISTINCT FROM 'string' OR length(btrim(r->>'valor')) NOT BETWEEN 1 AND 8000 OR r->>'codigo'=ANY(vistos) OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(campos) x WHERE x->>'codigo'=r->>'codigo') THEN RAISE EXCEPTION 'Resposta desconhecida, vazia ou duplicada' USING ERRCODE='23514';END IF;
  vistos:=array_append(vistos,r->>'codigo');
 END LOOP;
 FOR c IN SELECT value FROM jsonb_array_elements(campos) LOOP
  SELECT x->>'valor' INTO valor FROM jsonb_array_elements(respostas) x WHERE x->>'codigo'=c->>'codigo';
  IF valor IS NULL AND (c->>'obrigatorio')::boolean THEN RAISE EXCEPTION 'Campo obrigatorio ausente' USING ERRCODE='23514';END IF;
  IF valor IS NOT NULL THEN partes:=array_append(partes,(c->>'rotulo')||E'\n'||valor);END IF;
 END LOOP;
 resultado:=array_to_string(partes,E'\n\n');
 IF length(resultado) NOT BETWEEN 1 AND 8000 THEN RAISE EXCEPTION 'Texto renderizado excede limite' USING ERRCODE='23514';END IF;
 RETURN resultado;
END $$;
CREATE FUNCTION validar_modelo_evolucao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE ant modelo_evolucao_versao;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('modelo-evolucao:'||NEW.organizacao_id::text||':'||NEW.unidade_id::text||':'||NEW.codigo,0));
 SELECT * INTO ant FROM modelo_evolucao_versao WHERE organizacao_id=NEW.organizacao_id AND unidade_id=NEW.unidade_id AND codigo=NEW.codigo ORDER BY versao DESC LIMIT 1;
 IF NEW.versao<>coalesce(ant.versao,0)+1 OR NEW.anterior_id IS DISTINCT FROM ant.id THEN RAISE EXCEPTION 'Modelo alterado' USING ERRCODE='23514';END IF;
 PERFORM validar_campos_evolucao(NEW.campos);RETURN NEW;
END $$;
CREATE FUNCTION validar_complemento_evolucao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE v evolucao_clinica_versao;m modelo_evolucao_versao;alvo_autor uuid;alvo_versao uuid;revogacao boolean:=false;
BEGIN
 IF TG_TABLE_NAME='revogacao_anexo_evolucao' THEN
  SELECT autor_id,evolucao_versao_id INTO STRICT alvo_autor,alvo_versao FROM anexo_evolucao WHERE organizacao_id=NEW.organizacao_id AND unidade_id=NEW.unidade_id AND id=NEW.anexo_id;revogacao:=true;
 ELSIF TG_TABLE_NAME='revogacao_coautoria_evolucao' THEN
  SELECT autor_id,evolucao_versao_id INTO STRICT alvo_autor,alvo_versao FROM coautoria_evolucao WHERE organizacao_id=NEW.organizacao_id AND unidade_id=NEW.unidade_id AND id=NEW.coautoria_id;revogacao:=true;
 ELSE alvo_versao:=NEW.evolucao_versao_id;END IF;
 SELECT * INTO STRICT v FROM evolucao_clinica_versao WHERE organizacao_id=NEW.organizacao_id AND unidade_id=NEW.unidade_id AND id=alvo_versao;
 PERFORM travar_evolucao(NEW.organizacao_id,v.evolucao_id);
 IF revogacao THEN
  IF NEW.autor_id<>alvo_autor THEN RAISE EXCEPTION 'Somente autor pode revogar' USING ERRCODE='23514';END IF;RETURN NEW;
 END IF;
 IF v.estado<>'registrada' OR EXISTS(SELECT 1 FROM evolucao_clinica_versao WHERE organizacao_id=v.organizacao_id AND evolucao_id=v.evolucao_id AND versao>v.versao) THEN RAISE EXCEPTION 'Complemento exige versao atual registrada' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME='preenchimento_modelo_evolucao' THEN
  SELECT * INTO STRICT m FROM modelo_evolucao_versao WHERE organizacao_id=NEW.organizacao_id AND unidade_id=NEW.unidade_id AND id=NEW.modelo_versao_id;
  IF v.versao<>1 OR v.comando_id<>NEW.comando_id OR v.conteudo<>renderizar_evolucao(m.campos,NEW.respostas) OR m.tipo<>(SELECT tipo FROM evolucao_clinica WHERE organizacao_id=v.organizacao_id AND id=v.evolucao_id) THEN RAISE EXCEPTION 'Preenchimento diverge da evolucao original' USING ERRCODE='23514';END IF;
 ELSE
  IF NEW.hash_evolucao<>v.hash_conteudo THEN RAISE EXCEPTION 'Hash da evolucao divergente' USING ERRCODE='23514';END IF;
  IF TG_TABLE_NAME='coautoria_evolucao' THEN
   IF NEW.autor_id=v.autor_id THEN RAISE EXCEPTION 'Autor original nao e coautor' USING ERRCODE='23514';END IF;
  ELSE
   IF NOT ((NEW.mime='application/pdf' AND substring(NEW.conteudo FROM 1 FOR 5)=decode('255044462d','hex')) OR (NEW.mime='image/png' AND substring(NEW.conteudo FROM 1 FOR 8)=decode('89504e470d0a1a0a','hex')) OR (NEW.mime='image/jpeg' AND substring(NEW.conteudo FROM 1 FOR 3)=decode('ffd8ff','hex'))) THEN RAISE EXCEPTION 'Cabecalho do anexo diverge do MIME' USING ERRCODE='23514';END IF;
   NEW.hash_conteudo:=encode(sha256(NEW.conteudo),'hex');NEW.tamanho:=octet_length(NEW.conteudo);
  END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER b_validar BEFORE INSERT ON modelo_evolucao_versao FOR EACH ROW EXECUTE FUNCTION validar_modelo_evolucao();
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['preenchimento_modelo_evolucao','anexo_evolucao','revogacao_anexo_evolucao','coautoria_evolucao','revogacao_coautoria_evolucao'] LOOP
 EXECUTE format('CREATE TRIGGER b_validar BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION validar_complemento_evolucao()',t);
 END LOOP;END $$;
CREATE VIEW modelo_evolucao_consulta WITH(security_invoker=true) AS SELECT m.id,m.organizacao_id,m.unidade_id,m.autor_id,m.comando_id,m.motivo,m.criada_em,m.codigo,m.nome,m.tipo,m.versao,m.anterior_id,NOT EXISTS(SELECT 1 FROM modelo_evolucao_versao n WHERE n.organizacao_id=m.organizacao_id AND n.anterior_id=m.id) AS atual FROM modelo_evolucao_versao m;
CREATE VIEW preenchimento_evolucao_consulta WITH(security_invoker=true) AS SELECT p.id,p.organizacao_id,p.unidade_id,p.autor_id,p.comando_id,p.motivo,p.criada_em,p.modelo_versao_id,p.evolucao_versao_id,v.evolucao_id,v.paciente_id,v.episodio_id,v.atual FROM preenchimento_modelo_evolucao p JOIN evolucao_clinica_versao_consulta v ON v.organizacao_id=p.organizacao_id AND v.id=p.evolucao_versao_id;
CREATE VIEW anexo_evolucao_consulta WITH(security_invoker=true) AS SELECT x.id,x.organizacao_id,x.unidade_id,x.autor_id,x.comando_id,x.motivo,x.criada_em,x.evolucao_versao_id,x.nome,x.mime,x.hash_conteudo,x.hash_evolucao,x.tamanho,v.evolucao_id,v.paciente_id,v.episodio_id,v.atual,EXISTS(SELECT 1 FROM revogacao_anexo_evolucao r WHERE r.organizacao_id=x.organizacao_id AND r.anexo_id=x.id) AS revogada FROM anexo_evolucao x JOIN evolucao_clinica_versao_consulta v ON v.organizacao_id=x.organizacao_id AND v.id=x.evolucao_versao_id;
CREATE VIEW coautoria_evolucao_consulta WITH(security_invoker=true) AS SELECT x.id,x.organizacao_id,x.unidade_id,x.autor_id,x.comando_id,x.motivo,x.criada_em,x.evolucao_versao_id,x.hash_evolucao,v.evolucao_id,v.paciente_id,v.episodio_id,v.atual,EXISTS(SELECT 1 FROM revogacao_coautoria_evolucao r WHERE r.organizacao_id=x.organizacao_id AND r.coautoria_id=x.id) AS revogada,v.atual AND v.estado='registrada' AND NOT EXISTS(SELECT 1 FROM revogacao_coautoria_evolucao r WHERE r.organizacao_id=x.organizacao_id AND r.coautoria_id=x.id) AS vigente FROM coautoria_evolucao x JOIN evolucao_clinica_versao_consulta v ON v.organizacao_id=x.organizacao_id AND v.id=x.evolucao_versao_id;
REVOKE ALL ON FUNCTION validar_modelo_evolucao(),validar_complemento_evolucao() FROM PUBLIC;
