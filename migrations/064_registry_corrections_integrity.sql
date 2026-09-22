SET search_path=hvb,public;
CREATE FUNCTION aplicar_revisao_cadastro() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=hvb,pg_temp AS $$
DECLARE tabela text;campos text[];campo text;expressao text;alteracoes text;dados jsonb;unidade uuid;ant revisao_cadastro;permissao_exigida text;
BEGIN
 IF NEW.organizacao_id IS DISTINCT FROM nullif(current_setting('hvb.org',true),'')::uuid THEN RAISE EXCEPTION 'Contexto da revisao invalido' USING ERRCODE='23514';END IF;
 IF NOT EXISTS(SELECT 1 FROM comando WHERE organizacao_id=NEW.organizacao_id AND id=NEW.comando_id AND autor_id=NEW.autor_id AND concluido_em IS NULL) THEN RAISE EXCEPTION 'Comando da revisao invalido' USING ERRCODE='23514';END IF;
 CASE NEW.tipo
 WHEN 'paciente' THEN tabela:='paciente';campos:=ARRAY['nome','especie_codigo','estado_vital'];
 WHEN 'responsavel' THEN tabela:='responsavel';campos:=ARRAY['nome'];
 WHEN 'usuario' THEN tabela:='usuario';campos:=ARRAY['nome','login'];
 WHEN 'unidade' THEN tabela:='unidade_hospitalar';campos:=ARRAY['nome'];
 WHEN 'dispositivo' THEN tabela:='dispositivo';campos:=ARRAY['nome'];
 WHEN 'local' THEN tabela:='local';campos:=ARRAY['nome','capacidade'];
 ELSE RAISE EXCEPTION 'Tipo de revisao invalido' USING ERRCODE='23514';END CASE;
 PERFORM pg_advisory_xact_lock(hashtextextended('cadastro:'||NEW.organizacao_id::text||':'||NEW.tipo||':'||NEW.alvo_id::text,0));
 IF NEW.tipo='local' THEN PERFORM pg_advisory_xact_lock(hashtextextended('capacidade:'||NEW.organizacao_id::text||':'||NEW.alvo_id::text,0));END IF;
 SELECT string_agg(format('%L,%I',x,x),',') INTO expressao FROM unnest(campos) x;
 EXECUTE format('SELECT jsonb_build_object(%s),%s FROM %I WHERE organizacao_id=$1 AND id=$2 FOR UPDATE',expressao,CASE WHEN NEW.tipo IN ('local','dispositivo') THEN 'unidade_id' WHEN NEW.tipo='unidade' THEN 'id' ELSE 'NULL::uuid' END,tabela) INTO dados,unidade USING NEW.organizacao_id,NEW.alvo_id;
 IF dados IS NULL THEN RAISE EXCEPTION 'Cadastro inexistente' USING ERRCODE='23514';END IF;
 IF NEW.unidade_id IS DISTINCT FROM unidade THEN RAISE EXCEPTION 'Unidade da revisao divergente' USING ERRCODE='23514';END IF;
 permissao_exigida:=CASE WHEN NEW.tipo IN ('paciente','responsavel') THEN 'cadastros:retificar' WHEN NEW.tipo='local' THEN 'locais:retificar' ELSE 'acesso:administrar' END;
 IF NOT EXISTS(SELECT 1 FROM atribuicao_consulta up JOIN papel_permissao pp ON pp.organizacao_id=up.organizacao_id AND pp.papel_id=up.papel_id WHERE up.organizacao_id=NEW.organizacao_id AND up.usuario_id=NEW.autor_id AND up.ativo AND pp.permissao=permissao_exigida AND (up.unidade_id IS NULL OR (NEW.tipo='local' AND up.unidade_id=unidade))) THEN RAISE EXCEPTION 'Autor sem permissao para revisar cadastro' USING ERRCODE='23514';END IF;
 SELECT * INTO ant FROM revisao_cadastro WHERE organizacao_id=NEW.organizacao_id AND tipo=NEW.tipo AND alvo_id=NEW.alvo_id ORDER BY versao DESC LIMIT 1;
 IF NEW.versao<>coalesce(ant.versao,0)+1 OR NEW.anterior_id IS DISTINCT FROM ant.id OR (ant.id IS NOT NULL AND ant.depois<>dados) THEN RAISE EXCEPTION 'Revisao desatualizada ou cadastro divergente do historico' USING ERRCODE='23514';END IF;
 IF jsonb_typeof(NEW.depois) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Dados invalidos' USING ERRCODE='23514';END IF;
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(NEW.depois) k) IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(campos) x) THEN RAISE EXCEPTION 'Campos divergentes do cadastro' USING ERRCODE='23514';END IF;
 FOREACH campo IN ARRAY campos LOOP
  IF campo='capacidade' THEN
   IF jsonb_typeof(NEW.depois->campo) IS DISTINCT FROM 'number' OR (NEW.depois->>campo) !~ '^[0-9]{1,4}$' OR (NEW.depois->>campo)::integer>1000 THEN RAISE EXCEPTION 'Capacidade invalida' USING ERRCODE='23514';END IF;
  ELSE
   IF jsonb_typeof(NEW.depois->campo) IS DISTINCT FROM 'string' OR length(NEW.depois->>campo) NOT BETWEEN 1 AND 160 OR (NEW.depois->>campo) !~ '[^[:space:]]' THEN RAISE EXCEPTION 'Texto cadastral invalido' USING ERRCODE='23514';END IF;
  END IF;
 END LOOP;
 IF NEW.tipo='usuario' AND (NEW.depois->>'login') !~ '^[a-z0-9._-]{3,80}$' THEN RAISE EXCEPTION 'Login invalido' USING ERRCODE='23514';END IF;
 IF NEW.tipo='local' AND EXISTS(SELECT 1 FROM ocupacao WHERE organizacao_id=NEW.organizacao_id AND local_id=NEW.alvo_id AND (fim IS NULL OR fim>clock_timestamp()) AND vaga>(NEW.depois->>'capacidade')::integer) THEN RAISE EXCEPTION 'Capacidade menor que vaga ainda ocupada' USING ERRCODE='23514';END IF;
 IF NEW.depois=dados THEN RAISE EXCEPTION 'Revisao sem alteracao' USING ERRCODE='23514';END IF;
 NEW.antes:=dados;
 SELECT string_agg(format('%I=($1->>%L)%s',x,x,CASE WHEN x='capacidade' THEN '::integer' ELSE '' END),',') INTO alteracoes FROM unnest(campos) x;
 EXECUTE format('UPDATE %I SET %s WHERE organizacao_id=$2 AND id=$3',tabela,alteracoes) USING NEW.depois,NEW.organizacao_id,NEW.alvo_id;
 RETURN NEW;
