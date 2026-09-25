-- 109_outbox_worker_lease_ownership.sql
SET search_path=hvb,public;

CREATE OR REPLACE FUNCTION hvb.concluir_outbox(evento uuid, token uuid)
RETURNS hvb.outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=hvb,pg_temp
AS $function$
DECLARE
 v_org uuid;
 v_saida hvb.outbox;
BEGIN
 v_org:=nullif(current_setting('hvb.org',true),'')::uuid;

 IF v_org IS NULL THEN
  RAISE EXCEPTION 'Organizacao obrigatoria' USING ERRCODE='23514';
 END IF;

 IF evento IS NULL OR token IS NULL THEN
  RAISE EXCEPTION 'Evento e token de lease obrigatorios' USING ERRCODE='23514';
 END IF;

 UPDATE outbox o
 SET concluida_em=now(),
     lease_ate=NULL,
     lease_token=NULL
 WHERE o.organizacao_id=v_org
   AND o.id=evento
   AND o.concluida_em IS NULL
   AND o.pendente_em IS NULL
   AND o.lease_token=token
   AND o.lease_ate IS NOT NULL
   AND o.lease_ate>=now()
 RETURNING o.* INTO v_saida;

 IF NOT FOUND THEN
  RAISE EXCEPTION 'Lease de outbox indisponivel para conclusao' USING ERRCODE='23514';
 END IF;

 RETURN v_saida;
END
$function$;

CREATE OR REPLACE FUNCTION hvb.falhar_outbox(
 evento uuid,
 token uuid,
 erro text,
 proxima_tentativa timestamptz
)
RETURNS hvb.outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=hvb,pg_temp
AS $function$
DECLARE
 v_org uuid;
 v_atual hvb.outbox;
 v_saida hvb.outbox;
 v_erro text;
BEGIN
 v_org:=nullif(current_setting('hvb.org',true),'')::uuid;
 v_erro:=nullif(btrim(erro),'');

 IF v_org IS NULL THEN
  RAISE EXCEPTION 'Organizacao obrigatoria' USING ERRCODE='23514';
 END IF;

 IF evento IS NULL OR token IS NULL OR v_erro IS NULL THEN
  RAISE EXCEPTION 'Evento, token de lease e erro obrigatorios' USING ERRCODE='23514';
 END IF;

 SELECT *
 INTO v_atual
 FROM outbox o
 WHERE o.organizacao_id=v_org
   AND o.id=evento
 FOR UPDATE;

 IF NOT FOUND
    OR v_atual.concluida_em IS NOT NULL
    OR v_atual.pendente_em IS NOT NULL
    OR v_atual.lease_token IS DISTINCT FROM token
    OR v_atual.lease_ate IS NULL
    OR v_atual.lease_ate<now() THEN
  RAISE EXCEPTION 'Lease de outbox indisponivel para falha' USING ERRCODE='23514';
 END IF;

 IF v_atual.tentativas>=5 THEN
  UPDATE outbox o
  SET pendente_em=now(),
      lease_ate=NULL,
      lease_token=NULL,
      ultimo_erro=v_erro
  WHERE o.organizacao_id=v_org
    AND o.id=evento
  RETURNING o.* INTO v_saida;
 ELSE
  IF proxima_tentativa IS NULL THEN
   RAISE EXCEPTION 'Proxima tentativa obrigatoria' USING ERRCODE='23514';
  END IF;

  UPDATE outbox o
  SET disponivel_em=proxima_tentativa,
      lease_ate=NULL,
      lease_token=NULL,
      ultimo_erro=v_erro
  WHERE o.organizacao_id=v_org
    AND o.id=evento
  RETURNING o.* INTO v_saida;
 END IF;

 RETURN v_saida;
END
$function$;

REVOKE ALL ON FUNCTION hvb.concluir_outbox(uuid,uuid)
FROM PUBLIC,anon,authenticated,service_role,hvb_app;
REVOKE ALL ON FUNCTION hvb.falhar_outbox(uuid,uuid,text,timestamptz)
FROM PUBLIC,anon,authenticated,service_role,hvb_app;

GRANT EXECUTE ON FUNCTION hvb.concluir_outbox(uuid,uuid) TO hvb_worker;
GRANT EXECUTE ON FUNCTION hvb.falhar_outbox(uuid,uuid,text,timestamptz) TO hvb_worker;

REVOKE UPDATE(concluida_em,lease_ate,lease_token,pendente_em,ultimo_erro,disponivel_em)
ON hvb.outbox
FROM hvb_worker;
