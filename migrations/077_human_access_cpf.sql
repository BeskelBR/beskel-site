
-- 077_human_access_cpf.sql
-- Identidade humana do HVB Sistema: CPF + senha temporaria + redefinicao obrigatoria.
-- Preserva credencial api opaca, hvb.autenticar, Terminal/C18 e migrations 001-076.

SET search_path=hvb,public;

CREATE OR REPLACE FUNCTION hvb.cpf_valido(valor text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path=pg_catalog,pg_temp
AS $$
DECLARE
  i integer;
  soma integer := 0;
  d1 integer;
  d2 integer;
BEGIN
  IF valor !~ '^[0-9]{11}$' THEN
    RETURN false;
  END IF;
  IF valor = repeat(substr(valor,1,1),11) THEN
    RETURN false;
  END IF;

  FOR i IN 1..9 LOOP
    soma := soma + substr(valor,i,1)::integer * (11-i);
  END LOOP;
  d1 := 11 - (soma % 11);
  IF d1 >= 10 THEN d1 := 0; END IF;
  IF d1 <> substr(valor,10,1)::integer THEN
    RETURN false;
  END IF;

  soma := 0;
  FOR i IN 1..10 LOOP
    soma := soma + substr(valor,i,1)::integer * (12-i);
  END LOOP;
  d2 := 11 - (soma % 11);
  IF d2 >= 10 THEN d2 := 0; END IF;
  RETURN d2 = substr(valor,11,1)::integer;
END
$$;

CREATE TABLE hvb.acesso_humano(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  email text NOT NULL,
  senha_hash text,
  senha_formato text,
  senha_versao integer NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'pendente_ativacao',
  senha_definida_em timestamptz,
  bloqueado_em timestamptz,
  bloqueado_por_id uuid,
  motivo_bloqueio text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organizacao_id,id),
  UNIQUE(organizacao_id,usuario_id),
  UNIQUE(organizacao_id,email),
  FOREIGN KEY(organizacao_id,usuario_id) REFERENCES hvb.usuario(organizacao_id,id),
  FOREIGN KEY(organizacao_id,bloqueado_por_id) REFERENCES hvb.usuario(organizacao_id,id),
  CHECK(email=lower(btrim(email)) AND length(email) BETWEEN 3 AND 254
        AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  CHECK(estado IN ('pendente_ativacao','ativo','recuperacao_pendente','bloqueado')),
  CHECK(
    (senha_hash IS NULL AND senha_formato IS NULL AND senha_versao=0 AND senha_definida_em IS NULL)
    OR
    (senha_hash IS NOT NULL AND senha_hash LIKE '$argon2id$%' AND length(senha_hash) BETWEEN 40 AND 512
     AND senha_formato='argon2id-phc' AND senha_versao>0 AND senha_definida_em IS NOT NULL)
  ),
  CHECK(estado<>'ativo' OR (senha_hash IS NOT NULL AND senha_versao>0 AND bloqueado_em IS NULL)),
  CHECK(
    (estado='bloqueado' AND bloqueado_em IS NOT NULL AND bloqueado_por_id IS NOT NULL
     AND motivo_bloqueio IS NOT NULL AND length(motivo_bloqueio) BETWEEN 1 AND 160)
    OR
    (estado<>'bloqueado' AND bloqueado_em IS NULL AND bloqueado_por_id IS NULL AND motivo_bloqueio IS NULL)
  )
);

CREATE TABLE hvb.senha_temporaria_humana(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  finalidade text NOT NULL,
  senha_hash text NOT NULL,
  senha_formato text NOT NULL,
  criada_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL,
  enviado_em timestamptz,
  consumida_em timestamptz,
  invalidada_em timestamptz,
  solicitada_por_id uuid NOT NULL,
  invalidada_por_id uuid,
  motivo_invalidacao text,
  UNIQUE(organizacao_id,id),
  FOREIGN KEY(organizacao_id,usuario_id) REFERENCES hvb.usuario(organizacao_id,id),
  FOREIGN KEY(organizacao_id,solicitada_por_id) REFERENCES hvb.usuario(organizacao_id,id),
  FOREIGN KEY(organizacao_id,invalidada_por_id) REFERENCES hvb.usuario(organizacao_id,id),
  CHECK(finalidade IN ('ativacao','recuperacao')),
  CHECK(senha_hash LIKE '$argon2id$%' AND length(senha_hash) BETWEEN 40 AND 512),
  CHECK(senha_formato='argon2id-phc'),
  CHECK(expira_em>criada_em),
  CHECK(NOT(consumida_em IS NOT NULL AND invalidada_em IS NOT NULL)),
  CHECK(consumida_em IS NULL OR enviado_em IS NOT NULL),
  CHECK(
    (invalidada_em IS NULL AND motivo_invalidacao IS NULL)
    OR
    (invalidada_em IS NOT NULL AND motivo_invalidacao IS NOT NULL
     AND length(motivo_invalidacao) BETWEEN 1 AND 160)
  )
);

CREATE UNIQUE INDEX senha_temporaria_humana_ativa_uq
ON hvb.senha_temporaria_humana(organizacao_id,usuario_id)
WHERE consumida_em IS NULL AND invalidada_em IS NULL;

CREATE INDEX senha_temporaria_humana_usuario_idx
ON hvb.senha_temporaria_humana(organizacao_id,usuario_id,criada_em DESC);

CREATE TABLE hvb.sessao_humana(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  credencial_id uuid NOT NULL,
  senha_versao integer NOT NULL,
  origem_chave text,
  autenticada_em timestamptz NOT NULL DEFAULT now(),
  encerrada_em timestamptz,
  motivo_encerramento text,
  UNIQUE(organizacao_id,id),
  UNIQUE(organizacao_id,credencial_id),
  FOREIGN KEY(organizacao_id,usuario_id) REFERENCES hvb.usuario(organizacao_id,id),
  FOREIGN KEY(organizacao_id,credencial_id) REFERENCES hvb.credencial(organizacao_id,id),
  CHECK(senha_versao>0),
  CHECK(origem_chave IS NULL OR origem_chave ~ '^[0-9a-f]{64}$'),
  CHECK(
    (encerrada_em IS NULL AND motivo_encerramento IS NULL)
    OR
    (encerrada_em IS NOT NULL AND motivo_encerramento IS NOT NULL
     AND length(motivo_encerramento) BETWEEN 1 AND 160)
  )
);

CREATE INDEX sessao_humana_usuario_ativa_idx
ON hvb.sessao_humana(organizacao_id,usuario_id,autenticada_em DESC)
WHERE encerrada_em IS NULL;

CREATE TABLE hvb.limite_acesso_humano(
  organizacao_id uuid NOT NULL,
  escopo text NOT NULL,
  chave text NOT NULL,
  falhas integer NOT NULL DEFAULT 0,
  janela_inicio timestamptz NOT NULL DEFAULT clock_timestamp(),
  bloqueado_ate timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(organizacao_id,escopo,chave),
  FOREIGN KEY(organizacao_id) REFERENCES hvb.organizacao(id),
  CHECK(escopo IN ('conta','origem')),
  CHECK(chave ~ '^[0-9a-f]{64}$'),
  CHECK(falhas>=0)
);

CREATE TABLE hvb.evento_identidade_humana(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id uuid NOT NULL,
  usuario_id uuid,
  credencial_id uuid,
  ator_id uuid,
  acao text NOT NULL,
  resultado text NOT NULL,
  conta_chave text,
  origem_chave text,
  correlation_id uuid NOT NULL UNIQUE,
  motivo text,
  ocorrido_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(organizacao_id,id),
  FOREIGN KEY(organizacao_id,usuario_id) REFERENCES hvb.usuario(organizacao_id,id),
  FOREIGN KEY(organizacao_id,credencial_id) REFERENCES hvb.credencial(organizacao_id,id),
  FOREIGN KEY(organizacao_id,ator_id) REFERENCES hvb.usuario(organizacao_id,id),
  CHECK(length(acao) BETWEEN 1 AND 80),
  CHECK(length(resultado) BETWEEN 1 AND 80),
  CHECK(conta_chave IS NULL OR conta_chave ~ '^[0-9a-f]{64}$'),
  CHECK(origem_chave IS NULL OR origem_chave ~ '^[0-9a-f]{64}$'),
  CHECK(motivo IS NULL OR length(motivo) BETWEEN 1 AND 160)
);

CREATE INDEX evento_identidade_humana_usuario_idx
ON hvb.evento_identidade_humana(organizacao_id,usuario_id,ocorrido_em DESC);

ALTER TABLE hvb.acesso_humano ENABLE ROW LEVEL SECURITY;
ALTER TABLE hvb.acesso_humano FORCE ROW LEVEL SECURITY;
ALTER TABLE hvb.senha_temporaria_humana ENABLE ROW LEVEL SECURITY;
ALTER TABLE hvb.senha_temporaria_humana FORCE ROW LEVEL SECURITY;
ALTER TABLE hvb.sessao_humana ENABLE ROW LEVEL SECURITY;
ALTER TABLE hvb.sessao_humana FORCE ROW LEVEL SECURITY;
ALTER TABLE hvb.limite_acesso_humano ENABLE ROW LEVEL SECURITY;
ALTER TABLE hvb.limite_acesso_humano FORCE ROW LEVEL SECURITY;
ALTER TABLE hvb.evento_identidade_humana ENABLE ROW LEVEL SECURITY;
ALTER TABLE hvb.evento_identidade_humana FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant ON hvb.acesso_humano
USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid)
WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
CREATE POLICY tenant ON hvb.senha_temporaria_humana
USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid)
WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
CREATE POLICY tenant ON hvb.sessao_humana
USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid)
WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
CREATE POLICY tenant ON hvb.limite_acesso_humano
USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid)
WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);
CREATE POLICY tenant ON hvb.evento_identidade_humana
USING(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid)
WITH CHECK(organizacao_id=nullif(current_setting('hvb.org',true),'')::uuid);

