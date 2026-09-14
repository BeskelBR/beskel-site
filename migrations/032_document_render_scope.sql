SET search_path=hvb,public;
-- Qualify the field name separately from the current placeholder variable.
CREATE OR REPLACE FUNCTION render_documento(p_org uuid,p_modelo uuid,p_campos jsonb) RETURNS text LANGUAGE plpgsql STABLE SET search_path=hvb,pg_temp AS $$
DECLARE m modelo_documento_versao;c campo_modelo_documento;k text;v jsonb;resto text;saida text;inicio integer;fim integer;codigo text;
BEGIN
 SELECT * INTO STRICT m FROM modelo_documento_versao WHERE organizacao_id=p_org AND id=p_modelo;
 IF jsonb_typeof(p_campos)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(p_campos))>50 THEN RAISE EXCEPTION 'Campos invalidos' USING ERRCODE='23514';END IF;
 FOR k,v IN SELECT * FROM jsonb_each(p_campos) LOOP
 IF jsonb_typeof(v)<>'string' OR length(v#>>'{}')>2000 OR NOT EXISTS(SELECT 1 FROM campo_modelo_documento WHERE organizacao_id=p_org AND modelo_versao_id=p_modelo AND campo_modelo_documento.codigo=k) THEN RAISE EXCEPTION 'Campo desconhecido ou valor invalido' USING ERRCODE='23514';END IF;END LOOP;
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
