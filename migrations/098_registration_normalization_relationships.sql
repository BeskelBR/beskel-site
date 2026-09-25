
ALTER TABLE hvb.responsavel
  DROP CONSTRAINT IF EXISTS responsavel_endereco_check,
  DROP COLUMN endereco,
  ADD COLUMN cep text,
  ADD COLUMN logradouro text,
  ADD COLUMN numero text,
  ADD COLUMN complemento text,
  ADD COLUMN bairro text,
  ADD COLUMN cidade text,
  ADD COLUMN uf text,
  ADD CONSTRAINT responsavel_cep_check CHECK (cep IS NULL OR cep ~ '^[0-9]{8}$'),
  ADD CONSTRAINT responsavel_logradouro_check CHECK (logradouro IS NULL OR (length(logradouro) BETWEEN 1 AND 200 AND logradouro ~ '[^[:space:]]')),
  ADD CONSTRAINT responsavel_numero_check CHECK (numero IS NULL OR (length(numero) BETWEEN 1 AND 30 AND numero ~ '[^[:space:]]')),
  ADD CONSTRAINT responsavel_complemento_check CHECK (complemento IS NULL OR (length(complemento) BETWEEN 1 AND 120 AND complemento ~ '[^[:space:]]')),
  ADD CONSTRAINT responsavel_bairro_check CHECK (bairro IS NULL OR (length(bairro) BETWEEN 1 AND 120 AND bairro ~ '[^[:space:]]')),
  ADD CONSTRAINT responsavel_cidade_check CHECK (cidade IS NULL OR (length(cidade) BETWEEN 1 AND 120 AND cidade ~ '[^[:space:]]')),
  ADD CONSTRAINT responsavel_uf_check CHECK (uf IS NULL OR uf ~ '^[A-Z]{2}$');

ALTER TABLE hvb.paciente
  DROP CONSTRAINT IF EXISTS paciente_contato_emergencia_check,
  DROP COLUMN contato_emergencia,
  ADD COLUMN contato_emergencia_nome text,
  ADD COLUMN contato_emergencia_telefone text,
  ADD COLUMN contato_emergencia_vinculo text,
  ADD CONSTRAINT paciente_contato_emergencia_nome_check
    CHECK (contato_emergencia_nome IS NULL OR (length(contato_emergencia_nome) BETWEEN 1 AND 160 AND contato_emergencia_nome ~ '[^[:space:]]')),
  ADD CONSTRAINT paciente_contato_emergencia_telefone_check
    CHECK (contato_emergencia_telefone IS NULL OR contato_emergencia_telefone ~ '^[0-9]{10,13}$'),
  ADD CONSTRAINT paciente_contato_emergencia_vinculo_check
    CHECK (contato_emergencia_vinculo IS NULL OR (length(contato_emergencia_vinculo) BETWEEN 1 AND 80 AND contato_emergencia_vinculo ~ '[^[:space:]]')),
  ADD CONSTRAINT paciente_contato_emergencia_par_check
    CHECK (
      (contato_emergencia_nome IS NULL AND contato_emergencia_telefone IS NULL AND contato_emergencia_vinculo IS NULL)
      OR
      (contato_emergencia_nome IS NOT NULL AND contato_emergencia_telefone IS NOT NULL)
    );

CREATE INDEX paciente_responsavel_responsavel_paciente
ON hvb.paciente_responsavel (organizacao_id, responsavel_id, paciente_id, inicio, fim);

