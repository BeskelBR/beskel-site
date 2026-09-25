-- 085_patient_responsible_integrity.sql
-- Canonicaliza a responsabilidade do paciente:
-- paciente exige responsavel vigente; operacoes que atribuem responsabilidade
-- devem usar responsavel vinculado ao mesmo paciente.
-- Aditiva: reutiliza paciente_responsavel, pagador e responsabilidade existentes.

SET search_path=hvb,public;

CREATE OR REPLACE FUNCTION hvb.validar_paciente_com_responsavel()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=hvb,pg_temp
AS $$
DECLARE
  v_org uuid;
  v_paciente uuid;
  v_instante timestamptz;
BEGIN
  IF TG_TABLE_NAME='paciente' THEN
    v_org:=NEW.organizacao_id;
    v_paciente:=NEW.id;
    v_instante:=clock_timestamp();

    PERFORM pg_advisory_xact_lock(
      hashtextextended('paciente-responsavel:'||v_org::text||':'||v_paciente::text,0)
    );

    IF NOT EXISTS(
      SELECT 1
      FROM hvb.paciente_responsavel pr
      WHERE pr.organizacao_id=v_org
        AND pr.paciente_id=v_paciente
        AND pr.inicio<=v_instante
        AND (pr.fim IS NULL OR pr.fim>v_instante)
    ) THEN
      RAISE EXCEPTION 'Paciente exige responsavel vigente'
        USING ERRCODE='23514';
    END IF;

    RETURN NULL;
  END IF;

  IF TG_TABLE_NAME='paciente_responsavel' THEN
    IF TG_OP IN ('UPDATE','DELETE') THEN
      v_org:=OLD.organizacao_id;
      v_paciente:=OLD.paciente_id;
      v_instante:=clock_timestamp();

      IF EXISTS(
        SELECT 1 FROM hvb.paciente p
        WHERE p.organizacao_id=v_org AND p.id=v_paciente
      ) THEN
        PERFORM pg_advisory_xact_lock(
          hashtextextended('paciente-responsavel:'||v_org::text||':'||v_paciente::text,0)
        );

        IF NOT EXISTS(
          SELECT 1
          FROM hvb.paciente_responsavel pr
          WHERE pr.organizacao_id=v_org
            AND pr.paciente_id=v_paciente
            AND pr.inicio<=v_instante
            AND (pr.fim IS NULL OR pr.fim>v_instante)
        ) THEN
          RAISE EXCEPTION 'Paciente nao pode ficar sem responsavel vigente'
            USING ERRCODE='23514';
        END IF;
      END IF;
    END IF;

    IF TG_OP IN ('INSERT','UPDATE') THEN
      v_org:=NEW.organizacao_id;
      v_paciente:=NEW.paciente_id;
      v_instante:=clock_timestamp();

      PERFORM pg_advisory_xact_lock(
        hashtextextended('paciente-responsavel:'||v_org::text||':'||v_paciente::text,0)
      );

      IF NOT EXISTS(
        SELECT 1
        FROM hvb.paciente_responsavel pr
        WHERE pr.organizacao_id=v_org
          AND pr.paciente_id=v_paciente
          AND pr.inicio<=v_instante
          AND (pr.fim IS NULL OR pr.fim>v_instante)
      ) THEN
        RAISE EXCEPTION 'Paciente nao pode ficar sem responsavel vigente'
          USING ERRCODE='23514';
      END IF;

      IF NEW.fim IS NOT NULL THEN
        IF NOT EXISTS(
          SELECT 1
          FROM hvb.paciente_responsavel pr
          WHERE pr.organizacao_id=v_org
            AND pr.paciente_id=v_paciente
            AND pr.id<>NEW.id
            AND pr.inicio<=NEW.fim
            AND (pr.fim IS NULL OR pr.fim>NEW.fim)
        ) THEN
          RAISE EXCEPTION 'Encerramento exige responsavel sucessor vigente'
            USING ERRCODE='23514';
        END IF;
      END IF;
    END IF;

    RETURN NULL;
  END IF;

  RAISE EXCEPTION 'Tabela nao suportada por validar_paciente_com_responsavel'
    USING ERRCODE='23514';
