
CREATE OR REPLACE FUNCTION hvb.proteger_sessao_inventario_encerrada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=hvb,pg_temp
AS $function$
BEGIN
  IF OLD.situacao='encerrada' AND (
    NEW.situacao IS DISTINCT FROM OLD.situacao
    OR NEW.encerrada_em IS DISTINCT FROM OLD.encerrada_em
  ) THEN
    RAISE EXCEPTION 'Sessao de inventario encerrada e imutavel'
      USING ERRCODE='23514';
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER sessao_inventario_estado_monotonico
BEFORE UPDATE OF situacao,encerrada_em
ON hvb.sessao_inventario
FOR EACH ROW
EXECUTE FUNCTION hvb.proteger_sessao_inventario_encerrada();