REVOKE ALL ON hvb.acesso_humano FROM PUBLIC,anon,authenticated,service_role,hvb_app,hvb_worker;
REVOKE ALL ON hvb.senha_temporaria_humana FROM PUBLIC,anon,authenticated,service_role,hvb_app,hvb_worker;
REVOKE ALL ON hvb.sessao_humana FROM PUBLIC,anon,authenticated,service_role,hvb_app,hvb_worker;
REVOKE ALL ON hvb.limite_acesso_humano FROM PUBLIC,anon,authenticated,service_role,hvb_app,hvb_worker;
REVOKE ALL ON hvb.evento_identidade_humana FROM PUBLIC,anon,authenticated,service_role,hvb_app,hvb_worker;

CREATE OR REPLACE FUNCTION hvb.validar_acesso_humano_cpf()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=hvb,pg_temp
AS $$
DECLARE login_atual text;
BEGIN
  SELECT login INTO login_atual
  FROM usuario
  WHERE organizacao_id=NEW.organizacao_id AND id=NEW.usuario_id;
  IF login_atual IS NULL OR NOT cpf_valido(login_atual) THEN
    RAISE EXCEPTION 'Acesso humano exige login CPF valido' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER validar_cpf
BEFORE INSERT OR UPDATE OF organizacao_id,usuario_id ON hvb.acesso_humano
FOR EACH ROW EXECUTE FUNCTION hvb.validar_acesso_humano_cpf();

