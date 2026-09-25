-- 108_outbox_lease_integrity.sql
SET search_path=hvb,public;

CREATE OR REPLACE FUNCTION hvb.reservar_outbox(limite integer, token uuid)
RETURNS SETOF hvb.outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=hvb,pg_temp
AS $function$
BEGIN
 IF limite<1 OR limite>100 THEN
  RAISE EXCEPTION 'Limite invalido';
 END IF;

 IF token IS NULL THEN
  RAISE EXCEPTION 'Token de lease obrigatorio' USING ERRCODE='23514';
 END IF;

 WITH esgotados AS (
  SELECT id
  FROM outbox
  WHERE concluida_em IS NULL
    AND pendente_em IS NULL
    AND tentativas>=5
    AND (lease_ate IS NULL OR lease_ate<now())
  ORDER BY lease_ate NULLS FIRST,id
  LIMIT limite
  FOR UPDATE SKIP LOCKED
 )
 UPDATE outbox o
 SET pendente_em=now(),
     ultimo_erro='tentativas_esgotadas',
     lease_ate=NULL,
     lease_token=NULL
 FROM esgotados e
 WHERE o.id=e.id;

 RETURN QUERY
 WITH candidatos AS (
  SELECT id
  FROM outbox
  WHERE concluida_em IS NULL
    AND pendente_em IS NULL
    AND disponivel_em<=now()
    AND (lease_ate IS NULL OR lease_ate<now())
    AND tentativas<5
  ORDER BY disponivel_em,id
  LIMIT limite
  FOR UPDATE SKIP LOCKED
 )
 UPDATE outbox o
 SET lease_ate=now()+interval '30 seconds',
     lease_token=token,
     tentativas=o.tentativas+1
 FROM candidatos c
 WHERE o.id=c.id
 RETURNING o.*;
END
$function$;
