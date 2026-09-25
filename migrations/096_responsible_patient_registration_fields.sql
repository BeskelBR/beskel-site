-- 096_responsible_patient_registration_fields.sql
-- Amplia os cadastros de responsavel e paciente conforme decisao de dominio.
-- Mantem campos novos inicialmente opcionais e preserva revisao_cadastro como trilha unica.
-- Nao altera Terminal/C18, financeiro ou fluxo de orcamento.

ALTER TABLE hvb.responsavel
  ADD COLUMN cpf text,
  ADD COLUMN telefone_whatsapp text,
  ADD COLUMN email text,
  ADD COLUMN endereco text,
  ADD COLUMN data_nascimento date,
  ADD CONSTRAINT responsavel_cpf_check
    CHECK (cpf IS NULL OR hvb.cpf_valido(cpf)),
  ADD CONSTRAINT responsavel_telefone_whatsapp_check
    CHECK (telefone_whatsapp IS NULL OR telefone_whatsapp ~ '^[0-9]{10,13}$'),
  ADD CONSTRAINT responsavel_email_check
    CHECK (
      email IS NULL OR (
        length(email) BETWEEN 3 AND 254
        AND email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      )
    ),
  ADD CONSTRAINT responsavel_endereco_check
    CHECK (
      endereco IS NULL OR (
        length(endereco) BETWEEN 5 AND 500
        AND endereco ~ '[^[:space:]]'
      )
    ),
  ADD CONSTRAINT responsavel_data_nascimento_check
    CHECK (data_nascimento IS NULL OR data_nascimento <= criado_em::date);

CREATE UNIQUE INDEX responsavel_cpf_uq
ON hvb.responsavel (organizacao_id, cpf)
WHERE cpf IS NOT NULL;

ALTER TABLE hvb.paciente
  ADD COLUMN data_nascimento date,
  ADD COLUMN nascimento_estimado boolean NOT NULL DEFAULT false,
  ADD COLUMN sexo text,
  ADD COLUMN raca text,
  ADD COLUMN microchip text,
  ADD COLUMN pelagem text,
  ADD COLUMN castrado boolean,
  ADD COLUMN cirurgias_procedimentos_relevantes text,
  ADD CONSTRAINT paciente_data_nascimento_check
    CHECK (data_nascimento IS NULL OR data_nascimento <= criado_em::date),
  ADD CONSTRAINT paciente_nascimento_estimado_check
    CHECK (NOT nascimento_estimado OR data_nascimento IS NOT NULL),
  ADD CONSTRAINT paciente_sexo_check
    CHECK (sexo IS NULL OR sexo IN ('macho','femea','indeterminado')),
  ADD CONSTRAINT paciente_raca_check
    CHECK (
      raca IS NULL OR (
        length(raca) BETWEEN 1 AND 120
        AND raca ~ '[^[:space:]]'
      )
    ),
  ADD CONSTRAINT paciente_microchip_check
    CHECK (
      microchip IS NULL OR (
        length(microchip) BETWEEN 4 AND 64
        AND microchip ~ '[^[:space:]]'
      )
    ),
  ADD CONSTRAINT paciente_pelagem_check
    CHECK (
      pelagem IS NULL OR (
        length(pelagem) BETWEEN 1 AND 120
        AND pelagem ~ '[^[:space:]]'
      )
    ),
  ADD CONSTRAINT paciente_cirurgias_procedimentos_relevantes_check
    CHECK (
      cirurgias_procedimentos_relevantes IS NULL OR (
        length(cirurgias_procedimentos_relevantes) BETWEEN 1 AND 4000
        AND cirurgias_procedimentos_relevantes ~ '[^[:space:]]'
      )
    );

