
CREATE OR REPLACE FUNCTION hvb.proteger_estado_monotonico()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=hvb,pg_temp
AS $function$
BEGIN
  IF TG_TABLE_NAME='credencial' THEN
    IF OLD.revogada_em IS NOT NULL AND (
      NEW.revogada_em IS DISTINCT FROM OLD.revogada_em
      OR NEW.revogada_por_id IS DISTINCT FROM OLD.revogada_por_id
      OR NEW.motivo_revogacao IS DISTINCT FROM OLD.motivo_revogacao
    ) THEN
      RAISE EXCEPTION 'Credencial revogada e imutavel'
        USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME IN ('usuario','dispositivo') THEN
    IF NOT OLD.ativo AND NEW.ativo THEN
      RAISE EXCEPTION 'Desativacao nao pode ser revertida'
        USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME='comando' THEN
    IF OLD.concluido_em IS NOT NULL AND (
      NEW.concluido_em IS DISTINCT FROM OLD.concluido_em
      OR NEW.resultado IS DISTINCT FROM OLD.resultado
    ) THEN
      RAISE EXCEPTION 'Comando concluido e imutavel'
        USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER credencial_estado_monotonico
BEFORE UPDATE OF revogada_em,revogada_por_id,motivo_revogacao
ON hvb.credencial
FOR EACH ROW
EXECUTE FUNCTION hvb.proteger_estado_monotonico();

CREATE TRIGGER usuario_estado_monotonico
BEFORE UPDATE OF ativo
ON hvb.usuario
FOR EACH ROW
EXECUTE FUNCTION hvb.proteger_estado_monotonico();

CREATE TRIGGER dispositivo_estado_monotonico
BEFORE UPDATE OF ativo
ON hvb.dispositivo
FOR EACH ROW
EXECUTE FUNCTION hvb.proteger_estado_monotonico();

CREATE TRIGGER comando_estado_monotonico
BEFORE UPDATE OF resultado,concluido_em
ON hvb.comando
FOR EACH ROW
EXECUTE FUNCTION hvb.proteger_estado_monotonico();
