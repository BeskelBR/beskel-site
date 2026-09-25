
CREATE OR REPLACE FUNCTION hvb.validar_fuso_unidade()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=pg_catalog,pg_temp
AS $function$
BEGIN
  NEW.fuso:=btrim(NEW.fuso);

  IF NEW.fuso='' OR NOT EXISTS(
    SELECT 1
    FROM pg_catalog.pg_timezone_names z
    WHERE z.name=NEW.fuso
  ) THEN
    RAISE EXCEPTION 'Fuso horario da unidade invalido'
      USING ERRCODE='23514';
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER unidade_hospitalar_validar_fuso
BEFORE INSERT OR UPDATE OF fuso
ON hvb.unidade_hospitalar
FOR EACH ROW
EXECUTE FUNCTION hvb.validar_fuso_unidade();