CREATE UNIQUE INDEX paciente_microchip_uq
ON hvb.paciente (organizacao_id, microchip)
WHERE microchip IS NOT NULL;

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
    SELECT 1
    FROM comando
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
        'nome','especie_codigo','estado_vital',
        'data_nascimento','nascimento_estimado','sexo','raca',
        'microchip','pelagem','castrado','cirurgias_procedimentos_relevantes'
      ];
      campos_novos_opcionais:=ARRAY[
        'data_nascimento','nascimento_estimado','sexo','raca',
        'microchip','pelagem','castrado','cirurgias_procedimentos_relevantes'
      ];
    WHEN 'responsavel' THEN
      tabela:='responsavel';
      campos:=ARRAY[
        'nome','cpf','telefone_whatsapp','email','endereco','data_nascimento'
      ];
      campos_novos_opcionais:=ARRAY[
        'cpf','telefone_whatsapp','email','endereco','data_nascimento'
      ];
    WHEN 'usuario' THEN
      tabela:='usuario'; campos:=ARRAY['nome','login'];
    WHEN 'unidade' THEN
      tabela:='unidade_hospitalar'; campos:=ARRAY['nome'];
    WHEN 'dispositivo' THEN
      tabela:='dispositivo'; campos:=ARRAY['nome'];
    WHEN 'local' THEN
      tabela:='local'; campos:=ARRAY['nome','capacidade'];
    ELSE
      RAISE EXCEPTION 'Tipo de revisao invalido' USING ERRCODE='23514';
  END CASE;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('cadastro:'||NEW.organizacao_id::text||':'||NEW.tipo||':'||NEW.alvo_id::text,0)
  );
  IF NEW.tipo='local' THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended('capacidade:'||NEW.organizacao_id::text||':'||NEW.alvo_id::text,0)
    );
  END IF;

  SELECT string_agg(format('%L,%I',x,x),',')
    INTO expressao
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

  IF dados IS NULL THEN
    RAISE EXCEPTION 'Cadastro inexistente' USING ERRCODE='23514';
  END IF;
  IF NEW.unidade_id IS DISTINCT FROM unidade THEN
    RAISE EXCEPTION 'Unidade da revisao divergente' USING ERRCODE='23514';
  END IF;

  permissao_exigida:=CASE
    WHEN NEW.tipo IN ('paciente','responsavel') THEN 'cadastros:retificar'
    WHEN NEW.tipo='local' THEN 'locais:retificar'
    ELSE 'acesso:administrar'
  END;

  IF NOT EXISTS(
    SELECT 1
    FROM atribuicao_consulta up
    JOIN papel_permissao pp
      ON pp.organizacao_id=up.organizacao_id
     AND pp.papel_id=up.papel_id
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
    IF jsonb_typeof(NEW.depois->'nome') IS DISTINCT FROM 'string'
       OR length(NEW.depois->>'nome') NOT BETWEEN 1 AND 160
       OR (NEW.depois->>'nome') !~ '[^[:space:]]' THEN
      RAISE EXCEPTION 'Nome do responsavel invalido' USING ERRCODE='23514';
    END IF;

    IF NEW.depois->'cpf' <> 'null'::jsonb AND (
      jsonb_typeof(NEW.depois->'cpf') IS DISTINCT FROM 'string'
      OR NOT hvb.cpf_valido(NEW.depois->>'cpf')
    ) THEN
      RAISE EXCEPTION 'CPF do responsavel invalido' USING ERRCODE='23514';
    END IF;

    IF NEW.depois->'telefone_whatsapp' <> 'null'::jsonb AND (
      jsonb_typeof(NEW.depois->'telefone_whatsapp') IS DISTINCT FROM 'string'
      OR (NEW.depois->>'telefone_whatsapp') !~ '^[0-9]{10,13}$'
    ) THEN
      RAISE EXCEPTION 'Telefone/WhatsApp invalido' USING ERRCODE='23514';
    END IF;

    IF NEW.depois->'email' <> 'null'::jsonb AND (
      jsonb_typeof(NEW.depois->'email') IS DISTINCT FROM 'string'
      OR length(NEW.depois->>'email') NOT BETWEEN 3 AND 254
      OR (NEW.depois->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    ) THEN
      RAISE EXCEPTION 'Email do responsavel invalido' USING ERRCODE='23514';
    END IF;

    IF NEW.depois->'endereco' <> 'null'::jsonb AND (
      jsonb_typeof(NEW.depois->'endereco') IS DISTINCT FROM 'string'
      OR length(NEW.depois->>'endereco') NOT BETWEEN 5 AND 500
      OR (NEW.depois->>'endereco') !~ '[^[:space:]]'
    ) THEN
      RAISE EXCEPTION 'Endereco do responsavel invalido' USING ERRCODE='23514';
    END IF;

    IF NEW.depois->'data_nascimento' <> 'null'::jsonb AND
       jsonb_typeof(NEW.depois->'data_nascimento') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Data de nascimento do responsavel invalida' USING ERRCODE='23514';
    END IF;

  ELSIF NEW.tipo='paciente' THEN
    FOREACH campo IN ARRAY ARRAY['nome','especie_codigo','estado_vital'] LOOP
      IF jsonb_typeof(NEW.depois->campo) IS DISTINCT FROM 'string'
         OR length(NEW.depois->>campo) NOT BETWEEN 1 AND 160
         OR (NEW.depois->>campo) !~ '[^[:space:]]' THEN
        RAISE EXCEPTION 'Texto cadastral do paciente invalido' USING ERRCODE='23514';
      END IF;
    END LOOP;

    IF NEW.depois->'data_nascimento' <> 'null'::jsonb AND
       jsonb_typeof(NEW.depois->'data_nascimento') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Data de nascimento do paciente invalida' USING ERRCODE='23514';
    END IF;

    IF jsonb_typeof(NEW.depois->'nascimento_estimado') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Indicador de nascimento estimado invalido' USING ERRCODE='23514';
    END IF;

    IF NEW.depois->'sexo' <> 'null'::jsonb AND (
      jsonb_typeof(NEW.depois->'sexo') IS DISTINCT FROM 'string'
      OR (NEW.depois->>'sexo') NOT IN ('macho','femea','indeterminado')
    ) THEN
      RAISE EXCEPTION 'Sexo do paciente invalido' USING ERRCODE='23514';
    END IF;

    FOREACH campo IN ARRAY ARRAY['raca','pelagem'] LOOP
      IF NEW.depois->campo <> 'null'::jsonb AND (
        jsonb_typeof(NEW.depois->campo) IS DISTINCT FROM 'string'
        OR length(NEW.depois->>campo) NOT BETWEEN 1 AND 120
        OR (NEW.depois->>campo) !~ '[^[:space:]]'
      ) THEN
        RAISE EXCEPTION 'Texto cadastral complementar do paciente invalido'
          USING ERRCODE='23514';
      END IF;
    END LOOP;

    IF NEW.depois->'microchip' <> 'null'::jsonb AND (
      jsonb_typeof(NEW.depois->'microchip') IS DISTINCT FROM 'string'
      OR length(NEW.depois->>'microchip') NOT BETWEEN 4 AND 64
      OR (NEW.depois->>'microchip') !~ '[^[:space:]]'
    ) THEN
      RAISE EXCEPTION 'Microchip do paciente invalido' USING ERRCODE='23514';
    END IF;

    IF NEW.depois->'castrado' <> 'null'::jsonb AND
       jsonb_typeof(NEW.depois->'castrado') IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Estado de castracao invalido' USING ERRCODE='23514';
    END IF;

    IF NEW.depois->'cirurgias_procedimentos_relevantes' <> 'null'::jsonb AND (
      jsonb_typeof(NEW.depois->'cirurgias_procedimentos_relevantes') IS DISTINCT FROM 'string'
      OR length(NEW.depois->>'cirurgias_procedimentos_relevantes') NOT BETWEEN 1 AND 4000
      OR (NEW.depois->>'cirurgias_procedimentos_relevantes') !~ '[^[:space:]]'
    ) THEN
      RAISE EXCEPTION 'Resumo de cirurgias/procedimentos invalido'
        USING ERRCODE='23514';
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
    SELECT 1
    FROM ocupacao
    WHERE organizacao_id=NEW.organizacao_id
      AND local_id=NEW.alvo_id
      AND (fim IS NULL OR fim>clock_timestamp())
      AND vaga>(NEW.depois->>'capacidade')::integer
  ) THEN
    RAISE EXCEPTION 'Capacidade menor que vaga ainda ocupada' USING ERRCODE='23514';
  END IF;

  IF NEW.depois=dados THEN
    RAISE EXCEPTION 'Revisao sem alteracao' USING ERRCODE='23514';
  END IF;

  NEW.antes:=dados;

  SELECT string_agg(
    CASE
      WHEN x='capacidade' THEN
        format('%I=($1->>%L)::integer',x,x)
      WHEN x='data_nascimento' THEN
        format('%I=($1->>%L)::date',x,x)
      WHEN x IN ('nascimento_estimado','castrado') THEN
        format('%I=($1->>%L)::boolean',x,x)
      ELSE
        format('%I=$1->>%L',x,x)
    END,
    ','
  )
  INTO alteracoes
  FROM unnest(campos) x;

  EXECUTE format(
    'UPDATE %I SET %s WHERE organizacao_id=$2 AND id=$3',
    tabela,
    alteracoes
  )
  USING NEW.depois,NEW.organizacao_id,NEW.alvo_id;

  RETURN NEW;
END
$function$;