CREATE OR REPLACE FUNCTION hvb.normalizar_cadastro_responsavel_paciente()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=hvb,pg_temp
AS $function$
BEGIN
  IF TG_TABLE_NAME='responsavel' THEN
    NEW.nome:=regexp_replace(btrim(NEW.nome),'[[:space:]]+',' ','g');
    IF NEW.cpf IS NOT NULL THEN NEW.cpf:=nullif(regexp_replace(NEW.cpf,'[^0-9]','','g'),''); END IF;
    IF NEW.telefone_whatsapp IS NOT NULL THEN NEW.telefone_whatsapp:=nullif(regexp_replace(NEW.telefone_whatsapp,'[^0-9]','','g'),''); END IF;
    IF NEW.email IS NOT NULL THEN NEW.email:=nullif(lower(btrim(NEW.email)),''); END IF;
    IF NEW.cep IS NOT NULL THEN NEW.cep:=nullif(regexp_replace(NEW.cep,'[^0-9]','','g'),''); END IF;
    IF NEW.logradouro IS NOT NULL THEN NEW.logradouro:=nullif(regexp_replace(btrim(NEW.logradouro),'[[:space:]]+',' ','g'),''); END IF;
    IF NEW.numero IS NOT NULL THEN NEW.numero:=nullif(btrim(NEW.numero),''); END IF;
    IF NEW.complemento IS NOT NULL THEN NEW.complemento:=nullif(regexp_replace(btrim(NEW.complemento),'[[:space:]]+',' ','g'),''); END IF;
    IF NEW.bairro IS NOT NULL THEN NEW.bairro:=nullif(regexp_replace(btrim(NEW.bairro),'[[:space:]]+',' ','g'),''); END IF;
    IF NEW.cidade IS NOT NULL THEN NEW.cidade:=nullif(regexp_replace(btrim(NEW.cidade),'[[:space:]]+',' ','g'),''); END IF;
    IF NEW.uf IS NOT NULL THEN NEW.uf:=nullif(upper(regexp_replace(btrim(NEW.uf),'[[:space:]]+','','g')),''); END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME='paciente' THEN
    NEW.nome:=regexp_replace(btrim(NEW.nome),'[[:space:]]+',' ','g');
    IF NEW.sexo IS NOT NULL THEN NEW.sexo:=nullif(lower(btrim(NEW.sexo)),''); END IF;
    IF NEW.raca IS NOT NULL THEN NEW.raca:=nullif(regexp_replace(btrim(NEW.raca),'[[:space:]]+',' ','g'),''); END IF;
    IF NEW.microchip IS NOT NULL THEN NEW.microchip:=nullif(upper(regexp_replace(NEW.microchip,'[[:space:]]+','','g')),''); END IF;
    IF NEW.pelagem IS NOT NULL THEN NEW.pelagem:=nullif(regexp_replace(btrim(NEW.pelagem),'[[:space:]]+',' ','g'),''); END IF;
    IF NEW.observacoes IS NOT NULL THEN NEW.observacoes:=nullif(btrim(NEW.observacoes),''); END IF;
    IF NEW.contato_emergencia_nome IS NOT NULL THEN NEW.contato_emergencia_nome:=nullif(regexp_replace(btrim(NEW.contato_emergencia_nome),'[[:space:]]+',' ','g'),''); END IF;
    IF NEW.contato_emergencia_telefone IS NOT NULL THEN NEW.contato_emergencia_telefone:=nullif(regexp_replace(NEW.contato_emergencia_telefone,'[^0-9]','','g'),''); END IF;
    IF NEW.contato_emergencia_vinculo IS NOT NULL THEN NEW.contato_emergencia_vinculo:=nullif(regexp_replace(btrim(NEW.contato_emergencia_vinculo),'[[:space:]]+',' ','g'),''); END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER responsavel_normalizar_cadastro
BEFORE INSERT OR UPDATE ON hvb.responsavel
FOR EACH ROW EXECUTE FUNCTION hvb.normalizar_cadastro_responsavel_paciente();

CREATE TRIGGER paciente_normalizar_cadastro
BEFORE INSERT OR UPDATE ON hvb.paciente
FOR EACH ROW EXECUTE FUNCTION hvb.normalizar_cadastro_responsavel_paciente();

CREATE OR REPLACE FUNCTION hvb.aplicar_revisao_cadastro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'hvb', 'pg_temp'
AS $function$
DECLARE
  tabela text;
  campos text[];
  campos_novos_opcionais text[];
  campo text;
  expressao text;
  alteracoes text;
  dados jsonb;
  unidade uuid;
  ant revisao_cadastro;
  permissao_exigida text;