CREATE OR REPLACE FUNCTION hvb.proteger_login_cpf_humano()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=hvb,pg_temp
AS $$
BEGIN
  IF NEW.login IS DISTINCT FROM OLD.login
     AND EXISTS(
       SELECT 1 FROM acesso_humano
       WHERE organizacao_id=OLD.organizacao_id AND usuario_id=OLD.id
     )
     AND NOT cpf_valido(NEW.login) THEN
    RAISE EXCEPTION 'Usuario com acesso humano deve manter login CPF valido' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER proteger_login_cpf_humano
BEFORE UPDATE OF login ON hvb.usuario
FOR EACH ROW EXECUTE FUNCTION hvb.proteger_login_cpf_humano();

CREATE OR REPLACE FUNCTION hvb.impedir_alteracao_evento_identidade_humana()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=hvb,pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Evento de identidade humana e imutavel' USING ERRCODE='23514';
END
$$;

CREATE TRIGGER imutavel
BEFORE UPDATE OR DELETE ON hvb.evento_identidade_humana
FOR EACH ROW EXECUTE FUNCTION hvb.impedir_alteracao_evento_identidade_humana();

CREATE OR REPLACE FUNCTION hvb.acesso_humano_status(
  p_organizacao_id uuid,
  p_autor_id uuid,
  p_usuario_id uuid
)
RETURNS TABLE(
  usuario_id uuid,
  login text,
  email text,
  estado text,
  senha_versao integer,
  senha_definida_em timestamptz,
  bloqueado_em timestamptz,
  temporaria_finalidade text,
  temporaria_expira_em timestamptz,
  temporaria_enviada_em timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=hvb,pg_temp
AS $$
DECLARE org_contexto uuid;
BEGIN
  org_contexto:=nullif(current_setting('hvb.org',true),'')::uuid;
  IF org_contexto IS DISTINCT FROM p_organizacao_id THEN
    RAISE EXCEPTION 'Contexto de organizacao invalido' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS(
    SELECT 1
    FROM atribuicao_consulta a
    JOIN papel_permissao pp
      ON pp.organizacao_id=a.organizacao_id AND pp.papel_id=a.papel_id
    WHERE a.organizacao_id=p_organizacao_id
      AND a.usuario_id=p_autor_id
      AND a.ativo
      AND a.unidade_id IS NULL
      AND pp.permissao='acesso:administrar'
  ) THEN
    RAISE EXCEPTION 'Autor sem administracao global' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
  SELECT u.id,u.login,ah.email,ah.estado,ah.senha_versao,ah.senha_definida_em,ah.bloqueado_em,
         st.finalidade,st.expira_em,st.enviado_em
  FROM usuario u
  LEFT JOIN acesso_humano ah
    ON (ah.organizacao_id,ah.usuario_id)=(u.organizacao_id,u.id)
  LEFT JOIN LATERAL(
    SELECT s.finalidade,s.expira_em,s.enviado_em
    FROM senha_temporaria_humana s
    WHERE s.organizacao_id=u.organizacao_id
      AND s.usuario_id=u.id
      AND s.consumida_em IS NULL
      AND s.invalidada_em IS NULL
    ORDER BY s.criada_em DESC
    LIMIT 1
  ) st ON true
  WHERE u.organizacao_id=p_organizacao_id AND u.id=p_usuario_id;
END
$$;

CREATE OR REPLACE FUNCTION hvb.acesso_humano_emitir_senha_temporaria(
  p_organizacao_id uuid,
  p_autor_id uuid,
  p_usuario_id uuid,
  p_email text,
  p_finalidade text,
  p_senha_hash text,
  p_senha_formato text,
  p_expira_em timestamptz,
  p_motivo text,
  p_correlation_id uuid
)
RETURNS TABLE(
  senha_temporaria_id uuid,
  estado text,
  email text,
  expira_em timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=hvb,pg_temp
AS $$
DECLARE
  org_contexto uuid;
  v_login text;
  v_email text;
  v_estado text;
  v_id uuid;
BEGIN
  org_contexto:=nullif(current_setting('hvb.org',true),'')::uuid;
  IF org_contexto IS DISTINCT FROM p_organizacao_id THEN
    RAISE EXCEPTION 'Contexto de organizacao invalido' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS(
    SELECT 1
    FROM atribuicao_consulta a
    JOIN papel_permissao pp
      ON pp.organizacao_id=a.organizacao_id AND pp.papel_id=a.papel_id
    WHERE a.organizacao_id=p_organizacao_id
      AND a.usuario_id=p_autor_id
      AND a.ativo
      AND a.unidade_id IS NULL
      AND pp.permissao='acesso:administrar'
  ) THEN
    RAISE EXCEPTION 'Autor sem administracao global' USING ERRCODE='42501';
  END IF;
  IF p_finalidade NOT IN ('ativacao','recuperacao') THEN
    RAISE EXCEPTION 'Finalidade invalida' USING ERRCODE='23514';
  END IF;
  IF p_senha_formato<>'argon2id-phc'
     OR p_senha_hash NOT LIKE '$argon2id$%'
     OR length(p_senha_hash) NOT BETWEEN 40 AND 512 THEN
    RAISE EXCEPTION 'Hash temporario invalido' USING ERRCODE='23514';
  END IF;
  IF p_expira_em<=clock_timestamp() THEN
    RAISE EXCEPTION 'Expiracao temporaria invalida' USING ERRCODE='23514';
  END IF;
  IF p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'Motivo invalido' USING ERRCODE='23514';
  END IF;

  v_email:=lower(btrim(p_email));
  IF length(v_email) NOT BETWEEN 3 AND 254
     OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Email invalido' USING ERRCODE='23514';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'acesso-humano:'||p_organizacao_id::text||':'||p_usuario_id::text,0));

  SELECT u.login INTO v_login
  FROM usuario u
  WHERE u.organizacao_id=p_organizacao_id AND u.id=p_usuario_id AND u.ativo
  FOR UPDATE;
  IF v_login IS NULL THEN
    RAISE EXCEPTION 'Usuario inexistente ou inativo' USING ERRCODE='23514';
  END IF;
  IF NOT cpf_valido(v_login) THEN
    RAISE EXCEPTION 'Login do usuario nao e CPF valido' USING ERRCODE='23514';
  END IF;

  SELECT ah.estado INTO v_estado
  FROM acesso_humano ah
  WHERE ah.organizacao_id=p_organizacao_id AND ah.usuario_id=p_usuario_id
  FOR UPDATE;

  IF p_finalidade='ativacao' THEN
    IF v_estado IN ('ativo','recuperacao_pendente','bloqueado') THEN
      RAISE EXCEPTION 'Acesso humano ja ativado ou indisponivel para ativacao' USING ERRCODE='23514';
    END IF;
    INSERT INTO acesso_humano(organizacao_id,usuario_id,email,estado)
    VALUES(p_organizacao_id,p_usuario_id,v_email,'pendente_ativacao')
    ON CONFLICT(organizacao_id,usuario_id)
    DO UPDATE SET email=EXCLUDED.email,atualizado_em=clock_timestamp();
    v_estado:='pendente_ativacao';
  ELSE
    IF v_estado IS NULL THEN
      RAISE EXCEPTION 'Acesso humano ainda nao ativado' USING ERRCODE='23514';
    END IF;
    IF v_estado='bloqueado' THEN
      RAISE EXCEPTION 'Acesso humano bloqueado' USING ERRCODE='23514';
    END IF;
    IF NOT EXISTS(
      SELECT 1 FROM acesso_humano
      WHERE organizacao_id=p_organizacao_id AND usuario_id=p_usuario_id
        AND senha_hash IS NOT NULL AND senha_versao>0
    ) THEN
      RAISE EXCEPTION 'Senha definitiva ainda nao definida' USING ERRCODE='23514';
    END IF;
    UPDATE acesso_humano
    SET email=v_email,estado='recuperacao_pendente',atualizado_em=clock_timestamp()
    WHERE organizacao_id=p_organizacao_id AND usuario_id=p_usuario_id;
    v_estado:='recuperacao_pendente';
  END IF;

  UPDATE senha_temporaria_humana
  SET invalidada_em=clock_timestamp(),
      invalidada_por_id=p_autor_id,
      motivo_invalidacao='Substituida por nova senha temporaria'
  WHERE organizacao_id=p_organizacao_id
    AND usuario_id=p_usuario_id
    AND consumida_em IS NULL
    AND invalidada_em IS NULL;

  INSERT INTO senha_temporaria_humana(
    organizacao_id,usuario_id,finalidade,senha_hash,senha_formato,
    expira_em,solicitada_por_id
  )
  VALUES(
    p_organizacao_id,p_usuario_id,p_finalidade,p_senha_hash,p_senha_formato,
    p_expira_em,p_autor_id
  )
  RETURNING id INTO v_id;

  INSERT INTO evento_identidade_humana(
    organizacao_id,usuario_id,ator_id,acao,resultado,correlation_id,motivo
  )
  VALUES(
    p_organizacao_id,p_usuario_id,p_autor_id,'senha_temporaria_emitida',
    'pendente_envio',p_correlation_id,btrim(p_motivo)
  );

  RETURN QUERY SELECT v_id,v_estado,v_email,p_expira_em;
END
$$;

CREATE OR REPLACE FUNCTION hvb.acesso_humano_marcar_senha_temporaria_enviada(
  p_organizacao_id uuid,
  p_senha_temporaria_id uuid,
  p_correlation_id uuid
)
RETURNS TABLE(
  senha_temporaria_id uuid,
  usuario_id uuid,
  enviado_em timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=hvb,pg_temp
AS $$
DECLARE
  v_usuario uuid;
  v_enviado timestamptz;
BEGIN
  SELECT s.usuario_id,s.enviado_em
  INTO v_usuario,v_enviado
  FROM senha_temporaria_humana s
  WHERE s.organizacao_id=p_organizacao_id AND s.id=p_senha_temporaria_id
  FOR UPDATE;

  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'Senha temporaria inexistente' USING ERRCODE='23514';
  END IF;
  IF EXISTS(
    SELECT 1 FROM senha_temporaria_humana s
    WHERE s.organizacao_id=p_organizacao_id AND s.id=p_senha_temporaria_id
      AND (s.consumida_em IS NOT NULL OR s.invalidada_em IS NOT NULL OR s.expira_em<=clock_timestamp())
  ) THEN
    RAISE EXCEPTION 'Senha temporaria nao esta ativa' USING ERRCODE='23514';
  END IF;

  IF v_enviado IS NULL THEN
    v_enviado:=clock_timestamp();
    UPDATE senha_temporaria_humana
    SET enviado_em=v_enviado
    WHERE organizacao_id=p_organizacao_id AND id=p_senha_temporaria_id;

    INSERT INTO evento_identidade_humana(
      organizacao_id,usuario_id,acao,resultado,correlation_id
    )
    VALUES(
      p_organizacao_id,v_usuario,'senha_temporaria_enviada','confirmado',p_correlation_id
    );
  END IF;

  RETURN QUERY SELECT p_senha_temporaria_id,v_usuario,v_enviado;
END
$$;

CREATE OR REPLACE FUNCTION hvb.acesso_humano_obter_prova(
  p_organizacao_id uuid,
  p_login text
)
RETURNS TABLE(
  usuario_id uuid,
  usuario_ativo boolean,
  estado text,
  senha_hash text,
  senha_formato text,
  senha_versao integer,
  temporaria_id uuid,
  temporaria_finalidade text,
  temporaria_hash text,
  temporaria_formato text,
  temporaria_expira_em timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path=hvb,pg_temp
AS $$
  SELECT u.id,u.ativo,ah.estado,ah.senha_hash,ah.senha_formato,ah.senha_versao,
         st.id,st.finalidade,st.senha_hash,st.senha_formato,st.expira_em
  FROM usuario u
  JOIN acesso_humano ah
    ON (ah.organizacao_id,ah.usuario_id)=(u.organizacao_id,u.id)
  LEFT JOIN LATERAL(
    SELECT s.id,s.finalidade,s.senha_hash,s.senha_formato,s.expira_em
    FROM senha_temporaria_humana s
    WHERE s.organizacao_id=u.organizacao_id
      AND s.usuario_id=u.id
      AND s.enviado_em IS NOT NULL
      AND s.consumida_em IS NULL
      AND s.invalidada_em IS NULL
      AND s.expira_em>clock_timestamp()
    ORDER BY s.criada_em DESC
    LIMIT 1
  ) st ON true
  WHERE u.organizacao_id=p_organizacao_id
    AND u.login=p_login
    AND cpf_valido(p_login)
$$;

CREATE OR REPLACE FUNCTION hvb.acesso_humano_consumir_senha_temporaria(
  p_organizacao_id uuid,
  p_usuario_id uuid,
  p_senha_temporaria_id uuid,
  p_nova_senha_hash text,
  p_nova_senha_formato text,
  p_correlation_id uuid
)
RETURNS TABLE(
  usuario_id uuid,
  estado text,
  senha_versao integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=hvb,pg_temp
AS $$
DECLARE
  v_temp senha_temporaria_humana;
  v_versao integer;
BEGIN
  IF p_nova_senha_formato<>'argon2id-phc'
     OR p_nova_senha_hash NOT LIKE '$argon2id$%'
     OR length(p_nova_senha_hash) NOT BETWEEN 40 AND 512 THEN
    RAISE EXCEPTION 'Hash definitivo invalido' USING ERRCODE='23514';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'acesso-humano:'||p_organizacao_id::text||':'||p_usuario_id::text,0));

  IF NOT EXISTS(
    SELECT 1 FROM usuario
    WHERE organizacao_id=p_organizacao_id AND id=p_usuario_id AND ativo
  ) THEN
    RAISE EXCEPTION 'Usuario inexistente ou inativo' USING ERRCODE='23514';
  END IF;

  SELECT * INTO v_temp
  FROM senha_temporaria_humana
  WHERE organizacao_id=p_organizacao_id
    AND id=p_senha_temporaria_id
    AND usuario_id=p_usuario_id
  FOR UPDATE;

  IF v_temp.id IS NULL
     OR v_temp.enviado_em IS NULL
     OR v_temp.consumida_em IS NOT NULL
     OR v_temp.invalidada_em IS NOT NULL
     OR v_temp.expira_em<=clock_timestamp() THEN
    RAISE EXCEPTION 'Senha temporaria invalida ou expirada' USING ERRCODE='23514';
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM acesso_humano
    WHERE organizacao_id=p_organizacao_id AND usuario_id=p_usuario_id
      AND estado<>'bloqueado'
    FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'Acesso humano indisponivel' USING ERRCODE='23514';
  END IF;

  UPDATE senha_temporaria_humana
  SET consumida_em=clock_timestamp()
  WHERE organizacao_id=p_organizacao_id AND id=p_senha_temporaria_id;

  UPDATE acesso_humano
  SET senha_hash=p_nova_senha_hash,
      senha_formato=p_nova_senha_formato,
      senha_versao=senha_versao+1,
      senha_definida_em=clock_timestamp(),
      estado='ativo',
      bloqueado_em=NULL,
      bloqueado_por_id=NULL,
      motivo_bloqueio=NULL,
      atualizado_em=clock_timestamp()
  WHERE organizacao_id=p_organizacao_id AND usuario_id=p_usuario_id
  RETURNING acesso_humano.senha_versao INTO v_versao;

  UPDATE credencial c
  SET revogada_em=clock_timestamp(),
      revogada_por_id=p_usuario_id,
      motivo_revogacao='Senha humana redefinida'
  FROM sessao_humana sh
  WHERE sh.organizacao_id=p_organizacao_id
    AND sh.usuario_id=p_usuario_id
    AND sh.credencial_id=c.id
    AND c.organizacao_id=p_organizacao_id
    AND c.revogada_em IS NULL;

  UPDATE sessao_humana
  SET encerrada_em=clock_timestamp(),
      motivo_encerramento='Senha humana redefinida'
  WHERE organizacao_id=p_organizacao_id
    AND usuario_id=p_usuario_id
    AND encerrada_em IS NULL;

  INSERT INTO evento_identidade_humana(
    organizacao_id,usuario_id,acao,resultado,correlation_id
  )
  VALUES(
    p_organizacao_id,p_usuario_id,'senha_definitiva_definida','confirmado',p_correlation_id
  );

  RETURN QUERY SELECT p_usuario_id,'ativo'::text,v_versao;
END
$$;

CREATE OR REPLACE FUNCTION hvb.acesso_humano_criar_sessao(
  p_organizacao_id uuid,
  p_usuario_id uuid,
  p_senha_versao integer,
  p_token_hash text,
  p_expira_em timestamptz,
  p_origem_chave text,
  p_correlation_id uuid
)
RETURNS TABLE(
  sessao_id uuid,
  credencial_id uuid,
  expira_em timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=hvb,pg_temp
AS $$
DECLARE
  v_sessao uuid:=gen_random_uuid();
  v_credencial uuid:=gen_random_uuid();
BEGIN
  IF p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Hash de credencial invalido' USING ERRCODE='23514';
  END IF;
  IF p_expira_em<=clock_timestamp() THEN
    RAISE EXCEPTION 'Expiracao de credencial invalida' USING ERRCODE='23514';
  END IF;
  IF p_origem_chave IS NOT NULL AND p_origem_chave !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Origem invalida' USING ERRCODE='23514';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'acesso-humano:'||p_organizacao_id::text||':'||p_usuario_id::text,0));

  IF NOT EXISTS(
    SELECT 1
    FROM usuario u
    JOIN acesso_humano ah
      ON (ah.organizacao_id,ah.usuario_id)=(u.organizacao_id,u.id)
    WHERE u.organizacao_id=p_organizacao_id
      AND u.id=p_usuario_id
      AND u.ativo
      AND ah.estado='ativo'
      AND ah.bloqueado_em IS NULL
      AND ah.senha_hash IS NOT NULL
      AND ah.senha_versao=p_senha_versao
    FOR UPDATE OF ah
  ) THEN
    RAISE EXCEPTION 'Acesso humano invalido ou desatualizado' USING ERRCODE='23514';
  END IF;

  INSERT INTO credencial(
    id,organizacao_id,usuario_id,tipo,token_hash,expira_em
  )
  VALUES(
    v_credencial,p_organizacao_id,p_usuario_id,'api',p_token_hash,p_expira_em
  );

  INSERT INTO sessao_humana(
    id,organizacao_id,usuario_id,credencial_id,senha_versao,origem_chave
  )
  VALUES(
    v_sessao,p_organizacao_id,p_usuario_id,v_credencial,p_senha_versao,p_origem_chave
  );

  INSERT INTO evento_identidade_humana(
    organizacao_id,usuario_id,credencial_id,acao,resultado,origem_chave,correlation_id
  )
  VALUES(
    p_organizacao_id,p_usuario_id,v_credencial,'login_humano','confirmado',
    p_origem_chave,p_correlation_id
  );

  RETURN QUERY SELECT v_sessao,v_credencial,p_expira_em;
END
$$;

CREATE OR REPLACE FUNCTION hvb.acesso_humano_encerrar_sessao(
  p_organizacao_id uuid,
  p_credencial_id uuid,
  p_motivo text,
  p_correlation_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=hvb,pg_temp
AS $$
DECLARE
  v_usuario uuid;
BEGIN
  IF p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'Motivo invalido' USING ERRCODE='23514';
  END IF;

  SELECT usuario_id INTO v_usuario
  FROM sessao_humana
  WHERE organizacao_id=p_organizacao_id AND credencial_id=p_credencial_id
  FOR UPDATE;

  IF v_usuario IS NULL THEN
    RETURN false;
  END IF;

  UPDATE credencial
  SET revogada_em=COALESCE(revogada_em,clock_timestamp()),
      revogada_por_id=COALESCE(revogada_por_id,v_usuario),
      motivo_revogacao=COALESCE(motivo_revogacao,btrim(p_motivo))
  WHERE organizacao_id=p_organizacao_id AND id=p_credencial_id;

  UPDATE sessao_humana
  SET encerrada_em=COALESCE(encerrada_em,clock_timestamp()),
      motivo_encerramento=COALESCE(motivo_encerramento,btrim(p_motivo))
  WHERE organizacao_id=p_organizacao_id AND credencial_id=p_credencial_id;

  IF NOT EXISTS(
    SELECT 1 FROM evento_identidade_humana WHERE correlation_id=p_correlation_id
  ) THEN
    INSERT INTO evento_identidade_humana(
      organizacao_id,usuario_id,credencial_id,acao,resultado,correlation_id,motivo
    )
    VALUES(
      p_organizacao_id,v_usuario,p_credencial_id,'logout_humano','confirmado',
      p_correlation_id,btrim(p_motivo)
    );
  END IF;
  RETURN true;
END
$$;

CREATE OR REPLACE FUNCTION hvb.acesso_humano_bloquear(
  p_organizacao_id uuid,
  p_autor_id uuid,
  p_usuario_id uuid,
  p_motivo text,
  p_correlation_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=hvb,pg_temp
AS $$
DECLARE org_contexto uuid;
BEGIN
  org_contexto:=nullif(current_setting('hvb.org',true),'')::uuid;
  IF org_contexto IS DISTINCT FROM p_organizacao_id THEN
    RAISE EXCEPTION 'Contexto de organizacao invalido' USING ERRCODE='23514';
  END IF;
  IF p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'Motivo invalido' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM atribuicao_consulta a
    JOIN papel_permissao pp
      ON pp.organizacao_id=a.organizacao_id AND pp.papel_id=a.papel_id
    WHERE a.organizacao_id=p_organizacao_id AND a.usuario_id=p_autor_id
      AND a.ativo AND a.unidade_id IS NULL AND pp.permissao='acesso:administrar'
  ) THEN
    RAISE EXCEPTION 'Autor sem administracao global' USING ERRCODE='42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'acesso-humano:'||p_organizacao_id::text||':'||p_usuario_id::text,0));

  UPDATE acesso_humano
  SET estado='bloqueado',bloqueado_em=clock_timestamp(),bloqueado_por_id=p_autor_id,
      motivo_bloqueio=btrim(p_motivo),atualizado_em=clock_timestamp()
  WHERE organizacao_id=p_organizacao_id AND usuario_id=p_usuario_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acesso humano inexistente' USING ERRCODE='23514';
  END IF;

  UPDATE senha_temporaria_humana
  SET invalidada_em=clock_timestamp(),invalidada_por_id=p_autor_id,
      motivo_invalidacao='Acesso humano bloqueado'
  WHERE organizacao_id=p_organizacao_id AND usuario_id=p_usuario_id
    AND consumida_em IS NULL AND invalidada_em IS NULL;

  UPDATE credencial c
  SET revogada_em=clock_timestamp(),revogada_por_id=p_autor_id,
      motivo_revogacao='Acesso humano bloqueado'
  FROM sessao_humana sh
  WHERE sh.organizacao_id=p_organizacao_id AND sh.usuario_id=p_usuario_id
    AND sh.credencial_id=c.id AND c.organizacao_id=p_organizacao_id
    AND c.revogada_em IS NULL;

  UPDATE sessao_humana
  SET encerrada_em=clock_timestamp(),motivo_encerramento='Acesso humano bloqueado'
  WHERE organizacao_id=p_organizacao_id AND usuario_id=p_usuario_id
    AND encerrada_em IS NULL;

  INSERT INTO evento_identidade_humana(
    organizacao_id,usuario_id,ator_id,acao,resultado,correlation_id,motivo
  )
  VALUES(
    p_organizacao_id,p_usuario_id,p_autor_id,'acesso_humano_bloqueado',
    'confirmado',p_correlation_id,btrim(p_motivo)
  );
  RETURN 'bloqueado';
END
$$;

CREATE OR REPLACE FUNCTION hvb.acesso_humano_desbloquear(
  p_organizacao_id uuid,
  p_autor_id uuid,
  p_usuario_id uuid,
  p_motivo text,
  p_correlation_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=hvb,pg_temp
AS $$
DECLARE
  org_contexto uuid;
  v_estado text;
BEGIN
  org_contexto:=nullif(current_setting('hvb.org',true),'')::uuid;
  IF org_contexto IS DISTINCT FROM p_organizacao_id THEN
    RAISE EXCEPTION 'Contexto de organizacao invalido' USING ERRCODE='23514';
  END IF;
  IF p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'Motivo invalido' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM atribuicao_consulta a
    JOIN papel_permissao pp
      ON pp.organizacao_id=a.organizacao_id AND pp.papel_id=a.papel_id
    WHERE a.organizacao_id=p_organizacao_id AND a.usuario_id=p_autor_id
      AND a.ativo AND a.unidade_id IS NULL AND pp.permissao='acesso:administrar'
  ) THEN
    RAISE EXCEPTION 'Autor sem administracao global' USING ERRCODE='42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'acesso-humano:'||p_organizacao_id::text||':'||p_usuario_id::text,0));

  SELECT CASE WHEN senha_hash IS NULL THEN 'pendente_ativacao' ELSE 'ativo' END
  INTO v_estado
  FROM acesso_humano
  WHERE organizacao_id=p_organizacao_id AND usuario_id=p_usuario_id
  FOR UPDATE;

  IF v_estado IS NULL THEN
    RAISE EXCEPTION 'Acesso humano inexistente' USING ERRCODE='23514';
  END IF;

  UPDATE acesso_humano
  SET estado=v_estado,bloqueado_em=NULL,bloqueado_por_id=NULL,motivo_bloqueio=NULL,
      atualizado_em=clock_timestamp()
  WHERE organizacao_id=p_organizacao_id AND usuario_id=p_usuario_id;

  INSERT INTO evento_identidade_humana(
    organizacao_id,usuario_id,ator_id,acao,resultado,correlation_id,motivo
  )
  VALUES(
    p_organizacao_id,p_usuario_id,p_autor_id,'acesso_humano_desbloqueado',
    'confirmado',p_correlation_id,btrim(p_motivo)
  );
  RETURN v_estado;
END
$$;

CREATE OR REPLACE FUNCTION hvb.limite_acesso_humano_consultar(
  p_organizacao_id uuid,
  p_escopo text,
  p_chave text
)
RETURNS TABLE(
  falhas integer,
  janela_inicio timestamptz,
  bloqueado_ate timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path=hvb,pg_temp
AS $$
  SELECT l.falhas,l.janela_inicio,l.bloqueado_ate
  FROM limite_acesso_humano l
  WHERE l.organizacao_id=p_organizacao_id
    AND l.escopo=p_escopo
    AND l.chave=p_chave
$$;

CREATE OR REPLACE FUNCTION hvb.limite_acesso_humano_registrar_falha(
  p_organizacao_id uuid,
  p_escopo text,
  p_chave text,
  p_janela_segundos integer,
  p_limite integer,
  p_bloqueio_segundos integer
)
RETURNS TABLE(
  falhas integer,
  janela_inicio timestamptz,
  bloqueado_ate timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=hvb,pg_temp
AS $$
DECLARE
  v_agora timestamptz:=clock_timestamp();
  v_falhas integer;
  v_inicio timestamptz;
  v_bloqueio timestamptz;
BEGIN
  IF p_escopo NOT IN ('conta','origem')
     OR p_chave !~ '^[0-9a-f]{64}$'
     OR p_janela_segundos NOT BETWEEN 1 AND 86400
     OR p_limite NOT BETWEEN 1 AND 1000
     OR p_bloqueio_segundos NOT BETWEEN 1 AND 604800 THEN
    RAISE EXCEPTION 'Parametros de limite invalidos' USING ERRCODE='23514';
  END IF;

  INSERT INTO limite_acesso_humano(
    organizacao_id,escopo,chave,falhas,janela_inicio,bloqueado_ate,atualizado_em
  )
  VALUES(p_organizacao_id,p_escopo,p_chave,1,v_agora,NULL,v_agora)
  ON CONFLICT(organizacao_id,escopo,chave)
  DO UPDATE SET
    falhas=CASE
      WHEN limite_acesso_humano.janela_inicio
           <= v_agora-make_interval(secs=>p_janela_segundos)
      THEN 1 ELSE limite_acesso_humano.falhas+1 END,
    janela_inicio=CASE
      WHEN limite_acesso_humano.janela_inicio
           <= v_agora-make_interval(secs=>p_janela_segundos)
      THEN v_agora ELSE limite_acesso_humano.janela_inicio END,
    atualizado_em=v_agora
  RETURNING limite_acesso_humano.falhas,limite_acesso_humano.janela_inicio,
            limite_acesso_humano.bloqueado_ate
  INTO v_falhas,v_inicio,v_bloqueio;

  IF v_falhas>=p_limite THEN
    v_bloqueio:=GREATEST(COALESCE(v_bloqueio,v_agora),
                         v_agora+make_interval(secs=>p_bloqueio_segundos));
    UPDATE limite_acesso_humano
    SET bloqueado_ate=v_bloqueio,atualizado_em=v_agora
    WHERE organizacao_id=p_organizacao_id AND escopo=p_escopo AND chave=p_chave;
  END IF;

  RETURN QUERY SELECT v_falhas,v_inicio,v_bloqueio;
END
$$;

CREATE OR REPLACE FUNCTION hvb.limite_acesso_humano_limpar(
  p_organizacao_id uuid,
  p_escopo text,
  p_chave text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=hvb,pg_temp
AS $$
BEGIN
  IF p_escopo NOT IN ('conta','origem') OR p_chave !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Parametros de limite invalidos' USING ERRCODE='23514';
  END IF;
  DELETE FROM limite_acesso_humano
  WHERE organizacao_id=p_organizacao_id AND escopo=p_escopo AND chave=p_chave;
END
$$;

CREATE OR REPLACE FUNCTION hvb.evento_identidade_humana_registrar(
  p_organizacao_id uuid,
  p_usuario_id uuid,
  p_credencial_id uuid,
  p_acao text,
  p_resultado text,
  p_conta_chave text,
  p_origem_chave text,
  p_correlation_id uuid,
  p_motivo text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=hvb,pg_temp
AS $$
DECLARE v_id uuid:=gen_random_uuid();
BEGIN
  INSERT INTO evento_identidade_humana(
    id,organizacao_id,usuario_id,credencial_id,acao,resultado,
    conta_chave,origem_chave,correlation_id,motivo
  )
  VALUES(
    v_id,p_organizacao_id,p_usuario_id,p_credencial_id,p_acao,p_resultado,
    p_conta_chave,p_origem_chave,p_correlation_id,p_motivo
  );
  RETURN v_id;
END
$$;

REVOKE ALL ON FUNCTION hvb.cpf_valido(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION hvb.validar_acesso_humano_cpf() FROM PUBLIC;
REVOKE ALL ON FUNCTION hvb.proteger_login_cpf_humano() FROM PUBLIC;
REVOKE ALL ON FUNCTION hvb.impedir_alteracao_evento_identidade_humana() FROM PUBLIC;
REVOKE ALL ON FUNCTION hvb.acesso_humano_status(uuid,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION hvb.acesso_humano_emitir_senha_temporaria(uuid,uuid,uuid,text,text,text,text,timestamptz,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION hvb.acesso_humano_marcar_senha_temporaria_enviada(uuid,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION hvb.acesso_humano_obter_prova(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION hvb.acesso_humano_consumir_senha_temporaria(uuid,uuid,uuid,text,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION hvb.acesso_humano_criar_sessao(uuid,uuid,integer,text,timestamptz,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION hvb.acesso_humano_encerrar_sessao(uuid,uuid,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION hvb.acesso_humano_bloquear(uuid,uuid,uuid,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION hvb.acesso_humano_desbloquear(uuid,uuid,uuid,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION hvb.limite_acesso_humano_consultar(uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION hvb.limite_acesso_humano_registrar_falha(uuid,text,text,integer,integer,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION hvb.limite_acesso_humano_limpar(uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION hvb.evento_identidade_humana_registrar(uuid,uuid,uuid,text,text,text,text,uuid,text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION hvb.acesso_humano_status(uuid,uuid,uuid) TO hvb_app;
GRANT EXECUTE ON FUNCTION hvb.acesso_humano_emitir_senha_temporaria(uuid,uuid,uuid,text,text,text,text,timestamptz,text,uuid) TO hvb_app;
GRANT EXECUTE ON FUNCTION hvb.acesso_humano_marcar_senha_temporaria_enviada(uuid,uuid,uuid) TO hvb_app;
GRANT EXECUTE ON FUNCTION hvb.acesso_humano_obter_prova(uuid,text) TO hvb_app;
GRANT EXECUTE ON FUNCTION hvb.acesso_humano_consumir_senha_temporaria(uuid,uuid,uuid,text,text,uuid) TO hvb_app;
GRANT EXECUTE ON FUNCTION hvb.acesso_humano_criar_sessao(uuid,uuid,integer,text,timestamptz,text,uuid) TO hvb_app;
GRANT EXECUTE ON FUNCTION hvb.acesso_humano_encerrar_sessao(uuid,uuid,text,uuid) TO hvb_app;
GRANT EXECUTE ON FUNCTION hvb.acesso_humano_bloquear(uuid,uuid,uuid,text,uuid) TO hvb_app;
GRANT EXECUTE ON FUNCTION hvb.acesso_humano_desbloquear(uuid,uuid,uuid,text,uuid) TO hvb_app;
GRANT EXECUTE ON FUNCTION hvb.limite_acesso_humano_consultar(uuid,text,text) TO hvb_app;
GRANT EXECUTE ON FUNCTION hvb.limite_acesso_humano_registrar_falha(uuid,text,text,integer,integer,integer) TO hvb_app;
GRANT EXECUTE ON FUNCTION hvb.limite_acesso_humano_limpar(uuid,text,text) TO hvb_app;
GRANT EXECUTE ON FUNCTION hvb.evento_identidade_humana_registrar(uuid,uuid,uuid,text,text,text,text,uuid,text) TO hvb_app;

COMMENT ON TABLE hvb.acesso_humano IS 'Identidade humana web vinculada a usuario HVB; login permanece em usuario.login e deve ser CPF valido.';
COMMENT ON TABLE hvb.senha_temporaria_humana IS 'Senha temporaria Argon2id para ativacao/recuperacao; uso unico, expiravel e sem plaintext persistido.';
COMMENT ON TABLE hvb.sessao_humana IS 'Vincula autenticacao humana a credencial API opaca existente para revogacao segura.';
COMMENT ON TABLE hvb.limite_acesso_humano IS 'Estado compartilhado de limitacao de tentativas por conta/origem; chaves sao hashes, nunca CPF/IP bruto.';
COMMENT ON TABLE hvb.evento_identidade_humana IS 'Auditoria de identidade humana sem senhas, tokens ou segredos.';