END $$;
CREATE TRIGGER b_aplicar BEFORE INSERT ON revisao_cadastro FOR EACH ROW EXECUTE FUNCTION aplicar_revisao_cadastro();
REVOKE ALL ON FUNCTION aplicar_revisao_cadastro() FROM PUBLIC;

CREATE FUNCTION validar_revisao_atribuicao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE alvo usuario_papel;ant revisao_atribuicao;
BEGIN
 SELECT * INTO STRICT alvo FROM usuario_papel WHERE organizacao_id=NEW.organizacao_id AND id=NEW.atribuicao_id;
 PERFORM pg_advisory_xact_lock(hashtextextended('acesso:'||NEW.organizacao_id::text||':'||alvo.usuario_id::text,0));
 SELECT * INTO ant FROM revisao_atribuicao WHERE organizacao_id=NEW.organizacao_id AND atribuicao_id=NEW.atribuicao_id ORDER BY versao DESC LIMIT 1;
 IF NEW.versao<>coalesce(ant.versao,0)+1 OR NEW.anterior_id IS DISTINCT FROM ant.id OR NEW.ativo=coalesce(ant.ativo,true) THEN RAISE EXCEPTION 'Estado de atribuicao desatualizado ou repetido' USING ERRCODE='23514';END IF;
 IF NOT EXISTS(SELECT 1 FROM atribuicao_consulta up JOIN papel_permissao pp ON pp.organizacao_id=up.organizacao_id AND pp.papel_id=up.papel_id WHERE up.organizacao_id=NEW.organizacao_id AND up.usuario_id=NEW.autor_id AND up.ativo AND up.unidade_id IS NULL AND pp.permissao='acesso:administrar') THEN RAISE EXCEPTION 'Autor sem administracao global' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER b_validar BEFORE INSERT ON revisao_atribuicao FOR EACH ROW EXECUTE FUNCTION validar_revisao_atribuicao();
REVOKE ALL ON FUNCTION validar_revisao_atribuicao() FROM PUBLIC;

-- Capacity changes serialize with both admission and closing of occupancy.
CREATE OR REPLACE FUNCTION validar_ocupacao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE cap integer;adm timestamptz;encerrado timestamptz;
BEGIN
 SELECT admitido_em,encerrado_em INTO adm,encerrado FROM episodio WHERE organizacao_id=NEW.organizacao_id AND id=NEW.episodio_id FOR UPDATE;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organizacao_id::text||':'||NEW.local_id::text||':'||NEW.vaga::text,0));
 PERFORM pg_advisory_xact_lock_shared(hashtextextended('capacidade:'||NEW.organizacao_id::text||':'||NEW.local_id::text,0));
 SELECT capacidade INTO cap FROM local WHERE organizacao_id=NEW.organizacao_id AND id=NEW.local_id;
 IF NEW.vaga>cap OR NEW.inicio<adm OR (encerrado IS NOT NULL AND (NEW.fim IS NULL OR NEW.fim>encerrado)) THEN RAISE EXCEPTION 'Ocupacao incompativel' USING ERRCODE='23514';END IF;
 IF TG_OP='UPDATE' AND (OLD.fim IS NOT NULL OR (NEW.organizacao_id,NEW.unidade_id,NEW.episodio_id,NEW.local_id,NEW.vaga,NEW.inicio) IS DISTINCT FROM (OLD.organizacao_id,OLD.unidade_id,OLD.episodio_id,OLD.local_id,OLD.vaga,OLD.inicio)) THEN RAISE EXCEPTION 'Preserve historico de ocupacao' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