BEGIN
  IF NEW.organizacao_id IS DISTINCT FROM nullif(current_setting('hvb.org',true),'')::uuid THEN
    RAISE EXCEPTION 'Contexto da revisao invalido' USING ERRCODE='23514';
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM comando
    WHERE organizacao_id=NEW.organizacao_id
      AND id=NEW.comando_id
      AND autor_id=NEW.autor_id
      AND concluido_em IS NULL
  ) THEN
    RAISE EXCEPTION 'Comando da revisao invalido' USING ERRCODE='23514';
  END IF;

  CASE NEW.tipo
    WHEN 'paciente' THEN
      tabela:='paciente';
      campos:=ARRAY[
        'nome','especie_codigo','estado_vital','data_nascimento','sexo','raca',
        'microchip','pelagem','castrado','observacoes',
        'contato_emergencia_nome','contato_emergencia_telefone','contato_emergencia_vinculo'
      ];
      campos_novos_opcionais:=ARRAY[
        'data_nascimento','sexo','raca','microchip','pelagem','castrado','observacoes',
        'contato_emergencia_nome','contato_emergencia_telefone','contato_emergencia_vinculo'
      ];
    WHEN 'responsavel' THEN
      tabela:='responsavel';
      campos:=ARRAY[
        'nome','cpf','telefone_whatsapp','email','data_nascimento',
        'cep','logradouro','numero','complemento','bairro','cidade','uf'
      ];
      campos_novos_opcionais:=ARRAY[
        'cpf','telefone_whatsapp','email','data_nascimento',
        'cep','logradouro','numero','complemento','bairro','cidade','uf'
      ];
    WHEN 'usuario' THEN tabela:='usuario'; campos:=ARRAY['nome','login'];
    WHEN 'unidade' THEN tabela:='unidade_hospitalar'; campos:=ARRAY['nome'];
    WHEN 'dispositivo' THEN tabela:='dispositivo'; campos:=ARRAY['nome'];
    WHEN 'local' THEN tabela:='local'; campos:=ARRAY['nome','capacidade'];
    ELSE RAISE EXCEPTION 'Tipo de revisao invalido' USING ERRCODE='23514';
  END CASE;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('cadastro:'||NEW.organizacao_id::text||':'||NEW.tipo||':'||NEW.alvo_id::text,0)
  );
  IF NEW.tipo='local' THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended('capacidade:'||NEW.organizacao_id::text||':'||NEW.alvo_id::text,0)
    );
  END IF;

  SELECT string_agg(format('%L,%I',x,x),',') INTO expressao
  FROM unnest(campos) x;

  EXECUTE format(
    'SELECT jsonb_build_object(%s),%s FROM %I WHERE organizacao_id=$1 AND id=$2 FOR UPDATE',
    expressao,
    CASE
      WHEN NEW.tipo IN ('local','dispositivo') THEN 'unidade_id'
      WHEN NEW.tipo='unidade' THEN 'id'
      ELSE 'NULL::uuid'
    END,
    tabela
  )
  INTO dados,unidade
  USING NEW.organizacao_id,NEW.alvo_id;

  IF dados IS NULL THEN RAISE EXCEPTION 'Cadastro inexistente' USING ERRCODE='23514'; END IF;
  IF NEW.unidade_id IS DISTINCT FROM unidade THEN RAISE EXCEPTION 'Unidade da revisao divergente' USING ERRCODE='23514'; END IF;

  permissao_exigida:=CASE
    WHEN NEW.tipo IN ('paciente','responsavel') THEN 'cadastros:retificar'
    WHEN NEW.tipo='local' THEN 'locais:retificar'
    ELSE 'acesso:administrar'
  END;

  IF NOT EXISTS(
    SELECT 1
    FROM atribuicao_consulta up
    JOIN papel_permissao pp
      ON pp.organizacao_id=up.organizacao_id AND pp.papel_id=up.papel_id
    WHERE up.organizacao_id=NEW.organizacao_id
      AND up.usuario_id=NEW.autor_id
      AND up.ativo
      AND pp.permissao=permissao_exigida
      AND (up.unidade_id IS NULL OR (NEW.tipo='local' AND up.unidade_id=unidade))
  ) THEN
    RAISE EXCEPTION 'Autor sem permissao para revisar cadastro' USING ERRCODE='23514';
  END IF;

  SELECT * INTO ant
  FROM revisao_cadastro
  WHERE organizacao_id=NEW.organizacao_id
    AND tipo=NEW.tipo
    AND alvo_id=NEW.alvo_id
  ORDER BY versao DESC
  LIMIT 1;

  IF NEW.versao<>coalesce(ant.versao,0)+1
     OR NEW.anterior_id IS DISTINCT FROM ant.id
     OR (ant.id IS NOT NULL AND ant.depois<>dados) THEN
    RAISE EXCEPTION 'Revisao desatualizada ou cadastro divergente do historico'
      USING ERRCODE='23514';
  END IF;

  IF jsonb_typeof(NEW.depois) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Dados invalidos' USING ERRCODE='23514';
  END IF;

  IF campos_novos_opcionais IS NOT NULL THEN
    FOREACH campo IN ARRAY campos_novos_opcionais LOOP
      IF NOT (NEW.depois ? campo) THEN
        NEW.depois:=jsonb_set(NEW.depois,ARRAY[campo],dados->campo,true);
      END IF;
    END LOOP;
  END IF;

  IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(NEW.depois) k)
     IS DISTINCT FROM
     (SELECT array_agg(x ORDER BY x) FROM unnest(campos) x) THEN
    RAISE EXCEPTION 'Campos divergentes do cadastro' USING ERRCODE='23514';
  END IF;

  IF NEW.tipo='responsavel' THEN
    NEW.depois:=jsonb_set(NEW.depois,'{nome}',to_jsonb(regexp_replace(btrim(NEW.depois->>'nome'),'[[:space:]]+',' ','g')),true);
    IF NEW.depois->'cpf' <> 'null'::jsonb THEN NEW.depois:=jsonb_set(NEW.depois,'{cpf}',coalesce(to_jsonb(nullif(regexp_replace(NEW.depois->>'cpf','[^0-9]','','g'),'')),'null'::jsonb),true); END IF;
    IF NEW.depois->'telefone_whatsapp' <> 'null'::jsonb THEN NEW.depois:=jsonb_set(NEW.depois,'{telefone_whatsapp}',coalesce(to_jsonb(nullif(regexp_replace(NEW.depois->>'telefone_whatsapp','[^0-9]','','g'),'')),'null'::jsonb),true); END IF;
    IF NEW.depois->'email' <> 'null'::jsonb THEN NEW.depois:=jsonb_set(NEW.depois,'{email}',coalesce(to_jsonb(nullif(lower(btrim(NEW.depois->>'email')),'')),'null'::jsonb),true); END IF;
    IF NEW.depois->'cep' <> 'null'::jsonb THEN NEW.depois:=jsonb_set(NEW.depois,'{cep}',coalesce(to_jsonb(nullif(regexp_replace(NEW.depois->>'cep','[^0-9]','','g'),'')),'null'::jsonb),true); END IF;
    FOREACH campo IN ARRAY ARRAY['logradouro','complemento','bairro','cidade'] LOOP
      IF NEW.depois->campo <> 'null'::jsonb THEN
        NEW.depois:=jsonb_set(NEW.depois,ARRAY[campo],coalesce(to_jsonb(nullif(regexp_replace(btrim(NEW.depois->>campo),'[[:space:]]+',' ','g'),'')),'null'::jsonb),true);
      END IF;
    END LOOP;
    IF NEW.depois->'numero' <> 'null'::jsonb THEN NEW.depois:=jsonb_set(NEW.depois,'{numero}',coalesce(to_jsonb(nullif(btrim(NEW.depois->>'numero'),'')),'null'::jsonb),true); END IF;
    IF NEW.depois->'uf' <> 'null'::jsonb THEN NEW.depois:=jsonb_set(NEW.depois,'{uf}',coalesce(to_jsonb(nullif(upper(regexp_replace(btrim(NEW.depois->>'uf'),'[[:space:]]+','','g')),'')),'null'::jsonb),true); END IF;

    IF jsonb_typeof(NEW.depois->'nome') IS DISTINCT FROM 'string'
       OR length(NEW.depois->>'nome') NOT BETWEEN 1 AND 160 THEN
      RAISE EXCEPTION 'Nome do responsavel invalido' USING ERRCODE='23514';
    END IF;
    IF NEW.depois->'cpf' <> 'null'::jsonb AND (jsonb_typeof(NEW.depois->'cpf') IS DISTINCT FROM 'string' OR NOT hvb.cpf_valido(NEW.depois->>'cpf')) THEN
      RAISE EXCEPTION 'CPF do responsavel invalido' USING ERRCODE='23514';
    END IF;
    IF NEW.depois->'telefone_whatsapp' <> 'null'::jsonb AND (jsonb_typeof(NEW.depois->'telefone_whatsapp') IS DISTINCT FROM 'string' OR (NEW.depois->>'telefone_whatsapp') !~ '^[0-9]{10,13}$') THEN
      RAISE EXCEPTION 'Telefone/WhatsApp invalido' USING ERRCODE='23514';
    END IF;
    IF NEW.depois->'email' <> 'null'::jsonb AND (jsonb_typeof(NEW.depois->'email') IS DISTINCT FROM 'string' OR length(NEW.depois->>'email') NOT BETWEEN 3 AND 254 OR (NEW.depois->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') THEN
      RAISE EXCEPTION 'Email do responsavel invalido' USING ERRCODE='23514';
    END IF;
    IF NEW.depois->'data_nascimento' <> 'null'::jsonb AND jsonb_typeof(NEW.depois->'data_nascimento') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Data de nascimento do responsavel invalida' USING ERRCODE='23514';
    END IF;

  ELSIF NEW.tipo='paciente' THEN
    NEW.depois:=jsonb_set(NEW.depois,'{nome}',to_jsonb(regexp_replace(btrim(NEW.depois->>'nome'),'[[:space:]]+',' ','g')),true);
    IF NEW.depois->'sexo' <> 'null'::jsonb THEN NEW.depois:=jsonb_set(NEW.depois,'{sexo}',coalesce(to_jsonb(nullif(lower(btrim(NEW.depois->>'sexo')),'')),'null'::jsonb),true); END IF;
    FOREACH campo IN ARRAY ARRAY['raca','pelagem','contato_emergencia_nome','contato_emergencia_vinculo'] LOOP
      IF NEW.depois->campo <> 'null'::jsonb THEN
        NEW.depois:=jsonb_set(NEW.depois,ARRAY[campo],coalesce(to_jsonb(nullif(regexp_replace(btrim(NEW.depois->>campo),'[[:space:]]+',' ','g'),'')),'null'::jsonb),true);
      END IF;
    END LOOP;
    IF NEW.depois->'microchip' <> 'null'::jsonb THEN NEW.depois:=jsonb_set(NEW.depois,'{microchip}',coalesce(to_jsonb(nullif(upper(regexp_replace(NEW.depois->>'microchip','[[:space:]]+','','g')),'')),'null'::jsonb),true); END IF;
    IF NEW.depois->'observacoes' <> 'null'::jsonb THEN NEW.depois:=jsonb_set(NEW.depois,'{observacoes}',coalesce(to_jsonb(nullif(btrim(NEW.depois->>'observacoes'),'')),'null'::jsonb),true); END IF;
    IF NEW.depois->'contato_emergencia_telefone' <> 'null'::jsonb THEN NEW.depois:=jsonb_set(NEW.depois,'{contato_emergencia_telefone}',coalesce(to_jsonb(nullif(regexp_replace(NEW.depois->>'contato_emergencia_telefone','[^0-9]','','g'),'')),'null'::jsonb),true); END IF;

    FOREACH campo IN ARRAY ARRAY['nome','especie_codigo','estado_vital'] LOOP
      IF jsonb_typeof(NEW.depois->campo) IS DISTINCT FROM 'string'
         OR length(NEW.depois->>campo) NOT BETWEEN 1 AND 160 THEN
        RAISE EXCEPTION 'Texto cadastral do paciente invalido' USING ERRCODE='23514';
      END IF;
    END LOOP;
    IF NEW.depois->'data_nascimento' <> 'null'::jsonb AND jsonb_typeof(NEW.depois->'data_nascimento') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Data de nascimento do paciente invalida' USING ERRCODE='23514';
    END IF;
    IF NEW.depois->'sexo' <> 'null'::jsonb AND (jsonb_typeof(NEW.depois->'sexo') IS DISTINCT FROM 'string' OR (NEW.depois->>'sexo') NOT IN ('macho','femea','indeterminado')) THEN
      RAISE EXCEPTION 'Sexo do paciente invalido' USING ERRCODE='23514';
    END IF;
    IF NEW.depois->'castrado' <> 'null'::jsonb AND jsonb_typeof(NEW.depois->'castrado') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Estado de castracao invalido' USING ERRCODE='23514';
    END IF;
    IF (
      (NEW.depois->'contato_emergencia_nome'='null'::jsonb AND NEW.depois->'contato_emergencia_telefone'<>'null'::jsonb)
      OR
      (NEW.depois->'contato_emergencia_nome'<>'null'::jsonb AND NEW.depois->'contato_emergencia_telefone'='null'::jsonb)
      OR
      (NEW.depois->'contato_emergencia_vinculo'<>'null'::jsonb AND NEW.depois->'contato_emergencia_nome'='null'::jsonb)
    ) THEN
      RAISE EXCEPTION 'Contato de emergencia incompleto' USING ERRCODE='23514';
    END IF;

  ELSE
    FOREACH campo IN ARRAY campos LOOP
      IF campo='capacidade' THEN
        IF jsonb_typeof(NEW.depois->campo) IS DISTINCT FROM 'number'
           OR (NEW.depois->>campo) !~ '^[0-9]{1,4}$'
           OR (NEW.depois->>campo)::integer>1000 THEN
          RAISE EXCEPTION 'Capacidade invalida' USING ERRCODE='23514';
        END IF;
      ELSE
        IF jsonb_typeof(NEW.depois->campo) IS DISTINCT FROM 'string'
           OR length(NEW.depois->>campo) NOT BETWEEN 1 AND 160
           OR (NEW.depois->>campo) !~ '[^[:space:]]' THEN
          RAISE EXCEPTION 'Texto cadastral invalido' USING ERRCODE='23514';
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF NEW.tipo='usuario' AND (NEW.depois->>'login') !~ '^[a-z0-9._-]{3,80}$' THEN
    RAISE EXCEPTION 'Login invalido' USING ERRCODE='23514';
  END IF;

  IF NEW.tipo='local' AND EXISTS(
    SELECT 1 FROM ocupacao
    WHERE organizacao_id=NEW.organizacao_id
      AND local_id=NEW.alvo_id
      AND (fim IS NULL OR fim>clock_timestamp())
      AND vaga>(NEW.depois->>'capacidade')::integer
  ) THEN
    RAISE EXCEPTION 'Capacidade menor que vaga ainda ocupada' USING ERRCODE='23514';
  END IF;

  IF NEW.depois=dados THEN RAISE EXCEPTION 'Revisao sem alteracao' USING ERRCODE='23514'; END IF;
  NEW.antes:=dados;

  SELECT string_agg(
    CASE
      WHEN x='capacidade' THEN format('%I=($1->>%L)::integer',x,x)
      WHEN x='data_nascimento' THEN format('%I=($1->>%L)::date',x,x)
      WHEN x='castrado' THEN format('%I=($1->>%L)::boolean',x,x)
      ELSE format('%I=$1->>%L',x,x)
    END,
    ','
  )
  INTO alteracoes
  FROM unnest(campos) x;

  EXECUTE format('UPDATE %I SET %s WHERE organizacao_id=$2 AND id=$3',tabela,alteracoes)
  USING NEW.depois,NEW.organizacao_id,NEW.alvo_id;

  RETURN NEW;
END
$function$;

CREATE OR REPLACE VIEW hvb.paciente_responsavel_consulta
WITH (security_invoker=true)
AS
SELECT
  pr.id AS vinculo_id,
  pr.organizacao_id,
  pr.paciente_id,
  p.nome AS paciente_nome,
  pr.responsavel_id,
  r.nome AS responsavel_nome,
  pr.papel,
  pr.inicio,
  pr.fim,
  CASE
    WHEN pr.inicio > clock_timestamp() THEN 'futuro'
    WHEN pr.fim IS NULL OR pr.fim > clock_timestamp() THEN 'ativo'
    ELSE 'encerrado'
  END AS estado,
  pr.registrado_em,
  pr.autor_id
FROM hvb.paciente_responsavel pr
JOIN hvb.paciente p
  ON p.organizacao_id=pr.organizacao_id AND p.id=pr.paciente_id
JOIN hvb.responsavel r
  ON r.organizacao_id=pr.organizacao_id AND r.id=pr.responsavel_id;

GRANT SELECT ON hvb.paciente_responsavel_consulta TO hvb_app;
