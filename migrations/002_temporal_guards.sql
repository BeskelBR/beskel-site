SET search_path=hvb,public;
-- Locais are immutable through the application role. Reading capacity needs no UPDATE privilege.
CREATE OR REPLACE FUNCTION validar_ocupacao() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
DECLARE cap integer; adm timestamptz; encerrado timestamptz;
BEGIN
 SELECT admitido_em,encerrado_em INTO adm,encerrado FROM episodio
 WHERE organizacao_id=NEW.organizacao_id AND id=NEW.episodio_id FOR UPDATE;
 SELECT capacidade INTO cap FROM local WHERE organizacao_id=NEW.organizacao_id AND id=NEW.local_id;
 IF NEW.vaga>cap OR NEW.inicio<adm OR
 (encerrado IS NOT NULL AND (NEW.fim IS NULL OR NEW.fim>encerrado)) THEN
 RAISE EXCEPTION 'Ocupacao incompativel' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (OLD.fim IS NOT NULL OR
 (NEW.organizacao_id,NEW.unidade_id,NEW.episodio_id,NEW.local_id,NEW.vaga,NEW.inicio)
 IS DISTINCT FROM (OLD.organizacao_id,OLD.unidade_id,OLD.episodio_id,OLD.local_id,OLD.vaga,OLD.inicio)) THEN
 RAISE EXCEPTION 'Preserve historico de ocupacao' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
ALTER TABLE episodio ADD CHECK (isfinite(admitido_em) AND (alta_clinica_em IS NULL OR isfinite(alta_clinica_em)) AND (encerrado_em IS NULL OR isfinite(encerrado_em)));
ALTER TABLE episodio ADD CHECK (alta_clinica_em IS NULL OR encerrado_em IS NULL OR encerrado_em>=alta_clinica_em);
ALTER TABLE ocupacao ADD CHECK (isfinite(inicio) AND (fim IS NULL OR isfinite(fim)));
ALTER TABLE paciente_responsavel ADD CHECK (isfinite(inicio) AND (fim IS NULL OR isfinite(fim)));
ALTER TABLE evento_auditoria ADD COLUMN motivo text CHECK (length(motivo) BETWEEN 1 AND 160);
CREATE FUNCTION validar_saida() RETURNS trigger LANGUAGE plpgsql SET search_path=hvb,pg_temp AS $$
BEGIN
 IF OLD.encerrado_em IS NOT NULL OR (OLD.alta_clinica_em IS NOT NULL AND
 (OLD.alta_clinica_em,OLD.alta_por_id,OLD.motivo_alta) IS DISTINCT FROM
 (NEW.alta_clinica_em,NEW.alta_por_id,NEW.motivo_alta)) THEN
 RAISE EXCEPTION 'Preserve historico do episodio' USING ERRCODE='23514'; END IF;
 IF NEW.encerrado_em IS NOT NULL AND EXISTS(SELECT 1 FROM ocupacao
 WHERE organizacao_id=NEW.organizacao_id AND episodio_id=NEW.id AND (fim IS NULL OR fim>NEW.encerrado_em)) THEN
 RAISE EXCEPTION 'Encerre ocupacao antes da saida' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER episodio_transicao BEFORE UPDATE ON episodio FOR EACH ROW EXECUTE FUNCTION validar_saida();
REVOKE ALL ON FUNCTION validar_saida() FROM PUBLIC;
