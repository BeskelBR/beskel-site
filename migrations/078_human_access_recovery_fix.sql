-- 078_human_access_recovery_fix.sql
-- Corrige consumo de senha temporaria e revoga sessoes humanas ao iniciar recuperacao.
-- Preserva migrations 001-077, hvb.autenticar, Bearer, Terminal/C18 e NFC.

SET search_path=hvb,public;

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
  v_temp hvb.senha_temporaria_humana;
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
    SELECT 1
    FROM hvb.usuario u
    WHERE u.organizacao_id=p_organizacao_id
      AND u.id=p_usuario_id
      AND u.ativo
  ) THEN
    RAISE EXCEPTION 'Usuario inexistente ou inativo' USING ERRCODE='23514';
  END IF;

  SELECT st.*
  INTO v_temp
  FROM hvb.senha_temporaria_humana st
  WHERE st.organizacao_id=p_organizacao_id
    AND st.id=p_senha_temporaria_id
    AND st.usuario_id=p_usuario_id
  FOR UPDATE;

  IF v_temp.id IS NULL
     OR v_temp.enviado_em IS NULL
     OR v_temp.consumida_em IS NOT NULL
     OR v_temp.invalidada_em IS NOT NULL
     OR v_temp.expira_em<=clock_timestamp() THEN
    RAISE EXCEPTION 'Senha temporaria invalida ou expirada' USING ERRCODE='23514';
  END IF;

  IF NOT EXISTS(
    SELECT 1
    FROM hvb.acesso_humano ah
    WHERE ah.organizacao_id=p_organizacao_id
      AND ah.usuario_id=p_usuario_id
      AND ah.estado<>'bloqueado'
    FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'Acesso humano indisponivel' USING ERRCODE='23514';
  END IF;

  UPDATE hvb.senha_temporaria_humana st
  SET consumida_em=clock_timestamp()
  WHERE st.organizacao_id=p_organizacao_id
    AND st.id=p_senha_temporaria_id;

  UPDATE hvb.acesso_humano ah
  SET senha_hash=p_nova_senha_hash,
      senha_formato=p_nova_senha_formato,
      senha_versao=ah.senha_versao+1,
      senha_definida_em=clock_timestamp(),
      estado='ativo',
      bloqueado_em=NULL,
      bloqueado_por_id=NULL,
      motivo_bloqueio=NULL,
      atualizado_em=clock_timestamp()
  WHERE ah.organizacao_id=p_organizacao_id
    AND ah.usuario_id=p_usuario_id
  RETURNING ah.senha_versao INTO v_versao;

  UPDATE hvb.credencial c
  SET revogada_em=clock_timestamp(),
      revogada_por_id=p_usuario_id,
      motivo_revogacao='Senha humana redefinida'
  FROM hvb.sessao_humana sh
  WHERE sh.organizacao_id=p_organizacao_id
    AND sh.usuario_id=p_usuario_id
    AND sh.credencial_id=c.id
    AND c.organizacao_id=p_organizacao_id
    AND c.revogada_em IS NULL;

  UPDATE hvb.sessao_humana sh
  SET encerrada_em=clock_timestamp(),
      motivo_encerramento='Senha humana redefinida'
  WHERE sh.organizacao_id=p_organizacao_id
    AND sh.usuario_id=p_usuario_id
    AND sh.encerrada_em IS NULL;

  INSERT INTO hvb.evento_identidade_humana(
    organizacao_id,usuario_id,acao,resultado,correlation_id
  )
  VALUES(
    p_organizacao_id,p_usuario_id,'senha_definitiva_definida','confirmado',p_correlation_id
  );

  RETURN QUERY SELECT p_usuario_id,'ativo'::text,v_versao;
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
    FROM hvb.atribuicao_consulta a
    JOIN hvb.papel_permissao pp
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
  FROM hvb.usuario u
  WHERE u.organizacao_id=p_organizacao_id AND u.id=p_usuario_id AND u.ativo
  FOR UPDATE;
  IF v_login IS NULL THEN
    RAISE EXCEPTION 'Usuario inexistente ou inativo' USING ERRCODE='23514';
  END IF;
  IF NOT hvb.cpf_valido(v_login) THEN
    RAISE EXCEPTION 'Login do usuario nao e CPF valido' USING ERRCODE='23514';
  END IF;

  SELECT ah.estado INTO v_estado
  FROM hvb.acesso_humano ah
  WHERE ah.organizacao_id=p_organizacao_id AND ah.usuario_id=p_usuario_id
  FOR UPDATE;

  IF p_finalidade='ativacao' THEN
    IF v_estado IN ('ativo','recuperacao_pendente','bloqueado') THEN
      RAISE EXCEPTION 'Acesso humano ja ativado ou indisponivel para ativacao' USING ERRCODE='23514';
    END IF;
    INSERT INTO hvb.acesso_humano(organizacao_id,usuario_id,email,estado)
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
      SELECT 1
      FROM hvb.acesso_humano ah
      WHERE ah.organizacao_id=p_organizacao_id
        AND ah.usuario_id=p_usuario_id
        AND ah.senha_hash IS NOT NULL
        AND ah.senha_versao>0
    ) THEN
      RAISE EXCEPTION 'Senha definitiva ainda nao definida' USING ERRCODE='23514';
    END IF;

    UPDATE hvb.acesso_humano ah
    SET email=v_email,
        estado='recuperacao_pendente',
        atualizado_em=clock_timestamp()
    WHERE ah.organizacao_id=p_organizacao_id
      AND ah.usuario_id=p_usuario_id;
    v_estado:='recuperacao_pendente';

    UPDATE hvb.credencial c
    SET revogada_em=clock_timestamp(),
        revogada_por_id=p_autor_id,
        motivo_revogacao='Recuperacao de senha humana iniciada'
    FROM hvb.sessao_humana sh
    WHERE sh.organizacao_id=p_organizacao_id
      AND sh.usuario_id=p_usuario_id
      AND sh.credencial_id=c.id
      AND c.organizacao_id=p_organizacao_id
      AND c.revogada_em IS NULL;

    UPDATE hvb.sessao_humana sh
    SET encerrada_em=clock_timestamp(),
        motivo_encerramento='Recuperacao de senha humana iniciada'
    WHERE sh.organizacao_id=p_organizacao_id
      AND sh.usuario_id=p_usuario_id
      AND sh.encerrada_em IS NULL;
  END IF;

  UPDATE hvb.senha_temporaria_humana st
  SET invalidada_em=clock_timestamp(),
      invalidada_por_id=p_autor_id,
      motivo_invalidacao='Substituida por nova senha temporaria'
  WHERE st.organizacao_id=p_organizacao_id
    AND st.usuario_id=p_usuario_id
    AND st.consumida_em IS NULL
    AND st.invalidada_em IS NULL;

  INSERT INTO hvb.senha_temporaria_humana(
    organizacao_id,usuario_id,finalidade,senha_hash,senha_formato,
    expira_em,solicitada_por_id
  )
  VALUES(
    p_organizacao_id,p_usuario_id,p_finalidade,p_senha_hash,p_senha_formato,
    p_expira_em,p_autor_id
  )
  RETURNING id INTO v_id;

  INSERT INTO hvb.evento_identidade_humana(
    organizacao_id,usuario_id,ator_id,acao,resultado,correlation_id,motivo
  )
  VALUES(
    p_organizacao_id,p_usuario_id,p_autor_id,'senha_temporaria_emitida',
    'pendente_envio',p_correlation_id,btrim(p_motivo)
  );

  RETURN QUERY SELECT v_id,v_estado,v_email,p_expira_em;
END
$$;