END
$$;

CREATE CONSTRAINT TRIGGER paciente_exige_responsavel
AFTER INSERT OR UPDATE
ON hvb.paciente
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION hvb.validar_paciente_com_responsavel();

CREATE CONSTRAINT TRIGGER paciente_responsavel_preserva_vinculo
AFTER INSERT OR UPDATE OR DELETE
ON hvb.paciente_responsavel
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION hvb.validar_paciente_com_responsavel();

CREATE OR REPLACE FUNCTION hvb.validar_responsavel_operacao_paciente()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=hvb,pg_temp
AS $$
DECLARE
  v_paciente uuid;
  v_responsavel uuid;
  v_instante timestamptz;
BEGIN
  IF TG_TABLE_NAME='agendamento' THEN
    v_paciente:=NEW.paciente_id;
    v_responsavel:=NEW.responsavel_id;
    v_instante:=NEW.criada_em;

  ELSIF TG_TABLE_NAME='solicitacao_documento' THEN
    IF NEW.solicitante_responsavel_id IS NULL THEN
      RETURN NEW;
    END IF;
    v_paciente:=NEW.paciente_id;
    v_responsavel:=NEW.solicitante_responsavel_id;
    v_instante:=NEW.recebida_em;

  ELSIF TG_TABLE_NAME='responsabilidade' THEN
    SELECT e.paciente_id,p.responsavel_id
    INTO STRICT v_paciente,v_responsavel
    FROM hvb.item_conta ic
    JOIN hvb.conta c
      ON c.organizacao_id=ic.organizacao_id
     AND c.unidade_id=ic.unidade_id
     AND c.id=ic.conta_id
    JOIN hvb.episodio e
      ON e.organizacao_id=c.organizacao_id
     AND e.unidade_id=c.unidade_id
     AND e.id=c.episodio_id
    JOIN hvb.pagador p
      ON p.organizacao_id=NEW.organizacao_id
     AND p.unidade_id=NEW.unidade_id
     AND p.id=NEW.pagador_id
    WHERE ic.organizacao_id=NEW.organizacao_id
      AND ic.unidade_id=NEW.unidade_id
      AND ic.id=NEW.item_conta_id;

    v_instante:=NEW.criada_em;

  ELSE
    RAISE EXCEPTION 'Tabela nao suportada por validar_responsavel_operacao_paciente'
      USING ERRCODE='23514';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'paciente-responsavel:'||NEW.organizacao_id::text||':'||v_paciente::text,
      0
    )
  );

  IF NOT EXISTS(
    SELECT 1
    FROM hvb.paciente_responsavel pr
    WHERE pr.organizacao_id=NEW.organizacao_id
      AND pr.paciente_id=v_paciente
      AND pr.responsavel_id=v_responsavel
      AND pr.inicio<=v_instante
      AND (pr.fim IS NULL OR pr.fim>v_instante)
  ) THEN
    RAISE EXCEPTION 'Responsavel nao possui vinculo vigente com o paciente'
      USING ERRCODE='23514';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER agendamento_responsavel_paciente
BEFORE INSERT
ON hvb.agendamento
FOR EACH ROW
EXECUTE FUNCTION hvb.validar_responsavel_operacao_paciente();

CREATE TRIGGER solicitacao_documento_responsavel_paciente
BEFORE INSERT
ON hvb.solicitacao_documento
FOR EACH ROW
EXECUTE FUNCTION hvb.validar_responsavel_operacao_paciente();

CREATE TRIGGER responsabilidade_financeira_paciente
BEFORE INSERT
ON hvb.responsabilidade
FOR EACH ROW
EXECUTE FUNCTION hvb.validar_responsavel_operacao_paciente();
