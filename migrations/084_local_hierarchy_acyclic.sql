-- 084_local_hierarchy_acyclic.sql
-- Impede ciclos indiretos na hierarquia hvb.local.
-- Aditiva: preserva modelo, tipos, ocupacao, estoque e Terminal.

SET search_path=hvb,public;

CREATE OR REPLACE FUNCTION hvb.validar_hierarquia_local()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=hvb,pg_temp
AS $$
BEGIN
  IF NEW.pai_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    WITH RECURSIVE ancestrais(id,pai_id,caminho,ciclo) AS (
      SELECT
        l.id,
        l.pai_id,
        ARRAY[l.id]::uuid[],
        false
      FROM hvb.local l
      WHERE l.organizacao_id=NEW.organizacao_id
        AND l.unidade_id=NEW.unidade_id
        AND l.id=NEW.pai_id

      UNION ALL

      SELECT
        p.id,
        p.pai_id,
        a.caminho || p.id,
        p.id=ANY(a.caminho)
      FROM ancestrais a
      JOIN hvb.local p
        ON p.organizacao_id=NEW.organizacao_id
       AND p.unidade_id=NEW.unidade_id
       AND p.id=a.pai_id
      WHERE NOT a.ciclo
    )
    SELECT 1
    FROM ancestrais
    WHERE id=NEW.id OR ciclo
  ) THEN
    RAISE EXCEPTION 'Hierarquia de local ciclica'
      USING ERRCODE='23514';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER local_hierarquia_aciclica
BEFORE INSERT OR UPDATE OF organizacao_id,unidade_id,pai_id
ON hvb.local
FOR EACH ROW
EXECUTE FUNCTION hvb.validar_hierarquia_local();
